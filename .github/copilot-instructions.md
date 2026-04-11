# GitHub Copilot Instructions for Gear AI CoPilot

## Project snapshot

Gear AI CoPilot is a mobile-first automotive "digital twin" app (Expo SDK 53 / React Native 0.79 + Supabase + OpenAI). Users manage vehicles, track maintenance, chat with AI about their owner's manuals (RAG-powered), and run diagnostics. The repo also contains a standalone MCP workspace server under `mcp-server/`.

## Build, lint, type-check, and test commands

### Root app (`/`)

```bash
npm install                    # Install deps
npm run setup                  # Validate .env.local has required keys
npm start                      # Start Expo dev server
npm run ios                    # Run on iOS simulator
npm run android                # Run on Android emulator
npm run web                    # Run in browser
npm run lint                   # ESLint (expo lint)
npx tsc --noEmit               # Type-check (strict mode)
npm run build                  # Web production build (npx expo export --platform web)
npx prettier --check .         # CI formatting check
```

### MCP server (`/mcp-server`)

```bash
cd mcp-server && npm install   # Separate dependency tree
cd mcp-server && npm run dev   # Dev server (mcp-use dev)
cd mcp-server && npm run build # Production build (mcp-use build)
cd mcp-server && npm run start # Start built server
```

### Tests

No test runner, test script, or test files (`*.test.*` / `*.spec.*`) exist yet. Validation relies on lint + type-check + web build.

## High-level architecture

### 1) Provider stack and routing

`app/_layout.tsx` wraps the entire app:

```
ErrorBoundary → ThemeProvider → AuthProvider → AppShellProvider → <Stack>
```

File-based routes (Expo Router) are grouped by feature: `app/garage/`, `app/maintenance/`, `app/diagnostics/`, `app/manuals/`, `app/chat/`, `app/settings.tsx`. Authenticated screens render inside `components/layout/AppShell.tsx`, which manages top nav, sidebar, responsive layout, and shared vehicle/chat state.

### 2) Data access layer

- **No controller/repository pattern** — screens call `services/*.ts` functions directly.
- `services/index.ts` is the barrel re-exporting all service modules.
- `lib/supabase.ts` creates the single `SupabaseClient` with a custom in-memory lock (avoids a `navigator.locks` deadlock on web when `onAuthStateChange` fires during `getSession()`) and a 15 s fetch timeout.
- Auth flow: Supabase Auth → auto-created `public.users` profile via DB trigger → `AuthContext` syncs session state.

### 3) AI + chat pipeline

```
Chat UI (app/chat/[id].tsx)
  → ai-service.ts (generateAIResponse)
    → manual-search.ts (BM25 + semantic + Reciprocal Rank Fusion)
      → rag-pipeline.ts (chunking, embeddings via intfloat/e5-base-v2)
        → Supabase RPC search_manual_chunks (pgvector cosine similarity)
  → chat-service.ts (persist messages + sources)
```

### 4) Database

PostgreSQL 15 + pgvector. Schema and RLS policies live in `supabase/migrations/` (apply in filename order):

| Migration | Purpose |
|-----------|---------|
| `20250101000000_initial_schema` | Core tables (users, vehicles, manuals, vector_embeddings, chat_sessions, maintenance_records, financial_accounts, diagnostics) |
| `20250101000001_rls_policies` | Row-level security via `auth.uid()` |
| `20250201000000_search_manual_chunks_rpc` | `search_manual_chunks()` vector similarity RPC |
| `20250301000000_helper_functions` | Aggregation/transformation helpers |
| `20250401000000_supabase_auth_migration` | Firebase UID → Supabase Auth transition |
| `20250501000000_auto_create_user_profile` | Trigger: auto-create `public.users` on signup |
| `20250601000000_vehicle_profile_enhancements` | Nickname, status, registration/insurance fields |
| `20250602000000_maintenance_enhancements` | Categories, recurring reminders |
| `20250701000000_diagnostics_tables` | diagnostic_codes, vehicle_health_scores, symptom_checks, obd_data, recall_history |

### 5) MCP workspace server

`mcp-server/` is a standalone `mcp-use` Node project (separate deps, tsconfig, build). It exposes tools for vehicle data CRUD, codebase search/read/list, file edit/create, and build/lint/type-check helpers. Do not import from or share dependencies with the root app.

### 6) CI/CD pipeline

`.github/workflows/ci-cd.yml` runs on push/PR to `main`/`develop`:

