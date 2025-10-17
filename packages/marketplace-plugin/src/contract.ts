import { CommonPluginErrors } from "every-plugin";
import { AnyContractRouter, eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import {
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
  TrendingInput
} from "./schemas/marketplace";

const GetProductsInput = PaginationInput.extend(ProductFilters).optional();
const GetCollectionsInput = PaginationInput.extend(z.object({
  sellerId: z.string().optional(),
})).optional();

// Health check router
const healthRouter = oc.router({
  healthCheck: oc
    .route({ method: 'GET', path: '/health' })
    .output(z.string())
    .errors(CommonPluginErrors),
});

// Products router
const productsRouter = oc.router({
  getProducts: oc
    .route({ method: 'GET', path: '/products' })
    .input(GetProductsInput)
    .output(z.array(ProductOutput))
    .errors(CommonPluginErrors),

  getProduct: oc
    .route({ method: 'GET', path: '/products/{productId}' })
    .input(z.object({
      productId: z.string(),
      includeImages: z.boolean().default(true),
      includeCategories: z.boolean().default(true),
    }))
    .output(ProductOutput.nullable())
    .errors(CommonPluginErrors),

  createProduct: oc
    .route({ method: 'POST', path: '/products' })
    .input(ProductInput)
    .output(z.object({ id: z.string() }))
    .errors(CommonPluginErrors),

  updateProduct: oc
    .route({ method: 'PATCH', path: '/products/{productId}' })
    .input(z.object({
      productId: z.string(),
      updates: ProductUpdate,
    }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),

  deleteProduct: oc
    .route({ method: 'DELETE', path: '/products/{productId}' })
    .input(z.object({ productId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),

  searchProducts: oc
    .route({ method: 'GET', path: '/search' })
    .input(SearchQuery)
    .output(eventIterator(ProductOutput))
    .errors(CommonPluginErrors),
});

// Collections router
const collectionsRouter = oc.router({
  getCollections: oc
    .route({ method: 'GET', path: '/collections' })
    .input(GetCollectionsInput)
    .output(z.array(CollectionOutput))
    .errors(CommonPluginErrors),

  getCollection: oc
    .route({ method: 'GET', path: '/collections/{collectionId}' })
    .input(z.object({
      collectionId: z.string(),
      includeProducts: z.boolean().default(true),
    }))
    .output(CollectionOutput.nullable())
    .errors(CommonPluginErrors),

  createCollection: oc
    .route({ method: 'POST', path: '/collections' })
    .input(CollectionInput)
    .output(z.object({ id: z.string() }))
    .errors(CommonPluginErrors),

  addProductToCollection: oc
    .route({ method: 'POST', path: '/collections/{collectionId}/products' })
    .input(z.object({
      collectionId: z.string(),
      productId: z.string(),
      position: z.number().int().default(0),
    }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),

  removeProductFromCollection: oc
    .route({ method: 'DELETE', path: '/collections/{collectionId}/products/{productId}' })
    .input(z.object({
      collectionId: z.string(),
      productId: z.string(),
    }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),
});

// Sellers router
const sellersRouter = oc.router({
  getSellers: oc
    .route({ method: 'GET', path: '/sellers' })
    .input(PaginationInput.optional())
    .output(z.array(SellerOutput))
    .errors(CommonPluginErrors),

  getSeller: oc
    .route({ method: 'GET', path: '/sellers/{sellerId}' })
    .input(z.object({ sellerId: z.string() }))
    .output(SellerOutput.nullable())
    .errors(CommonPluginErrors),

  createSeller: oc
    .route({ method: 'POST', path: '/sellers' })
    .input(SellerInput)
    .output(z.object({ id: z.string() }))
    .errors(CommonPluginErrors),

  getSellerProducts: oc
    .route({ method: 'GET', path: '/sellers/{sellerId}/products' })
    .input(z.object({
      sellerId: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .output(z.array(ProductOutput))
    .errors(CommonPluginErrors),

  getSellerCollections: oc
    .route({ method: 'GET', path: '/sellers/{sellerId}/collections' })
    .input(z.object({ sellerId: z.string() }))
    .output(z.array(CollectionOutput))
    .errors(CommonPluginErrors),
});

// Categories router
const categoriesRouter = oc.router({
  getCategories: oc
    .route({ method: 'GET', path: '/categories' })
    .input(z.object({ parentId: z.string().optional() }).optional())
    .output(z.array(CategoryOutput))
    .errors(CommonPluginErrors),

  getCategory: oc
    .route({ method: 'GET', path: '/categories/{categoryId}' })
    .input(z.object({ categoryId: z.string() }))
    .output(CategoryOutput.nullable())
    .errors(CommonPluginErrors),

  getProductsByCategory: oc
    .route({ method: 'GET', path: '/categories/{categoryId}/products' })
    .input(z.object({
      categoryId: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .output(z.array(ProductOutput))
    .errors(CommonPluginErrors),
});

// Analytics router
const analyticsRouter = oc.router({
  trackProductView: oc
    .route({ method: 'POST', path: '/products/{productId}/track-view' })
    .input(z.object({ productId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .errors(CommonPluginErrors),

  getTrendingProducts: oc
    .route({ method: 'GET', path: '/trending' })
    .input(TrendingInput)
    .output(z.array(ProductOutput))
    .errors(CommonPluginErrors),
});

// Stats router
const statsRouter = oc.router({
  getStats: oc
    .route({ method: 'GET', path: '/stats' })
    .output(z.object({
      totalProducts: z.number(),
      totalCollections: z.number(),
      totalSellers: z.number(),
      totalCategories: z.number(),
    }))
    .errors(CommonPluginErrors),
});

export const contract = oc.router({
  ...healthRouter,
  products: productsRouter,
  collections: collectionsRouter,
  sellers: sellersRouter,
  categories: categoriesRouter,
  analytics: analyticsRouter,
  ...statsRouter,
});
