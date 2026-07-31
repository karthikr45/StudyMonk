import { z } from 'zod';

/**
 * Centralised, validated environment access. Fail fast at startup if a
 * required secret is missing so we never silently run insecurely.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),

  API_GATEWAY_KEY: z.string().min(16, 'API_GATEWAY_KEY must be >= 16 chars'),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().url(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ---- AI provider (optional; open-source, pluggable) ----
  // AI_PROVIDER=none disables AI (engine runs manual-only).
  AI_PROVIDER: z.enum(['none', 'ollama', 'openai_compatible']).default('none'),
  AI_MODEL: z.string().optional(),
  // Ollama (local, open-source)
  OLLAMA_URL: z.string().url().optional(),
  // OpenAI-compatible open-model server
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
