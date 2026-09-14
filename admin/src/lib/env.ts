import 'server-only';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'doit être une URL postgres://'),
  DATABASE_SSL: z.enum(['require', 'disable']).default('require'),
});

let cached: z.infer<typeof schema> | undefined;

/** Lu à la première requête, pas à l'import : `next build` n'a besoin d'aucun secret. */
export function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(parsed.error)}`);
  }
  return (cached = parsed.data);
}