- **quality**: tsc type-check, ESLint, Prettier (continue-on-error for lint/format)
- **security**: npm audit (moderate), gitleaks secret scan
- **build-web**: Expo web export + artifact upload + size analysis
- **deploy-preview** (PRs): Vercel preview deployment
- **deploy-production** (main): Vercel production deployment
- **build-ios / build-android** (main): EAS builds (preview profile)
- **lighthouse** (PRs): Performance audit

Node 20 / npm 11. Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `EXPO_TOKEN`.

## Key conventions

### Design system — "Liquid Glass"

- Glassmorphism UI: translucent cards with `BlurView` (intensity 20–40), `rgba(255,255,255,0.1)` backgrounds.
- Use `components/GlassCard.tsx` for all card-based UI.
- Brand colors: Performance Orange `#FF4500`, Electric Blue `#1E90FF`, plus grayscale glass tints.
- Neon accent colors: Cyan `#00D4FF`, Purple `#8B5CF6`.
- Three theme modes: `dark`, `light`, `amoled` — all managed via `ThemeContext` + `theme/tokens.ts`.
- Always use token-based colors/radii from `useTheme()` hook; never hard-code color values.
- Brand assets in `assets/branding/`: `gearai-full.png`, `gearai-wordmark.png`, `gearai-icon.png`.
- Reusable logo/action-icon components live in `components/branding/`.

### App shell and navigation

- Feature screens wrap content in `AppShell` and provide a `routeKey`.
- `components/layout/nav-config.ts` maps route keys to top-nav state (title, actions).

### Service layer patterns

- Service functions are named exports, async, following: query Supabase → log on failure → throw `Error` (or return fallback for user-facing helpers).
- Vehicle and chat records use soft-delete (`is_active = true` filter).
- Subscription tier gating: `canAddVehicle()` in `vehicle-service.ts`, limits in `services/constants.ts` + `subscription-service.ts` (free=1 vehicle, pro=3, mechanic/dealer=unlimited).
- Use `UNLIMITED_VEHICLES`, `MAX_FILE_SIZE_BYTES` from `services/constants.ts` instead of magic numbers.

### Auth and identity

- All ownership checks and RLS use `auth.uid()` (Supabase Auth UUID), not Firebase UID.
- `public.users.user_id` is the identity anchor across services and policies.
- `firebase_uid` column is nullable — retained for migration compatibility only.

### File naming

- Components: `PascalCase.tsx` (e.g., `GlassCard.tsx`, `ModernVehicleCard.tsx`)
- Services: `kebab-case.ts` (e.g., `auth-service.ts`, `vehicle-service.ts`)
- Type files: `lowercase.ts` (e.g., `vehicle.ts`, `user.ts`)
- Route files: `lowercase.tsx` or `[param].tsx`

### Imports and types

- Relative imports (`../`, `../../`) are the dominant pattern, even though `@/*` path alias is configured in `tsconfig.json`.
- Type barrel: `types/index.ts` re-exports all type modules.
- Service barrel: `services/index.ts` re-exports all service modules.
- Shared response types (`APIResponse<T>`, `PaginatedResponse<T>`) are defined in `types/index.ts`.

### Environment variables

- Client-side vars use `EXPO_PUBLIC_*` prefix for Metro bundler inlining.
- `app.config.js` provides a fallback via `extra` for non-prefixed vars.
- `npm run setup` (runs `scripts/setup-env.js`) validates that required keys exist in `.env.local`.
- See `.env.example` for the full variable catalog.

### Supabase client quirk

`lib/supabase.ts` uses a custom in-memory lock instead of `navigator.locks` to avoid a deadlock where `onAuthStateChange` fires during `getSession()` on web. Do not switch to the default lock implementation.

### Commits

Conventional Commits format is expected (see `CONTRIBUTING.md`).

### ESLint posture

`eslint.config.js` currently relaxes `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `ban-ts-comment`, and `no-non-null-assertion` for prototyping speed. These may tighten later.

## Reference docs

- `docs/ARCHITECTURE.md` — hub-and-spoke architecture, module breakdown
- `docs/DATABASE_SCHEMA.md` — table definitions, RLS, vector search
- `docs/API_INTEGRATION.md` — third-party API contracts (NHTSA, CarMD, OpenAI, Stripe, etc.)
- `docs/DESIGN_SYSTEM.md` — full design system spec (colors, typography, components)
- `docs/DEVELOPMENT_STATUS.md` — phase completion tracking
