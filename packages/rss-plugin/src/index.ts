import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { implement } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { RssService } from "./service";

/**
 * RSS Plugin - Unified RSS feed management providing consistent RSS operations.
 *
 * Access to feeds, items, categories, trending, and RSS/Atom generation.
 */
export default createPlugin({
  id: "@curatedotfun/rss-plugin",

  variables: z.object({
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({
    redisUrl: z.string().default("redis://localhost:6379"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new RssService(config.secrets.redisUrl);
      yield* service.healthCheck();
      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context) => {
    const os = implement(contract);

    // Wire up all handlers using the service
    return os.router({
      healthCheck: os.healthCheck.handler(async () => {
        return await Effect.runPromise(context.service.healthCheck());
      }),

      getFeeds: os.getFeeds.handler(async () => {
        return await Effect.runPromise(context.service.getFeeds());
      }),

      getFeed: os.getFeed.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeed(input.feedId));
      }),

      getFeedItems: os.getFeedItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedItems(input.feedId));
      }),

      getFeedItem: os.getFeedItem.handler(async ({ input, errors }) => {
        const [item, feed] = await Effect.runPromise(
          Effect.all([
            context.service.getFeedItem(input.feedId, input.itemId),
            context.service.getFeed(input.feedId)
          ])
        );

        if (!feed) {
          throw errors.NOT_FOUND({
            message: `Feed ${input.feedId} not found`
          });
        }

        return {
          item,
          feedTitle: feed.options.title
        };
      }),

      getAllFeedItems: os.getAllFeedItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getAllFeedItems(input || {}));
      }),

      getAllCategories: os.getAllCategories.handler(async () => {
        return await Effect.runPromise(context.service.getAllCategories());
      }),

      getItemsByCategory: os.getItemsByCategory.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getItemsByCategory(input.category, input));
      }),

      getFeedsByCategory: os.getFeedsByCategory.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedsByCategory(input.category));
      }),

      addFeed: os.addFeed.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.addFeed(input));
      }),

      addFeedItem: os.addFeedItem.handler(async ({ input }) => {
        const itemWithId = { ...input.item, id: crypto.randomUUID() };
        return await Effect.runPromise(context.service.addFeedItem(input.feedId, itemWithId));
      }),

      deleteFeed: os.deleteFeed.handler(async ({ input }) => {
        await Effect.runPromise(context.service.deleteFeed(input.feedId));
        return {
          success: true,
          message: `Feed ${input.feedId} successfully deleted`,
        };
      }),

      getTrendingItems: os.getTrendingItems.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getTrendingItems(input.timeWindow, input));
      }),

      getFeedTrending: os.getFeedTrending.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedTrending(input.feedId, input.timeWindow, input));
      }),

      trackItemView: os.trackItemView.handler(async ({ input }) => {
        await Effect.runPromise(context.service.trackItemView(input.itemId));
        return { success: true };
      }),

      getFeedRss: os.getFeedRss.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedRss(input.feedId));
      }),

      getFeedAtom: os.getFeedAtom.handler(async ({ input }) => {
        return await Effect.runPromise(context.service.getFeedAtom(input.feedId));
      }),

      getStats: os.getStats.handler(async () => {
        return await Effect.runPromise(context.service.getStats());
      }),
    });
  },
});
