export const dynamic='force-dynamic';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth';
import { ok,handleError,HttpError } from '@/lib/http';
import { z } from 'zod';
export async function POST(req:NextRequest){try{const admin=await guard(req,{role:'SUPER_ADMIN'});const input=z.object({groupId:z.string().min(1),batchId:z.string().min(1),reason:z.string().trim().min(10).max(1000)}).parse(await req.json());await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "StudyGroup" WHERE id=${input.groupId} FOR UPDATE`;
 const group=await tx.studyGroup.findUniqueOrThrow({where:{id:input.groupId},include:{members:true}});
 const batch=await tx.batch.findUniqueOrThrow({where:{id:input.batchId},include:{school:true}});
 if(group.batchId)throw new HttpError('Group already mapped',409);
 if(group.boardId!==batch.boardId||group.classId!==batch.classId||group.academicYear!==batch.academicYear||group.schoolName!==batch.school.normalizedName)throw new HttpError('School, board, class and year must exactly match the historical group',422);
 // Evidence supplied by the admin confirms the original roster. Never change an active enrollment.
 for(const member of group.members){
   await tx.$queryRaw`SELECT id FROM "User" WHERE id=${member.userId} FOR UPDATE`;
   const prior=await tx.enrollment.findMany({where:{studentId:member.userId,batchId:batch.id,status:{in:['COMPLETED','GRADUATED']}}});
   if(prior.length>1 || await tx.enrollment.count({where:{studentId:member.userId,batchId:batch.id,status:{in:['ACTIVE','PENDING','TRANSFERRED','WITHDRAWN']}}}))throw new HttpError('A member has a conflicting enrollment in this batch; resolve it before reconciliation',409);
   const e=prior[0]??await tx.enrollment.create({data:{studentId:member.userId,batchId:batch.id,status:'COMPLETED',startedAt:member.joinedAt,endedAt:new Date(),approvedById:admin.id}});
   await tx.groupMember.update({where:{id:member.id},data:{enrollmentId:e.id}});
 }
 await tx.studyGroup.update({where:{id:group.id},data:{batchId:batch.id,isActive:false}});
 await tx.enrollmentAudit.create({data:{actorId:admin.id,action:'RECONCILE_ARCHIVED_GROUP',details:{...input,verifiedMembers:group.members.map(m=>m.userId)}}});
 },{timeout:15000});return ok({archived:true});}catch(e){return handleError(e);} }
