# StudyMonk — Assessment & AI Generation Plan

A technical spec for adding **daily activities, important Q&A, assignments,
quizzes, board exams, and auto-correction** on top of the existing
Board → Class → Subject → Chapter → Material catalog.

Everything is **database-driven** (no hardcoded content) and the AI layer is
**provider-agnostic** — we code against an interface now and plug in Ollama
(local, open-source) or a hosted open-model endpoint later, via env, with no
code changes.

---

## 1. Design principles

1. **One engine, many activity types.** Daily activity, quiz, assignment, and
   board exam are all the same primitive: an *Assessment* = an ordered set of
   *Questions* a student *Attempts* and is *graded* on. We don't build four
   features; we build one and parameterize it by `type` and `scope`.
2. **Everything is a DB row.** Questions, options, rubrics, assessments,
   attempts, answers, grades — all in Postgres. Nothing hardcoded.
3. **Objective grading is deterministic; subjective grading is AI-assisted
   with human override.** Never auto-finalize subjective exam marks.
4. **AI is optional and pluggable.** The engine works fully without AI
   (manually authored questions). AI generation/grading sits behind an
   `AiProvider` interface so it can be disabled, or swapped, at any time.
5. **Approval gate.** AI-generated questions are `DRAFT` until an admin
   approves them → `PUBLISHED`. Students never see unreviewed AI output.
6. **Fits existing security.** All new endpoints go through the same two-level
   guard (`x-api-key`/session cookie + JWT + role). Students only ever reach
   assessments for their own class; admins author/approve.

---

## 2. Data model (Prisma additions)

```prisma
enum QuestionType { MCQ MULTI TRUE_FALSE SHORT LONG NUMERIC }
enum Difficulty   { EASY MEDIUM HARD }
enum ContentSource { MANUAL AI }
enum PublishStatus { DRAFT PUBLISHED ARCHIVED }

model Question {
  id          String        @id @default(cuid())
  subjectId   String
  chapterId   String?       // null = whole-subject question (e.g. board exam)
  type        QuestionType
  difficulty  Difficulty    @default(MEDIUM)
  marks       Int           @default(1)
  prompt      String        // the question text
  explanation String?       // shown after grading
  // Subjective answers:
  modelAnswer String?       // reference answer for SHORT/LONG
  rubric      String?       // grading guidance for the AI judge
  // Numeric answers:
  numericAnswer Float?
  numericTolerance Float?    @default(0)
  source      ContentSource @default(MANUAL)
  status      PublishStatus @default(DRAFT)
  createdById String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  subject Subject          @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  chapter Chapter?         @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  options QuestionOption[]
  items   AssessmentQuestion[]

  @@index([subjectId, chapterId, status])
}

model QuestionOption {
  id         String  @id @default(cuid())
  questionId String
  text       String
  isCorrect  Boolean @default(false)
  order      Int     @default(0)
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
}

enum AssessmentType { DAILY QUIZ ASSIGNMENT EXAM }

model Assessment {
  id           String         @id @default(cuid())
  type         AssessmentType
  subjectId    String
  chapterId    String?        // null = whole-subject (board exam / subject test)
  title        String
  description  String?
  timeLimitSec Int?           // null = untimed
  totalMarks   Int            @default(0)
  scheduledFor DateTime?      // for DAILY / scheduled exams
  dueAt        DateTime?      // for assignments
  status       PublishStatus  @default(DRAFT)
  createdById  String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  subject   Subject              @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  chapter   Chapter?             @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  questions AssessmentQuestion[]
  attempts  Attempt[]

  @@index([subjectId, type, status, scheduledFor])
}

model AssessmentQuestion {
  id           String @id @default(cuid())
  assessmentId String
  questionId   String
  order        Int    @default(0)
  marks        Int    @default(1)   // marks for this question in this assessment

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  question   Question   @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, questionId])
}

enum AttemptStatus { IN_PROGRESS SUBMITTED GRADED NEEDS_REVIEW }
enum GradedBy      { AUTO AI TEACHER }

model Attempt {
  id           String        @id @default(cuid())
  assessmentId String
  studentId    String
  status       AttemptStatus @default(IN_PROGRESS)
  score        Float?        // awarded
  maxScore     Float?        // total possible
  startedAt    DateTime      @default(now())
  submittedAt  DateTime?
  gradedAt     DateTime?

  assessment Assessment      @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  student    User            @relation(fields: [studentId], references: [id], onDelete: Cascade)
  answers    AttemptAnswer[]

  @@unique([assessmentId, studentId])   // one attempt per student (configurable later)
  @@index([studentId])
}

model AttemptAnswer {
  id              String   @id @default(cuid())
  attemptId       String
  questionId      String
  selectedOptionIds String[] // MCQ/MULTI selections
  textAnswer      String?    // SHORT/LONG
  numericAnswer   Float?     // NUMERIC
  awardedMarks    Float      @default(0)
  isCorrect       Boolean?
  gradedBy        GradedBy?
  confidence      Float?     // AI grader confidence 0..1
  feedback        String?    // per-answer feedback

  attempt  Attempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([attemptId, questionId])
}
```

