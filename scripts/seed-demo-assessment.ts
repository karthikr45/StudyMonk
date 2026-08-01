/**
 * Demo seed: creates a PUBLISHED quiz containing one of EVERY question type
 * (MCQ, True/False, Numeric, Short, Long) so you can verify the student runner
 * renders them all.
 *
 *   npm run seed:demo
 *   # optionally target a specific subject:
 *   npm run seed:demo -- --subject "Mathematics" --class "Class 10" --board "CBSE"
 *
 * Then log in as a student in that class → Assessments → open
 * "Demo — All question types".
 */
import { PrismaClient } from '@prisma/client';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (run with npm run seed:demo so .env loads).');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const subjectName = arg('--subject');
    const className = arg('--class');
    const boardName = arg('--board');

    const subject = await prisma.subject.findFirst({
      where: {
        isActive: true,
        ...(subjectName ? { name: subjectName } : {}),
        class: {
          isActive: true,
          ...(className ? { name: className } : {}),
          ...(boardName ? { board: { name: boardName } } : {}),
        },
      },
      include: { class: { include: { board: true } } },
    });
    if (!subject) {
      console.error('No matching active subject found. Create a Board → Class → Subject first (admin panel).');
      process.exit(1);
    }
    console.log(`Target: ${subject.class.board.name} · ${subject.class.name} · ${subject.name}`);

    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

    // One question of every type (all PUBLISHED).
    const specs = [
      {
        type: 'MCQ' as const, prompt: 'Which of these is a prime number?', marks: 1,
        options: [
          { text: '9', isCorrect: false }, { text: '15', isCorrect: false },
          { text: '17', isCorrect: true }, { text: '21', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const, prompt: 'Every integer is a rational number.', marks: 1,
        options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
      },
      { type: 'NUMERIC' as const, prompt: 'What is the value of HCF(12, 18)?', marks: 1, numericAnswer: 6 },
      { type: 'SHORT' as const, prompt: 'Define an irrational number in one line.', marks: 2, modelAnswer: 'A number that cannot be written as p/q with integers p and q, q ≠ 0.' },
      { type: 'LONG' as const, prompt: 'Prove that √2 is irrational.', marks: 3, modelAnswer: 'Assume √2 = p/q in lowest terms; then 2q² = p², so p is even, p = 2k, giving q² = 2k², so q is even — contradicting lowest terms. Hence √2 is irrational.' },
    ];

    const questionIds: { id: string; marks: number }[] = [];
    for (const s of specs) {
      const q = await prisma.question.create({
        data: {
          subjectId: subject.id, type: s.type, marks: s.marks, difficulty: 'MEDIUM',
          prompt: s.prompt, source: 'MANUAL', status: 'PUBLISHED', createdById: admin?.id ?? null,
          numericAnswer: (s as any).numericAnswer, modelAnswer: (s as any).modelAnswer,
          options: (s as any).options
            ? { create: (s as any).options.map((o: any, i: number) => ({ text: o.text, isCorrect: o.isCorrect, order: i })) }
            : undefined,
        },
      });
      questionIds.push({ id: q.id, marks: s.marks });
    }

    const totalMarks = questionIds.reduce((n, q) => n + q.marks, 0);
    const assessment = await prisma.assessment.create({
      data: {
        type: 'QUIZ', subjectId: subject.id, chapterId: null,
        title: 'Demo — All question types', description: 'MCQ, True/False, Numeric, Short and Long — one of each.',
        totalMarks, status: 'PUBLISHED', createdById: admin?.id ?? null,
        questions: { create: questionIds.map((q, i) => ({ questionId: q.id, order: i, marks: q.marks })) },
      },
    });

    console.log(`\n✅ Created PUBLISHED quiz "${assessment.title}" with 5 questions (one of each type).`);
    console.log(`   Log in as a student in ${subject.class.name} → Assessments → open it.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
