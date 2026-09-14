import 'server-only';
import postgres from 'postgres';
import { env } from './env';

function connect() {
  const { DATABASE_URL, DATABASE_SSL } = env();
  return postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    // Même réglage que l'API : le proxy TCP Railway présente un certificat auto-signé.
    ssl: DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : false,
    connection: { application_name: 'mk-admin', statement_timeout: 10_000 },
    transform: { ...postgres.camel, undefined: null },
  });
}

export type Sql = ReturnType<typeof connect>;

// Un seul pool par processus, y compris à travers le rechargement à chaud de `next dev`.
const globalForDb = globalThis as typeof globalThis & { mkAdminSql?: Sql };

export function db(): Sql {
  return (globalForDb.mkAdminSql ??= connect());
}