(Plus back-relations added to `Subject`, `Chapter`, `User`. A future
`DailyStreak` model can track engagement.)

---

## 3. Auto-correction logic

On `POST /attempts/:id/submit`:

```
for each AttemptAnswer:
  switch question.type:
    MCQ / TRUE_FALSE:
      isCorrect = (selectedOptionIds == the one correct option)   → AUTO
    MULTI:
      isCorrect = (selected set == correct set)                   → AUTO
    NUMERIC:
      isCorrect = |numericAnswer - question.numericAnswer| <= tolerance → AUTO
    SHORT / LONG:
      if AiProvider enabled:
        {score, feedback, confidence} = ai.gradeAnswer(question, textAnswer) → AI
        if confidence < THRESHOLD → mark answer NEEDS_REVIEW
      else:
        leave ungraded → attempt.status = NEEDS_REVIEW (teacher grades)

attempt.score = sum(awardedMarks)
attempt.status = GRADED, unless any answer NEEDS_REVIEW
```

- **Objective** = instant, deterministic, no AI, always correct.
- **Subjective** = AI-assisted with a confidence threshold; anything uncertain
  is queued for teacher review. Teachers can override any mark (`GradedBy.TEACHER`).

---

## 4. AI provider interface (pluggable, decide host later)

```ts
// src/lib/ai/provider.ts
export interface GeneratedQuestion { /* type, prompt, options, answer, marks, difficulty, explanation */ }

export interface AiProvider {
  readonly enabled: boolean;
  generateQuestions(input: {
    board: string; klass: string; subject: string; chapter: string;
    sourceText?: string;                 // extracted chapter PDF text
    counts: Partial<Record<QuestionType, number>>;
    difficultyMix?: Record<Difficulty, number>;
  }): Promise<GeneratedQuestion[]>;

  gradeAnswer(input: {
    prompt: string; modelAnswer?: string; rubric?: string;
    studentAnswer: string; maxMarks: number;
  }): Promise<{ marks: number; feedback: string; confidence: number }>;
}
```

Implementations (added when you decide):
- `OllamaProvider` — POSTs to a local Ollama server (`OLLAMA_URL`, `OLLAMA_MODEL`),
  using JSON-schema-constrained output.
- `OpenAiCompatibleProvider` — any hosted open-model endpoint (`AI_BASE_URL`,
  `AI_API_KEY`, `AI_MODEL`).
- `NullProvider` — `enabled = false`; engine runs manual-only.

Selected via `AI_PROVIDER=ollama|openai_compatible|none` env. **No engine code
changes** to switch.

---

## 5. AI generation pipeline (DRAFT → approve → publish)

1. Admin clicks **"Generate questions"** on a chapter (or subject).
2. Server gathers context: board/class/subject/chapter names + extracts text
   from the chapter's uploaded PDFs in R2 (`pdf-parse`).
3. `aiProvider.generateQuestions(...)` returns structured questions.
4. Stored as `Question{ source: AI, status: DRAFT }` (+ options).
5. Admin reviews in a **"Review AI questions"** screen → edit / approve / reject.
   Approve → `status: PUBLISHED`.
