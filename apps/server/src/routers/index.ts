import type { RouterClient } from "@orpc/server";
import { Effect } from "effect";
import { publicProcedure } from "../lib/orpc";
import { PluginRuntimeService } from "../services/plugin-runtime.service";

export const createAppRouter = Effect.gen(function* () {
  const runtime = yield* PluginRuntimeService;

  const { router: rssRouter } = yield* Effect.promise(() =>
    runtime.usePlugin("@curatedotfun/rss-plugin", {
      variables: {},
      secrets: { redisUrl: "{{REDIS_URL}}" }
    })
  );

  return publicProcedure.router({
    healthCheck: publicProcedure.handler(() => {
      return "OK";
    }),
    rss: rssRouter
  });
});

export type AppRouter = Awaited<ReturnType<typeof createAppRouter>>;
export type AppRouterClient = RouterClient<AppRouter>;
