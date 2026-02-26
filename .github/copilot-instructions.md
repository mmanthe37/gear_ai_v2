# GitHub Copilot Instructions for Gear AI CoPilot

## Project snapshot
- Gear AI CoPilot is a mobile-first automotive "digital twin" app (Expo/React Native + Supabase + OpenAI).
- The repository also contains a separate MCP workspace server under `mcp-server/`.

## Build, lint, type-check, and test commands

### Root app (`/`)
- Install deps: `npm install`
- Validate local env: `npm run setup`
- Start dev server: `npm start`
- Platform run targets: `npm run ios`, `npm run android`, `npm run web`
- Lint: `npm run lint`
- Type-check: `npx tsc --noEmit`
- Web production build: `npm run build`
- CI formatting check: `npx prettier --check .`

### MCP server (`/mcp-server`)
- Install deps: `cd mcp-server && npm install`
- Dev server: `cd mcp-server && npm run dev`
- Build: `cd mcp-server && npm run build`
- Start built server: `cd mcp-server && npm run start`

### Test status and single-test command
- There is currently no test script in root `package.json` or `mcp-server/package.json`.
- There are currently no `*.test.*` / `*.spec.*` files in this repo.
- A single-test command does not exist yet in the current codebase state.

## High-level architecture

### 1) Runtime composition and routing
- `app/_layout.tsx` is the app root and wraps everything in:
  - `ErrorBoundary`
  - `ThemeProvider`
  - `AuthProvider`
  - `AppShellProvider`
- File-based routes are grouped by feature folders (`app/garage`, `app/maintenance`, `app/diagnostics`, `app/manuals`, `app/chat`, `app/settings.tsx`).
- Authenticated feature screens render inside `components/layout/AppShell.tsx`; this shell handles top nav, sidebar, responsive behavior, and shared vehicle/chat sidebar data.

### 2) Data access layer
- `services/*.ts` is the functional service layer; screens call services directly.
- `services/index.ts` is the canonical barrel for service exports.
- `lib/supabase.ts` is the single Supabase client used across services and auth flows.
- Current auth flow is Supabase Auth + `public.users` profile sync (`contexts/AuthContext.tsx`, `services/auth-service.ts`).

### 3) AI + chat pipeline
- Chat UI (`app/chat/[id].tsx`) persists conversations via `chat-service`.
- Message generation is handled by `services/ai-service.ts`.
- RAG retrieval path:
  - `ai-service` -> `manual-search` (BM25 + semantic + RRF)
  - `manual-search` -> `rag-pipeline` embeddings + Supabase vector search/RPC
  - Sources are returned and attached to chat messages.

### 4) Database and migrations
- Schema and policies live in `supabase/migrations/`.
- Important baseline migrations:
  - initial schema (`20250101000000_initial_schema.sql`)
  - RLS policies (`20250101000001_rls_policies.sql`)
  - search RPC (`20250201000000_search_manual_chunks_rpc.sql`)
  - helper RPCs (`20250301000000_helper_functions.sql`)
  - auth transition to Supabase Auth (`20250401000000_supabase_auth_migration.sql`)
  - auto profile trigger (`20250501000000_auto_create_user_profile.sql`)

### 5) Secondary MCP workspace server
- `mcp-server/index.ts` defines a standalone `mcp-use` server with tool domains:
  - Vehicle data CRUD
  - Codebase search/read/list
  - File edit/create
  - Build/lint/type-check helpers
- Treat `/mcp-server` as a separate Node project with its own dependency graph and scripts.

## Key repository conventions

### App and UI conventions
- Feature screens should use `AppShell` and provide a stable `routeKey` (`components/layout/nav-config.ts` maps route state to top-nav state).
- Theme is centralized in `ThemeContext` + `theme/tokens.ts`; prefer token-based colors/radii over ad-hoc constants.
- Branding uses reusable logo/action-icon components (`components/branding/*`) across auth and shell screens.

### Service and data conventions
- Service functions are named exports, usually async, and generally follow: query Supabase -> log context on failure -> throw typed `Error` (or return explicit fallback in a few user-facing helpers).
- Vehicle and chat records are often soft-deleted / filtered with `is_active = true`.
- Tier gating is enforced via service logic (e.g., `canAddVehicle` in `services/vehicle-service.ts`) and shared limits in `services/constants.ts` + `services/subscription-service.ts`.

### Auth and identity conventions
- Database ownership checks and RLS are based on `auth.uid()` (Supabase Auth UUID), not Firebase UID.
- `public.users.user_id` is the identity anchor used by service methods and policies.

### Environment conventions
- Supabase config supports both Metro-safe `EXPO_PUBLIC_*` vars and `app.config.js` `extra` fallback.
- `npm run setup` validates `.env.local` with required Firebase/Supabase keys before local runs.

### Typing/import/file conventions actually used in code
- TypeScript strict mode is enabled (`tsconfig.json`).
- Type barrel is `types/index.ts`; type files are lowercase (`types/vehicle.ts`, `types/user.ts`, etc.).
- Relative imports are the dominant pattern in app/services (`../` / `../../`), even though `@/*` path alias is configured.

### Commit and contribution conventions
- Conventional Commits are expected (documented in `CONTRIBUTING.md`).

## Primary reference docs
- `README.md`
- `CONTRIBUTING.md`
- `docs/ARCHITECTURE.md` (conceptual)
- `docs/DATABASE_SCHEMA.md`
- `docs/API_INTEGRATION.md`
- `docs/DEVELOPMENT_STATUS.md`
