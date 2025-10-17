import { relations } from "drizzle-orm";
import { foreignKey, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Sellers (merchants/storefronts)
export const sellers = sqliteTable("sellers", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Categories (hierarchical taxonomy)
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id"),
}, (table) => ([
  foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
  }).onDelete("set null"),
]));

// Collections (product groupings, storefronts)
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  sellerId: text("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Products (Schema.org Product)
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  sellerId: text("seller_id").notNull().references(() => sellers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),

  // Offer fields (Schema.org Offer)
  price: real("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  availability: text("availability").notNull().default("InStock"), // InStock, OutOfStock, PreOrder

  // Product identifiers
  sku: text("sku"),
  gtin: text("gtin"), // barcode
  brand: text("brand"),

  // Inventory
  stockQuantity: integer("stock_quantity").default(0),

  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// Product Images (Schema.org ImageObject)
export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey().$default(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").default(0),
  width: integer("width"),
  height: integer("height"),
  caption: text("caption"),
});

// Junction: Products <-> Categories (many-to-many)
export const productCategories = sqliteTable("product_categories", {
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => ([
  primaryKey({ columns: [table.productId, table.categoryId] })
]));

// Junction: Collections <-> Products (many-to-many)
export const collectionProducts = sqliteTable("collection_products", {
  collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  position: integer("position").default(0),
}, (table) => ([
  primaryKey({ columns: [table.collectionId, table.productId] })
]));

// Relations
export const sellersRelations = relations(sellers, ({ many }) => ({
  products: many(products),
  collections: many(collections),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellers, {
    fields: [products.sellerId],
    references: [sellers.id],
  }),
  images: many(productImages),
  categories: many(productCategories),
  collections: many(collectionProducts),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  seller: one(sellers, {
    fields: [collections.sellerId],
    references: [sellers.id],
  }),
  products: many(collectionProducts),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  products: many(productCategories),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionProducts.collectionId],
    references: [collections.id],
  }),
  product: one(products, {
    fields: [collectionProducts.productId],
    references: [products.id],
  }),
}));