6. Published questions become available to build assessments and to students.

Runs as a **background job** (BullMQ+Redis or `node-cron` worker) so large
generations don't block the request. Job status surfaced in the admin UI.

---

## 6. Activity types (all the same engine)

| Feature            | Assessment.type | scope           | grading           | scheduling            |
|--------------------|-----------------|-----------------|-------------------|-----------------------|
| Daily activity     | DAILY           | chapter         | auto              | `scheduledFor` = date, cron picks/assembles a small set from the bank |
| Important Q&A      | (not an attempt)| chapter         | —                 | just PUBLISHED questions with explanations, shown as study notes |
| Assignment         | ASSIGNMENT      | chapter/subject | auto + AI + review| `dueAt`               |
| Quiz               | QUIZ            | chapter         | auto              | on-demand / timed     |
| Board exam         | EXAM            | whole subject   | auto + AI + **mandatory teacher review** | `scheduledFor`, `timeLimitSec` |

A **daily scheduler** (cron) assembles the day's DAILY assessment per chapter by
sampling the published question bank by difficulty; students get a fresh set
and we track streaks.

---

## 7. API surface (all under the two-level guard)

**Admin (SUPER_ADMIN):**
- `POST /api/admin/questions` (manual create) · `GET/PATCH/DELETE .../:id`
- `POST /api/admin/questions/generate` (kick off AI job) · `GET /api/admin/questions?status=DRAFT`
- `POST /api/admin/questions/:id/approve`
- `POST /api/admin/assessments` (+ attach questions) · `GET/PATCH .../:id` · publish
- `GET /api/admin/attempts?status=NEEDS_REVIEW` · `POST /api/admin/attempts/:id/grade` (override)

**Student (STUDENT, own class only):**
- `GET /api/content/assessments?type=DAILY|QUIZ|ASSIGNMENT|EXAM&chapterId=`
- `POST /api/content/assessments/:id/start` → creates Attempt
- `POST /api/content/attempts/:id/answer` (save answers)
- `POST /api/content/attempts/:id/submit` → auto-grade, return score + feedback
- `GET /api/content/attempts/:id/result`
- `GET /api/content/chapters/:id/qna` (important Q&A study view)

---

## 8. Open-source stack

| Concern            | Open-source choice                                  |
|--------------------|-----------------------------------------------------|
| LLM (gen + grade)  | **Ollama** (Apache-2.0) + Llama 3.1 / Qwen2.5 / Mistral — local, offline, free; or any OpenAI-compatible open-model server |
| PDF → text         | `pdf-parse` / `pdfjs-dist`                           |
| Semantic grading   | `pgvector` (Postgres ext) + `nomic-embed-text` embeddings (via Ollama) |
| Background jobs    | `node-cron` (simple) or BullMQ + Redis (scale)      |
| Structured output  | JSON-schema-constrained prompts (Ollama `format: json`) |

All free and self-hostable — consistent with the "offline study / open-source
for now" goal.

---

## 9. Phased rollout

- **Phase 1 — Engine (no AI):** models above, manual question authoring in
  admin, assessment builder, student attempt + **objective auto-grade**,
  results UI. Immediately usable; foundation for everything.
- **Phase 2 — AI generation:** `AiProvider` + chosen implementation, PDF
  extraction, generate → DRAFT → approve flow, generation jobs.
- **Phase 3 — Subjective grading + exams:** AI grading with confidence +
  teacher-review queue, board-exam flow, daily scheduler + streaks,
  student analytics (scores over time, weak chapters).

Each phase ships independently and is DB-driven end to end.

---

## 10. Honest limitations

- Subjective AI grading is ~85–90% reliable → always keep teacher override;
  never auto-finalize board-exam subjective marks.
- AI-generated questions can contain errors → the DRAFT→approve gate is
  mandatory, not optional.
- Generation quality depends on model size and on real chapter text being
  uploaded (title-only generation is weaker).
- Local LLMs need compute (a GPU or a capable CPU) for reasonable latency;
  generation is therefore a background job, not a blocking request.
```
