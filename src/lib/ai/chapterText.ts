import { prisma } from '../prisma';
import { getObjectBuffer } from '../r2';

/**
 * Best-effort extraction of a chapter's study text from its uploaded PDFs in
 * R2, used as grounding context for AI question generation. Returns '' if no
 * PDF content is available (generation then falls back to syllabus knowledge).
 */
export async function chapterSourceText(chapterId: string, maxChars = 12000): Promise<string> {
  const materials = await prisma.studyMaterial.findMany({
    where: { chapterId, isActive: true, type: 'PDF' },
    orderBy: { createdAt: 'asc' },
    select: { storageKey: true },
    take: 3,
  });

  let text = '';
  for (const m of materials) {
    if (text.length >= maxChars) break;
    try {
      const buf = await getObjectBuffer(m.storageKey);
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buf });
      const res: any = await parser.getText();
      await parser.destroy?.();
      text += '\n' + (res?.text ?? '');
    } catch (e) {
      console.error('PDF text extraction failed for', m.storageKey, e);
    }
  }
  return text.trim().slice(0, maxChars);
}
