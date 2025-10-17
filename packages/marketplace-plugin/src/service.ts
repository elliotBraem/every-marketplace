import { and, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import Redis from "ioredis";

import { db } from "./db/index";
import * as schema from "./db/schema";
import {
  AddToCollectionInput,
  CategoryOutput,
  CollectionInput,
  CollectionOutput,
  PaginationInput,
  ProductFilters,
  ProductInput,
  ProductOutput,
  ProductUpdate,
  SearchQuery,
  SellerInput,
  SellerOutput,
  TrackViewInput,
  TrendingInput,
} from "./schemas/marketplace";

export class MarketplaceError extends Error {
  readonly _tag = "MarketplaceError" as const;
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}

/**
 * Marketplace Service class replacing RSSService.
 * Handles all marketplace operations using Drizzle ORM with optional Redis caching.
 */
export class MarketplaceService {
  private redis?: Redis;

  constructor(
    private drizzleDb = db,
    redisUrlOrClient?: string | Redis
  ) {
    if (typeof redisUrlOrClient === "string") {
      this.redis = new Redis(redisUrlOrClient);
    } else if (redisUrlOrClient) {
      this.redis = redisUrlOrClient;
    }
  }

  // ===== PRODUCTS =====

  getProducts(filters?: PaginationInput & ProductFilters) {
    return Effect.tryPromise({
      try: async () => {
        const { limit = 50, offset = 0, sellerId, categoryId, minPrice, maxPrice, availability, search } = filters || {};

        let query = this.drizzleDb.select().from(schema.products).$dynamic();

        // Apply filters
        const conditions = [];

        if (sellerId) conditions.push(eq(schema.products.sellerId, sellerId));
        if (minPrice) conditions.push(gte(schema.products.price, minPrice));
        if (maxPrice) conditions.push(lte(schema.products.price, maxPrice));
        if (availability) conditions.push(eq(schema.products.availability, availability));
        if (search) conditions.push(ilike(schema.products.name, `%${search}%`));

        if (categoryId) {
          query = query.where(
            and(
              ...conditions,
              sql`${schema.products.id} IN (
                SELECT ${schema.productCategories.productId}
                FROM ${schema.productCategories}
                WHERE ${schema.productCategories.categoryId} = ${categoryId}
              )`
            )
          );
        } else if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        const results = await query.limit(limit).offset(offset).orderBy(desc(schema.products.createdAt));
        return results.map(result => ProductOutput.parse(result));
      },
      catch: (error) => new MarketplaceError("Failed to get products", error)
    });
  }

  getProduct(id: string, includeImages = true, includeCategories = true) {
    return Effect.tryPromise({
      try: async () => {
        const product = await this.drizzleDb
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, id))
          .limit(1);

        if (product.length === 0) return null;
        const result = ProductOutput.parse(product[0]);

        if (includeImages) {
          const images = await this.drizzleDb
            .select()
            .from(schema.productImages)
            .where(eq(schema.productImages.productId, id))
            .orderBy(schema.productImages.position);

          result.images = images.map(img => img);
        }

        if (includeCategories) {
          const categoryIds = await this.drizzleDb
            .select({ categoryId: schema.productCategories.categoryId })
            .from(schema.productCategories)
            .where(eq(schema.productCategories.productId, id));

          if (categoryIds.length > 0) {
            const categories = await this.drizzleDb
              .select({ id: schema.categories.id, name: schema.categories.name })
              .from(schema.categories)
              .where(inArray(schema.categories.id, categoryIds.map(c => c.categoryId)));

            result.categories = categories;
          }
        }

        return ProductOutput.parse(result);
      },
      catch: (error) => new MarketplaceError(`Failed to get product ${id}`, error)
    });
  }

  createProduct(input: ProductInput) {
    return Effect.tryPromise({
      try: async () => {
        const productId = crypto.randomUUID();

        // Insert product
        await this.drizzleDb.insert(schema.products).values({
          id: productId,
          sellerId: input.sellerId,
          name: input.name,
          description: input.description,
          price: input.price,
          currency: input.currency,
          availability: input.availability,
          stockQuantity: input.stockQuantity,
          sku: input.sku,
          gtin: input.gtin,
          brand: input.brand,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Insert images
        if (input.images && input.images.length > 0) {
          const imageInserts = input.images.map((img, i) => ({
            id: crypto.randomUUID(),
            productId,
            url: img.url,
            position: img.position ?? i,
            width: img.width,
            height: img.height,
            caption: img.caption,
          }));

          await this.drizzleDb.insert(schema.productImages).values(imageInserts);
        }

        // Insert category relationships
        if (input.categoryIds && input.categoryIds.length > 0) {
          const categoryInserts = input.categoryIds.map(categoryId => ({
            productId,
            categoryId,
          }));

          await this.drizzleDb.insert(schema.productCategories).values(categoryInserts);
        }

        return productId;
      },
      catch: (error) => new MarketplaceError("Failed to create product", error)
    });
  }

  updateProduct(id: string, updates: ProductUpdate) {
    return Effect.tryPromise({
      try: async () => {
        const values: any = {
          updatedAt: new Date(),
        };

        if (updates.name !== undefined) values.name = updates.name;
        if (updates.description !== undefined) values.description = updates.description;
        if (updates.price !== undefined) values.price = updates.price;
        if (updates.currency !== undefined) values.currency = updates.currency;
        if (updates.availability !== undefined) values.availability = updates.availability;
        if (updates.stockQuantity !== undefined) values.stockQuantity = updates.stockQuantity;
        if (updates.sku !== undefined) values.sku = updates.sku;
        if (updates.gtin !== undefined) values.gtin = updates.gtin;
        if (updates.brand !== undefined) values.brand = updates.brand;

        if (Object.keys(values).length > 1) { // more than just updatedAt
          await this.drizzleDb
            .update(schema.products)
            .set(values)
            .where(eq(schema.products.id, id));
        }

        return { success: true };
      },
      catch: (error) => new MarketplaceError(`Failed to update product ${id}`, error)
    });
  }

  deleteProduct(id: string) {
    return Effect.tryPromise({
      try: async () => {
        // Foreign keys with CASCADE should handle image and category deletions
        await this.drizzleDb
          .delete(schema.products)
          .where(eq(schema.products.id, id));

        return { success: true };
      },
      catch: (error) => new MarketplaceError(`Failed to delete product ${id}`, error)
    });
  }

  searchProducts(query: SearchQuery) {
    // This would be a streaming implementation
    // For now, use regular getProducts with search filter
    return Effect.tryPromise({
      try: async () => {
        const filters: PaginationInput & ProductFilters = {
          limit: 50,
          offset: 0,
          ...query.filters
        };
        return await this.getProducts(filters).pipe(Effect.runPromise);
      },
      catch: (error) => new MarketplaceError("Failed to search products", error)
    });
  }

  // ===== COLLECTIONS =====

  getCollections(filters?: PaginationInput & { sellerId?: string }) {
    return Effect.tryPromise({
      try: async () => {
        const { limit = 50, offset = 0, sellerId } = filters || {};

        let query = this.drizzleDb.select().from(schema.collections).$dynamic();

        if (sellerId) {
          query = query.where(eq(schema.collections.sellerId, sellerId));
        }

        const results = await query
          .limit(limit)
          .offset(offset)
          .orderBy(desc(schema.collections.createdAt));

        return results.map(result => CollectionOutput.parse(result));
      },
      catch: (error) => new MarketplaceError("Failed to get collections", error)
    });
  }

  getCollection(id: string, includeProducts = true) {
    return Effect.tryPromise({
      try: async () => {
        const collection = await this.drizzleDb
          .select()
          .from(schema.collections)
          .where(eq(schema.collections.id, id))
          .limit(1);

        if (collection.length === 0) return null;
        const result = CollectionOutput.parse(collection[0]);

        if (includeProducts) {
          // Get product IDs from collection_products ordered by position
          const productIds = await this.drizzleDb
            .select({ productId: schema.collectionProducts.productId })
            .from(schema.collectionProducts)
            .where(eq(schema.collectionProducts.collectionId, id))
            .orderBy(schema.collectionProducts.position);

          if (productIds.length > 0) {
            const products = [];
            for (const { productId } of productIds) {
              const product = await this.getProduct(productId, false, false).pipe(Effect.runPromise);
              if (product) products.push(product);
            }
            result.products = products;
          }
        }

        return result;
      },
      catch: (error) => new MarketplaceError(`Failed to get collection ${id}`, error)
    });
  }

  createCollection(input: CollectionInput) {
    return Effect.tryPromise({
      try: async () => {
        const collectionId = crypto.randomUUID();

        await this.drizzleDb.insert(schema.collections).values({
          id: collectionId,
          sellerId: input.sellerId,
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return collectionId;
      },
      catch: (error) => new MarketplaceError("Failed to create collection", error)
    });
  }

  addProductToCollection(input: AddToCollectionInput) {
    return Effect.tryPromise({
      try: async () => {
        // Check if already exists
        const existing = await this.drizzleDb
          .select()
          .from(schema.collectionProducts)
          .where(and(
            eq(schema.collectionProducts.collectionId, input.collectionId),
            eq(schema.collectionProducts.productId, input.productId)
          ))
          .limit(1);

        if (existing.length > 0) {
          // Just update position
          await this.drizzleDb
            .update(schema.collectionProducts)
            .set({ position: input.position })
            .where(and(
              eq(schema.collectionProducts.collectionId, input.collectionId),
              eq(schema.collectionProducts.productId, input.productId)
            ));
        } else {
          await this.drizzleDb.insert(schema.collectionProducts).values({
            collectionId: input.collectionId,
            productId: input.productId,
            position: input.position,
          });
        }

        return { success: true };
      },
      catch: (error) => new MarketplaceError("Failed to add product to collection", error)
    });
  }

  removeProductFromCollection(collectionId: string, productId: string) {
    return Effect.tryPromise({
      try: async () => {
        await this.drizzleDb
          .delete(schema.collectionProducts)
          .where(and(
            eq(schema.collectionProducts.collectionId, collectionId),
            eq(schema.collectionProducts.productId, productId)
          ));

        return { success: true };
      },
      catch: (error) => new MarketplaceError("Failed to remove product from collection", error)
    });
  }

  // ===== SELLERS =====

  getSellers(pagination?: PaginationInput) {
    return Effect.tryPromise({
      try: async () => {
        const { limit = 50, offset = 0 } = pagination || {};

        const results = await this.drizzleDb
          .select()
          .from(schema.sellers)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(schema.sellers.createdAt));

        return results.map(result => SellerOutput.parse(result));
      },
      catch: (error) => new MarketplaceError("Failed to get sellers", error)
    });
  }

  getSeller(id: string) {
    return Effect.tryPromise({
      try: async () => {
        const seller = await this.drizzleDb
          .select()
          .from(schema.sellers)
          .where(eq(schema.sellers.id, id))
          .limit(1);

        if (seller.length === 0) return null;
        return SellerOutput.parse(seller[0]);
      },
      catch: (error) => new MarketplaceError(`Failed to get seller ${id}`, error)
    });
  }

  createSeller(input: SellerInput) {
    return Effect.tryPromise({
      try: async () => {
        const sellerId = crypto.randomUUID();

        await this.drizzleDb.insert(schema.sellers).values({
          id: sellerId,
          name: input.name,
          description: input.description,
          logoUrl: input.logoUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return sellerId;
      },
      catch: (error) => new MarketplaceError("Failed to create seller", error)
    });
  }

  getSellerProducts(sellerId: string, pagination?: PaginationInput) {
    return Effect.tryPromise({
      try: async () => {
        return await this.getProducts({
          limit: pagination?.limit ?? 50,
          offset: pagination?.offset ?? 0,
          sellerId
        }).pipe(Effect.runPromise);
      },
      catch: (error) => new MarketplaceError(`Failed to get products for seller ${sellerId}`, error)
    });
  }

  getSellerCollections(sellerId: string) {
    return Effect.tryPromise({
      try: async () => {
        return await this.getCollections({
          limit: 50,
          offset: 0,
          sellerId
        }).pipe(Effect.runPromise);
      },
      catch: (error) => new MarketplaceError(`Failed to get collections for seller ${sellerId}`, error)
    });
  }

  // ===== CATEGORIES =====

  getCategories(parentId?: string) {
    return Effect.tryPromise({
      try: async () => {
        let query = this.drizzleDb.select().from(schema.categories).$dynamic();

        if (parentId !== undefined) {
          query = query.where(parentId
            ? eq(schema.categories.parentId, parentId)
            : eq(schema.categories.parentId, sql`NULL`)
          );
        }

        const results = await query.orderBy(schema.categories.name);
        return results.map(result => CategoryOutput.parse(result));
      },
      catch: (error) => new MarketplaceError("Failed to get categories", error)
    });
  }

  getCategory(id: string) {
    return Effect.tryPromise({
      try: async () => {
        const category = await this.drizzleDb
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.id, id))
          .limit(1);

        if (category.length === 0) return null;
        return CategoryOutput.parse(category[0]);
      },
      catch: (error) => new MarketplaceError(`Failed to get category ${id}`, error)
    });
  }

  getProductsByCategory(categoryId: string, pagination?: PaginationInput) {
    return Effect.tryPromise({
      try: async () => {
        return await this.getProducts({
          limit: pagination?.limit ?? 50,
          offset: pagination?.offset ?? 0,
          categoryId
        }).pipe(Effect.runPromise);
      },
      catch: (error) => new MarketplaceError(`Failed to get products for category ${categoryId}`, error)
    });
  }

  // ===== ANALYTICS/TRACKING =====

  trackProductView(input: TrackViewInput) {
    return Effect.tryPromise({
      try: async () => {
        if (!this.redis) return { success: true };

        const now = Date.now();
        const timeWindows = ['1h', '24h', '7d', '30d'];

        // Track in all time windows
        for (const window of timeWindows) {
          await this.redis.zadd(`marketplace:trending:${window}`, now, input.productId);
        }

        return { success: true };
      },
      catch: (error) => new MarketplaceError(`Failed to track view for product ${input.productId}`, error)
    });
  }

  getTrendingProducts(input: TrendingInput) {
    return Effect.tryPromise({
      try: async () => {
        if (!this.redis) return [];

        const { timeWindow, categoryId, limit } = input;
        const now = Date.now();
        const cutoffTime = now - (this.getTimeWindowSeconds(timeWindow) * 1000);

        // Get trending product IDs
        let trendingIds: string[];
        if (categoryId) {
          // For category-specific trending, we would need to filter by category
          // This is simplified - in reality, you'd need to cross-reference categories
          trendingIds = await this.redis.zrevrangebyscore(
            `marketplace:trending:${timeWindow}`,
            '+inf',
            cutoffTime,
            'LIMIT',
            0,
            limit * 2 // Get more to filter
          );
        } else {
          trendingIds = await this.redis.zrevrangebyscore(
            `marketplace:trending:${timeWindow}`,
            '+inf',
            cutoffTime,
            'LIMIT',
            0,
            limit
          );
        }

        // Get product details
        const products: ProductOutput[] = [];
        for (const productId of trendingIds) {
          const product = await this.getProduct(productId, false, false).pipe(Effect.runPromise);
          if (product) {
            if (categoryId && !product.categories?.some(cat => cat.id === categoryId)) {
              continue; // Skip products not in this category
            }
            products.push(product);
            if (products.length >= limit) break;
          }
        }

        return products;
      },
      catch: (error) => new MarketplaceError("Failed to get trending products", error)
    });
  }

  // ===== STATS =====

  getStats() {
    return Effect.tryPromise({
      try: async () => {
        const [productStats, collectionStats, sellerStats, categoryStats] = await Promise.all([
          this.drizzleDb.$count(schema.products),
          this.drizzleDb.$count(schema.collections),
          this.drizzleDb.$count(schema.sellers),
          this.drizzleDb.$count(schema.categories),
        ]);

        return {
          totalProducts: productStats,
          totalCollections: collectionStats,
          totalSellers: sellerStats,
          totalCategories: categoryStats,
        };
      },
      catch: (error) => new MarketplaceError("Failed to get stats", error)
    });
  }

  // ===== UTILS =====

  healthCheck() {
    return Effect.tryPromise({
      try: () => Promise.resolve("OK"),
      catch: (error) => new MarketplaceError("Health check failed", error)
    });
  }

  private getTimeWindowSeconds(timeWindow: '1h' | '24h' | '7d' | '30d'): number {
    switch (timeWindow) {
      case '1h': return 3600;
      case '24h': return 86400;
      case '7d': return 604800;
      case '30d': return 2592000;
      default: return 86400;
    }
  }
}
