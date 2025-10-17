# Marketplace Plugin

A unified marketplace plugin for the every-plugin framework, providing complete e-commerce operations including products, collections, sellers, categories, and analytics.

## What's Included

```bash
src/
├── contract.ts         # oRPC contract with all marketplace procedures
├── service.ts          # MarketplaceService with Effect-based error handling
├── index.ts            # Plugin implementation with createPlugin
├── schemas/            # Zod schemas for marketplace entities
│   └── marketplace.ts
├── db/                 # Database layer
│   ├── schema.ts       # Drizzle schema definitions
│   └── migrations/     # SQL migrations
└── __tests__/          # Integration and unit tests
```

## Features

### Products
- **CRUD operations** - Create, read, update, delete products
- **Search & filtering** - Query by text, price range, category, seller
- **Image management** - Multiple images per product
- **Category associations** - Link products to hierarchical categories
- **Pagination** - Efficient data fetching with limit/offset

### Collections
- **Curated groups** - Organize products into collections
- **Seller collections** - Each seller can create their own collections
- **Product positioning** - Order products within collections
- **Batch operations** - Add/remove products efficiently

### Sellers
- **Multi-vendor support** - Multiple sellers on one platform
- **Seller profiles** - Store metadata, ratings, verification status
- **Product listings** - Get all products for a specific seller
- **Collection listings** - Get all collections for a specific seller

### Categories
- **Hierarchical structure** - Parent-child category relationships
- **Category metadata** - Names, descriptions, slugs
- **Product listings** - Get all products in a category
- **Nested navigation** - Query by parent category

### Analytics
- **View tracking** - Track product views
- **Trending products** - Get trending items by time window (24h, 7d, 30d)
- **Stats aggregation** - Total counts for products, collections, sellers, categories

## Database

Uses **LibSQL/Turso** (SQLite for the edge) with Drizzle ORM:
- Local development: `file:./marketplace.db`
- Production: Turso remote database
- Migrations: Automatic on plugin initialization

Schema includes:
- `products` - Core product data
- `product_images` - Multiple images per product
- `collections` - Product groupings
- `collection_products` - Many-to-many relationship
- `sellers` - Vendor information
- `categories` - Hierarchical categories
- `product_categories` - Product-category associations
- `product_views` - Analytics tracking

## Configuration

### Required Secrets

```typescript
{
  databaseUrl: "file:./marketplace.db" // or turso://...
  databaseAuthToken: "optional-for-turso",
  redisUrl: "optional-for-caching"
}
```

### Optional Variables

```typescript
{
  timeout: 10000 // Request timeout in milliseconds (1000-60000)
}
```

## Usage

### Local Development

```typescript
import { createLocalPluginRuntime } from "every-plugin/runtime";
import MarketplacePlugin from "@near-everything/marketplace-plugin";

const runtime = createLocalPluginRuntime(
  { registry: {} },
  { "marketplace": MarketplacePlugin }
);

const { client } = await runtime.usePlugin("marketplace", {
  variables: { timeout: 10000 },
  secrets: { 
    databaseUrl: "file:./marketplace.db"
  }
});

// Create a product
const product = await client.products.createProduct({
  name: "TypeScript Guide",
  description: "Complete guide to TypeScript",
  price: 29.99,
  sellerId: "seller-123",
  sku: "BOOK-001",
  stock: 100
});

// Search products
const results = client.products.searchProducts({
  query: "typescript",
  limit: 10,
  minPrice: 10,
  maxPrice: 50
});

for await (const product of results) {
  console.log(`${product.name}: $${product.price}`);
}

// Get trending products
const trending = await client.analytics.getTrendingProducts({
  window: "7d",
  limit: 10
});

console.log("Trending this week:", trending);
```

### Remote Production

```typescript
import { createPluginRuntime } from "every-plugin/runtime";

const runtime = createPluginRuntime({
  registry: {
    "@near-everything/marketplace-plugin": {
      remoteUrl: "https://cdn.example.com/marketplace/remoteEntry.js",
      version: "1.0.0"
    }
  },
  secrets: {
    TURSO_URL: process.env.TURSO_URL,
    TURSO_TOKEN: process.env.TURSO_TOKEN
  }
});

const { client } = await runtime.usePlugin("@near-everything/marketplace-plugin", {
  variables: { timeout: 30000 },
  secrets: { 
    databaseUrl: "{{TURSO_URL}}",
    databaseAuthToken: "{{TURSO_TOKEN}}"
  }
});
```

## API Reference

### Products Router
- `getProducts(filters?)` - List products with optional filtering
- `getProduct(id)` - Get single product with images/categories
- `createProduct(data)` - Create new product
- `updateProduct(id, updates)` - Update existing product
- `deleteProduct(id)` - Delete product
- `searchProducts(query)` - Stream search results

### Collections Router
- `getCollections(filters?)` - List collections
- `getCollection(id)` - Get single collection with products
- `createCollection(data)` - Create new collection
- `addProductToCollection(collectionId, productId)` - Add product
- `removeProductFromCollection(collectionId, productId)` - Remove product

### Sellers Router
- `getSellers(pagination?)` - List sellers
- `getSeller(id)` - Get single seller
- `createSeller(data)` - Create new seller
- `getSellerProducts(id)` - Get seller's products
- `getSellerCollections(id)` - Get seller's collections

### Categories Router
- `getCategories(parentId?)` - List categories (optionally by parent)
- `getCategory(id)` - Get single category
- `getProductsByCategory(id)` - Get category's products

### Analytics Router
- `trackProductView(productId)` - Track a product view
- `getTrendingProducts(window)` - Get trending products

### Stats
- `getStats()` - Get aggregate counts

## Development

> **📖 For building your own plugins, see [LLM.txt](./LLM.txt)** - comprehensive guide with patterns and examples

### Testing

```bash
# Run all tests
bun test

# Integration tests
bun test:integration

# Unit tests  
bun test:unit
```

### Building

```bash
# Development server with hot reload
bun run dev         # Serves at http://localhost:3014

# Production build (module federation)
bun run build       # Creates dist/ with remoteEntry.js
```

## Architecture

This plugin demonstrates the every-plugin pattern:

1. **Contract-first** - oRPC contract defines the API
2. **Effect-based service** - Composable business logic with error handling
3. **Self-contained database** - Plugin manages its own data with migrations
4. **Module federation** - Deployable as a remote module
5. **Type-safe** - End-to-end type safety with Zod schemas

See [LLM.txt](./LLM.txt) for the complete guide on building every-plugins, including:
- Step-by-step plugin development
- Advanced patterns (streaming, background processing, webhooks)
- Error handling with CommonPluginErrors
- Best practices and common pitfalls
- Testing strategies

## License

Part of the [every-plugin](https://github.com/near-everything/every-plugin) framework.
