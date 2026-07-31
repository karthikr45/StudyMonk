import { env } from '../env';

export type GenType = 'MCQ' | 'TRUE_FALSE' | 'NUMERIC' | 'SHORT' | 'LONG';
export type GenDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface GeneratedQuestion {
  type: GenType;
  difficulty: GenDifficulty;
  marks: number;
  prompt: string;
  explanation?: string;
  options?: { text: string; isCorrect: boolean }[];
  numericAnswer?: number;
  modelAnswer?: string;
}

export interface GenerateInput {
  board: string;
  klass: string;
  subject: string;
  chapter: string;
  sourceText?: string;
  counts: Partial<Record<GenType, number>>;
  difficulty: GenDifficulty;
}

export interface GradeInput {
  prompt: string;
  modelAnswer?: string | null;
  rubric?: string | null;
  studentAnswer: string;
  maxMarks: number;
}

export interface GradeResult {
  marks: number;
  feedback: string;
  confidence: number; // 0..1
}

export interface AiProvider {
  readonly enabled: boolean;
  readonly name: string;
  generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]>;
  gradeAnswer(input: GradeInput): Promise<GradeResult>;
}

// ---- Prompt builders -------------------------------------------------------

function generationPrompt(input: GenerateInput): string {
  const wanted = Object.entries(input.counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([t, n]) => `${n} ${t}`)
    .join(', ');
  const src = input.sourceText
    ? `Base the questions strictly on this chapter content:\n"""\n${input.sourceText.slice(0, 12000)}\n"""`
    : `Use standard ${input.board} ${input.klass} ${input.subject} syllabus knowledge for the chapter "${input.chapter}".`;

  return [
    `You are a CBSE ${input.subject} teacher creating exam questions for ${input.klass}, chapter "${input.chapter}".`,
    `Generate exactly: ${wanted}. Overall difficulty: ${input.difficulty}.`,
    src,
    `Return ONLY valid JSON: {"questions":[...]}. Each question object has:`,
    `- "type": one of MCQ | TRUE_FALSE | NUMERIC | SHORT | LONG`,
    `- "difficulty": EASY | MEDIUM | HARD`,
    `- "marks": integer`,
    `- "prompt": the question text`,
    `- "explanation": brief explanation of the answer`,
    `- MCQ: "options": array of {"text":string,"isCorrect":boolean} with exactly one correct`,
    `- TRUE_FALSE: "options": [{"text":"True","isCorrect":bool},{"text":"False","isCorrect":bool}]`,
    `- NUMERIC: "numericAnswer": number`,
    `- SHORT/LONG: "modelAnswer": a model answer string`,
    `No markdown, no commentary — JSON only.`,
  ].join('\n');
}

function gradingPrompt(input: GradeInput): string {
  return [
    `You are grading a CBSE exam answer out of ${input.maxMarks} marks.`,
    `Question: ${input.prompt}`,
    input.modelAnswer ? `Model answer: ${input.modelAnswer}` : '',
    input.rubric ? `Rubric: ${input.rubric}` : '',
    `Student answer: ${input.studentAnswer}`,
    `Return ONLY JSON: {"marks": number (0..${input.maxMarks}), "feedback": string, "confidence": number (0..1)}.`,
  ].filter(Boolean).join('\n');
}

// Robustly pull a JSON object out of a model response.
function extractJson(text: string): any {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('Model did not return valid JSON');
}

function normalizeQuestions(parsed: any): GeneratedQuestion[] {
  const arr = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(arr)) throw new Error('No questions array in AI response');
  return arr
    .filter((q) => q && typeof q.prompt === 'string' && q.type)
    .map((q) => ({
      type: q.type,
      difficulty: q.difficulty ?? 'MEDIUM',
      marks: Number(q.marks) > 0 ? Math.round(Number(q.marks)) : 1,
      prompt: String(q.prompt),
      explanation: q.explanation ? String(q.explanation) : undefined,
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({ text: String(o.text), isCorrect: !!o.isCorrect }))
        : undefined,
      numericAnswer: q.numericAnswer != null ? Number(q.numericAnswer) : undefined,
      modelAnswer: q.modelAnswer ? String(q.modelAnswer) : undefined,
    }));
}

async function withTimeout(ms: number): Promise<AbortSignal> {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// ---- Implementations -------------------------------------------------------

class NullProvider implements AiProvider {
  enabled = false;
  name = 'none';
  async generateQuestions(): Promise<GeneratedQuestion[]> {
    throw new Error('AI provider is disabled. Set AI_PROVIDER in your environment.');
  }
  async gradeAnswer(): Promise<GradeResult> {
    throw new Error('AI provider is disabled. Set AI_PROVIDER in your environment.');
  }
}

class OllamaProvider implements AiProvider {
  enabled = true;
  name = 'ollama';
  constructor(private url: string, private model: string) {}

  private async chat(prompt: string, timeoutMs: number): Promise<string> {
    const res = await fetch(`${this.url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: await withTimeout(timeoutMs),
      body: JSON.stringify({
        model: this.model,
        format: 'json',
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const data = await res.json();
    return data?.message?.content ?? '';
  }
  async generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {
    return normalizeQuestions(extractJson(await this.chat(generationPrompt(input), 180000)));
  }
  async gradeAnswer(input: GradeInput): Promise<GradeResult> {
    const p = extractJson(await this.chat(gradingPrompt(input), 60000));
    return { marks: clamp(Number(p.marks), 0, input.maxMarks), feedback: String(p.feedback ?? ''), confidence: clamp(Number(p.confidence), 0, 1) };
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  enabled = true;
  name = 'openai_compatible';
  constructor(private baseUrl: string, private apiKey: string, private model: string) {}

  private async chat(prompt: string, timeoutMs: number): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      signal: await withTimeout(timeoutMs),
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`AI endpoint error ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
  async generateQuestions(input: GenerateInput): Promise<GeneratedQuestion[]> {
    return normalizeQuestions(extractJson(await this.chat(generationPrompt(input), 180000)));
  }
  async gradeAnswer(input: GradeInput): Promise<GradeResult> {
    const p = extractJson(await this.chat(gradingPrompt(input), 60000));
    return { marks: clamp(Number(p.marks), 0, input.maxMarks), feedback: String(p.feedback ?? ''), confidence: clamp(Number(p.confidence), 0, 1) };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

let cached: AiProvider | null = null;

/** Resolve the configured provider (cached). */
export function aiProvider(): AiProvider {
  if (cached) return cached;
  const e = env();
  const model = e.AI_MODEL ?? 'llama3.1';
  if (e.AI_PROVIDER === 'ollama' && e.OLLAMA_URL) {
    cached = new OllamaProvider(e.OLLAMA_URL, model);
  } else if (e.AI_PROVIDER === 'openai_compatible' && e.AI_BASE_URL && e.AI_API_KEY) {
    cached = new OpenAiCompatibleProvider(e.AI_BASE_URL, e.AI_API_KEY, model);
  } else {
    cached = new NullProvider();
  }
  return cached;
}
