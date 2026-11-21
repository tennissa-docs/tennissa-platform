import "server-only";
import postgres from "postgres";
import { env } from "./env";

// The app connects as tennissa_app (a member of app_runtime): it can read, add and update,
// but cannot delete, truncate, alter tables or switch off triggers. Never the owner or service role.
//
// Note: don't pass this client to drizzle(): drizzle's postgres-js driver replaces the client's date
// serializers, which breaks plain tagged-template queries. If typed Drizzle queries are added, give
// them their own postgres() instance.
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

function connect(): postgres.Sql {
  // bigint columns arrive as strings (never JS numbers); wrap them with BigInt() / toCents() before arithmetic.
  // infer: Dates go as timestamptz (v3 behaviour). `date` columns are always written as 'YYYY-MM-DD' strings.
  return postgres(env.databaseUrl, { max: 10, idle_timeout: 20, infer: true });
}

export const sql: postgres.Sql = globalForDb.__sql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

/** Either the pool or an open transaction. */
export type Tx = postgres.Sql | postgres.TransactionSql;
