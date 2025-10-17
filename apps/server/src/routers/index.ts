import { Effect } from "effect";
import { protectedProcedure, publicProcedure } from "../lib/orpc";
import { PluginRuntimeService } from "../services/plugin-runtime.service";

export const createAppRouter = Effect.gen(function* () {
  const runtime = yield* PluginRuntimeService;

  const { router: marketplaceRouter } = yield* Effect.promise(() =>
    runtime.usePlugin("@near-everything/marketplace-plugin", {
      variables: {
        timeout: 10000
      },
      secrets: {
        databaseUrl: "{{DATABASE_URL}}",
        databaseAuthToken: "{{DATABASE_AUTH_TOKEN}}",
        redisUrl: "{{REDIS_URL}}"
      }
    })
  );

  return publicProcedure.router({
    healthCheck: publicProcedure.handler(() => {
      return "OK";
    }),
    marketplace: {
      ...marketplaceRouter,

      products: {
        ...marketplaceRouter.products,
        ...protectedProcedure.router({
          createProduct: marketplaceRouter.products.createProduct,
          updateProduct: marketplaceRouter.products.updateProduct,
          deleteProduct: marketplaceRouter.products.deleteProduct,
        })
      },
      collections: {
        ...marketplaceRouter.collections,
        ...protectedProcedure.router({
          createCollection: marketplaceRouter.collections.createCollection,
          addProductToCollection: marketplaceRouter.collections.addProductToCollection,
          removeProductToCollection: marketplaceRouter.collections.removeProductToCollection,
        })
      },
      sellers: {
        ...marketplaceRouter.sellers,
        ...protectedProcedure.router({
          createSeller: marketplaceRouter.sellers.createSeller,
        })
      },
    }
  });
});
