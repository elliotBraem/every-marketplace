# every-marketplace

A unified marketplace platform with multi-vendor support, built on the every-plugin framework.

This application demonstrates a plugin-based architecture where marketplace operations (products, collections, sellers, categories, analytics) are provided through a self-contained plugin that manages its own database and business logic.

**Note:** There is an authenticated section with better-auth and NEAR Protocol integration. It won't work without Docker and proper .env configuration, but you shouldn't need it initially - it'll be convenient when we integrate it later.

Read `LLM.txt` in the root for more context about the architecture and the marketplace plugin system.

## Setup

1. `docker compose up -d` to get PostgreSQL running (for auth)
2. `bun db:migrate` to set up the database schema
3. `bun dev` to start both web and server

## Architecture

- **Server**: Hono.js with tRPC for type-safe APIs, Better-Auth for authentication with NEAR Protocol accounts, Drizzle ORM on PostgreSQL
- **Web**: React with TanStack Router for routing, TanStack Query for data fetching, tRPC client for server communication
- **Database**: PostgreSQL with Docker Compose setup (auth), LibSQL/Turso (marketplace plugin)
- **Plugin System**: Uses every-plugin framework for modular marketplace operations

### Marketplace Plugin

The core marketplace functionality is provided by `@near-everything/marketplace-plugin`, which includes:
- Products (CRUD, search, filtering)
- Collections (curated product groups)
- Sellers (multi-vendor support)
- Categories (hierarchical organization)
- Analytics (tracking, trending)
- Stats (aggregated metrics)

See `packages/marketplace-plugin/README.md` for marketplace-specific details.

## Available Scripts

- `bun dev` - Start both web and server in development
- `bun dev:web` - Start only the web application
- `bun dev:server` - Start only the server
- `bun build` - Build all applications
- `bun db:push` - Apply database schema changes
- `bun db:studio` - Open Drizzle Studio database UI
- `bun db:migrate` - Run database migrations

## Key Files

- `packages/marketplace-plugin/src/contract.ts` - Marketplace API contract with all procedures
- `packages/marketplace-plugin/src/db/schema.ts` - Marketplace database schema
- `apps/server/src/routers/index.ts` - tRPC endpoints that integrate the marketplace plugin
- `apps/server/src/index.ts` - Server setup with Hono, tRPC, and auth middleware
- `LLM.txt` - Detailed architecture and marketplace plugin documentation
