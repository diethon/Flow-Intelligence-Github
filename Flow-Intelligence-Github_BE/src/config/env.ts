import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),
  ENCRYPTION_SALT: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.6-flash'),
  GEMINI_FALLBACK_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missingFields = error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${missingFields}`);
  }
  throw error;
}

export default env;
