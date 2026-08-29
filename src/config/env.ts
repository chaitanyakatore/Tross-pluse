import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val: string) => parseInt(val, 10)),
  LINKEDIN_LI_AT: z.string().optional().default(''),
  LINKEDIN_JSESSIONID: z.string().optional().default(''),
  USER_AGENT: z
    .string()
    .default(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ),
});

export const env = envSchema.parse(process.env);
