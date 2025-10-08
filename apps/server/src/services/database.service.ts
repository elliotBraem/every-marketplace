import { Effect, Context, Data, Config } from "effect";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Pool } from "pg";
import type { NodePgClient } from "drizzle-orm/node-postgres";

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
}> {}

export class DatabaseService extends Effect.Service<DatabaseService>()(
  "DatabaseService",
  {
    accessors: true,
    scoped: Effect.gen(function* () {
      const connectionString = yield* Config.string("DATABASE_URL");

      if (!connectionString) {
        yield* Effect.fail(
          new DatabaseError({ cause: "DATABASE_URL not configured" })
        );
      }

      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => new Pool({ connectionString })),
        (pool) => Effect.promise(() => pool.end())
      );

      const client = pool as unknown as NodePgClient;
      const db = drizzle(client);

      // Test connection
      yield* Effect.tryPromise({
        try: () => pool.query("SELECT 1"),
        catch: (error) => new DatabaseError({ cause: error }),
      });

      // Run migrations
      yield* Effect.tryPromise({
        try: () =>
          migrate(db, {
            migrationsFolder: `${process.cwd()}/migrations`,
          }),
        catch: (error) => new DatabaseError({ cause: error }),
      });

      return { db, pool };
    }),
    dependencies: [],
  }
) {}
