import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import { MarketplaceService } from "./service";
import * as schema from "./db/schema";

/**
 * Marketplace Plugin - Unified marketplace providing e-commerce operations.
 *
 * Access to products, collections, sellers, categories, trending, and analytics.
 */
export default createPlugin({
  id: "@near-everything/marketplace-plugin",

  variables: z.object({
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({
    databaseUrl: z.string().default("file:./marketplace.db"),
    databaseAuthToken: z.string().optional(),
    redisUrl: z.string().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create database client and run migrations
      const client = yield* Effect.acquireRelease(
        Effect.sync(() => createClient({
          url: config.secrets.databaseUrl,
          authToken: config.secrets.databaseAuthToken,
        })),
        (client) => Effect.sync(() => client.close())
      );

      const db = drizzle({ client, schema });

      // Test connection
      yield* Effect.tryPromise({
        try: () => client.execute("SELECT 1"),
        catch: (error) => new Error(`Database connection failed: ${error}`)
      });

      // Run migrations
      yield* Effect.tryPromise({
        try: () =>
          migrate(db, {
            migrationsFolder: "./migrations",
          }),
        catch: (error) => new Error(`Migration failed: ${error}`)
      });

      const service = new MarketplaceService(
        db,
        config.secrets.redisUrl
      );
      yield* service.healthCheck();
      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {

    return {
      healthCheck: builder.healthCheck.handler(async () => {
        return await Effect.runPromise(context.service.healthCheck());
      }),

      products: {
        getProducts: builder.products.getProducts.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getProducts(input));
        }),

        getProduct: builder.products.getProduct.handler(async ({ input }) => {
          return await Effect.runPromise(
            context.service.getProduct(input.productId, input.includeImages, input.includeCategories)
          );
        }),

        createProduct: builder.products.createProduct.handler(async ({ input }) => {
          const id = await Effect.runPromise(context.service.createProduct(input));
          return { id };
        }),

        updateProduct: builder.products.updateProduct.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.updateProduct(input.productId, input.updates));
        }),

        deleteProduct: builder.products.deleteProduct.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.deleteProduct(input.productId));
        }),

        searchProducts: builder.products.searchProducts.handler(async function* ({ input }) {
          // For now, use regular getProducts - can be upgraded to streaming later
          const results = await Effect.runPromise(context.service.searchProducts(input));
          yield* results; // Simple implementation - can be made truly streaming later
        }),
      },

      collections: {
        getCollections: builder.collections.getCollections.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getCollections(input));
        }),

        getCollection: builder.collections.getCollection.handler(async ({ input }) => {
          return await Effect.runPromise(
            context.service.getCollection(input.collectionId, input.includeProducts)
          );
        }),

        createCollection: builder.collections.createCollection.handler(async ({ input }) => {
          const id = await Effect.runPromise(context.service.createCollection(input));
          return { id };
        }),

        addProductToCollection: builder.collections.addProductToCollection.handler(async ({ input }) => {
          return await Effect.runPromise(
            context.service.addProductToCollection({
              collectionId: input.collectionId,
              productId: input.productId,
              position: input.position,
            })
          );
        }),

        removeProductFromCollection: builder.collections.removeProductFromCollection.handler(async ({ input }) => {
          return await Effect.runPromise(
            context.service.removeProductFromCollection(input.collectionId, input.productId)
          );
        }),
      },

      sellers: {
        getSellers: builder.sellers.getSellers.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getSellers(input));
        }),

        getSeller: builder.sellers.getSeller.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getSeller(input.sellerId));
        }),

        createSeller: builder.sellers.createSeller.handler(async ({ input }) => {
          const id = await Effect.runPromise(context.service.createSeller(input));
          return { id };
        }),

      getSellerProducts: builder.sellers.getSellerProducts.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getSellerProducts(input.sellerId, {
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
        }));
      }),

        getSellerCollections: builder.sellers.getSellerCollections.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getSellerCollections(input.sellerId));
        }),
      },

      categories: {
        getCategories: builder.categories.getCategories.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getCategories(input?.parentId));
        }),

        getCategory: builder.categories.getCategory.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getCategory(input.categoryId));
        }),

      getProductsByCategory: builder.categories.getProductsByCategory.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getProductsByCategory(input.categoryId, {
          limit: input.limit ?? 20,
          offset: input.offset ?? 0,
        }));
      }),
      },

      analytics: {
        trackProductView: builder.analytics.trackProductView.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.trackProductView({ productId: input.productId }));
        }),

        getTrendingProducts: builder.analytics.getTrendingProducts.handler(async ({ input }) => {
          return await Effect.runPromise(context.service.getTrendingProducts(input));
        }),
      },

      getStats: builder.getStats.handler(async () => {
        return await Effect.runPromise(context.service.getStats());
      }),
    };
  },
});
