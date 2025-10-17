import { z } from "every-plugin/zod";
import * as schema from "../db/schema";

// Base types inferred from Drizzle
export type Seller = typeof schema.sellers.$inferSelect;
export type Product = typeof schema.products.$inferSelect;
export type Collection = typeof schema.collections.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type ProductImage = typeof schema.productImages.$inferSelect;
export type CollectionProduct = typeof schema.collectionProducts.$inferSelect;

// === EXPLICIT OUTPUT TYPES ===
export type SellerOutputType = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ProductImageOutputType = {
  id: string;
  productId: string;
  url: string;
  position: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
};

export type ProductOutputType = {
  id: string;
  sellerId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  availability: string;
  sku: string | null;
  gtin: string | null;
  brand: string | null;
  stockQuantity: number | null;
  createdAt: string;
  updatedAt: string | null;
  seller?: SellerOutputType;
  images?: ProductImageOutputType[];
  categories?: { id: string; name: string }[];
};

export type CollectionOutputType = {
  id: string;
  sellerId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  products?: ProductOutputType[];
};

export type CategoryOutputType = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: CategoryOutputType[];
};

// === INPUT SCHEMAS ===
export const SellerInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
}).strict();

export const CategoryInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  parentId: z.string().nullable(),
}).strict();

export const CollectionInput = z.object({
  sellerId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
}).strict();

export const ProductInput = z.object({
  sellerId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().nullable(),
  price: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  availability: z.enum(["InStock", "OutOfStock", "PreOrder", "BackOrder"]).default("InStock"),
  stockQuantity: z.number().int().min(0).nullable(),
  sku: z.string().nullable(),
  gtin: z.string().nullable(),
  brand: z.string().nullable(),
  images: z.array(z.object({
    url: z.string().url(),
    position: z.number().int().default(0),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    caption: z.string().nullable(),
  })).optional(),
  categoryIds: z.array(z.string()).optional(),
}).strict();

export const SellerUpdate = SellerInput.partial();
export const CategoryUpdate = CategoryInput.partial();
export const CollectionUpdate = CollectionInput.partial();
export const ProductUpdate = ProductInput.partial().omit({ images: true, categoryIds: true });

// === OUTPUT SCHEMAS ===
export const SellerOutput: z.ZodType<SellerOutputType> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const ProductImageOutput: z.ZodType<ProductImageOutputType> = z.object({
  id: z.string(),
  productId: z.string(),
  url: z.string(),
  position: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  caption: z.string().nullable(),
});

export const ProductOutput: z.ZodType<ProductOutputType> = z.object({
  id: z.string(),
  sellerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  availability: z.string(),
  sku: z.string().nullable(),
  gtin: z.string().nullable(),
  brand: z.string().nullable(),
  stockQuantity: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
}).extend({
  seller: SellerOutput.optional(),
  images: z.array(ProductImageOutput).optional(),
  categories: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});

export const CollectionOutput: z.ZodType<CollectionOutputType> = z.object({
  id: z.string(),
  sellerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
}).extend({
  products: z.array(ProductOutput).optional(),
});

export const CategoryOutput: z.ZodType<CategoryOutputType> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    parentId: z.string().nullable(),
  }).extend({
    children: z.array(CategoryOutput).optional(),
  })
);

// === PRODUCT IMAGE SCHEMAS ===
export const ProductImageInput = z.object({
  productId: z.string(),
  url: z.string().url(),
  position: z.number().int().default(0),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  caption: z.string().nullable(),
}).strict();

export const ProductImageUpdate = ProductImageInput.partial();

// === PAGINATION & FILTERS ===
export const PaginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
}).strict();

export const ProductFilters = z.object({
  sellerId: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  availability: z.enum(["InStock", "OutOfStock", "PreOrder", "BackOrder"]).optional(),
  search: z.string().optional(),
}).strict();

// === SEARCH & ANALYTICS ===
export const SearchQuery = z.object({
  query: z.string().min(1).max(100),
  filters: ProductFilters.optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

export const TrendingInput = z.object({
  timeWindow: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
  categoryId: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const TrackViewInput = z.object({
  productId: z.string(),
}).strict();

// === COLLECTION MANAGEMENT ===
export const AddToCollectionInput = z.object({
  collectionId: z.string(),
  productId: z.string(),
  position: z.number().int().default(0),
}).strict();

// === TYPE EXPORTS ===
export type SellerInput = z.infer<typeof SellerInput>;
export type SellerOutput = z.infer<typeof SellerOutput>;
export type CategoryInput = z.infer<typeof CategoryInput>;
export type CategoryOutput = z.infer<typeof CategoryOutput>;
export type CollectionInput = z.infer<typeof CollectionInput>;
export type CollectionOutput = z.infer<typeof CollectionOutput>;
export type ProductInput = z.infer<typeof ProductInput>;
export type ProductUpdate = z.infer<typeof ProductUpdate>;
export type ProductOutput = z.infer<typeof ProductOutput>;
export type ProductImageInput = z.infer<typeof ProductImageInput>;
export type ProductImageOutput = z.infer<typeof ProductImageOutput>;
export type PaginationInput = z.infer<typeof PaginationInput>;
export type ProductFilters = z.infer<typeof ProductFilters>;
export type SearchQuery = z.infer<typeof SearchQuery>;
export type TrendingInput = z.infer<typeof TrendingInput>;
export type TrackViewInput = z.infer<typeof TrackViewInput>;
export type AddToCollectionInput = z.infer<typeof AddToCollectionInput>;
