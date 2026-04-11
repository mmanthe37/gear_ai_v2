# Gear AI Automotive MCP Server

User-facing MCP server for the Gear AI platform. Provides vehicle management, diagnostics, and AI-assisted advisory tools to authenticated end-users via the [Model Context Protocol](https://modelcontextprotocol.io/).

Unlike the developer workspace server (`mcp-server/`), this server is designed for **end-users** — every request is scoped to a Supabase-authenticated identity, data access is governed by Row-Level Security, and rate limiting is enforced per user.

| | `mcp-server/` | `mcp-server-automotive/` |
|---|---|---|
| **Audience** | Developers / internal tooling | End-users via the Gear AI app |
| **Auth** | None (workspace-local) | Supabase JWT + API key fallback |
| **Rate limiting** | None | 60 req/min per user |
| **Port** | 3000 | 3002 |
| **Tools** | Codebase analysis, file editing, build utils | VIN decode, recalls, diagnostics, maintenance |

---

## Features Summary

- **17 tools** — vehicle CRUD, VIN decoding, recalls, TSBs, maintenance logging, DTC analysis, health scoring, symptom checking
- **5 resources** — garage overview, per-vehicle dashboard, recalls, maintenance history, manual index
- **3 prompts** — diagnose-vehicle, maintenance-advisor, pre-purchase-inspection
- **Authentication** — Supabase JWT (primary) + API key fallback (dev)
- **Rate limiting** — 60 requests/minute per user via sliding window

---

## Setup

```bash
cp .env.example .env   # fill in values below
npm install
npm run dev            # starts on http://localhost:3002
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public API key |
| `SUPABASE_SERVICE_KEY` | ⬚ | Supabase service role key (for admin operations) |
| `OPENAI_API_KEY` | ⬚ | OpenAI key for AI advisory tools |
| `MCP_URL` | ⬚ | Server URL (default: `http://localhost:3002`) |
| `AUTH_SECRET` | ⬚ | Shared secret for the `X-API-Key` dev fallback |

---

## Authentication

Every request must include one of:

1. **Supabase JWT (primary)** — `Authorization: Bearer <token>`
   The JWT is forwarded to Supabase so that Row-Level Security policies scope all queries to the caller's `user_id`.

2. **API key fallback (dev/testing only)** — `X-API-Key: <AUTH_SECRET>`
   Returns a fixed identity (`api-key-user` / `dev@gearai.local`). **Do not use in production.**

Three tools are public and skip auth entirely: `decode-vin`, `check-recalls`, `lookup-tsbs` (NHTSA public data).

### Rate Limiting

60 requests per minute per user. Exceeding the limit returns:

```
Error: Rate limit exceeded — try again shortly
```

---

## Claude Desktop / Copilot CLI Integration

Add this block to your MCP client configuration:

```json
{
  "mcpServers": {
    "gear-ai-automotive": {
      "command": "npx",
      "args": ["tsx", "index.ts"],
      "cwd": "/path/to/gear_ai_v2/mcp-server-automotive",
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "AUTH_SECRET": "your-api-key-secret"
      }
    }
  }
}
```

---

## Tool Reference

### Identity

| Tool | Description | Auth Required |
|---|---|---|
| `whoami` | Returns the authenticated user's ID and email — useful for verifying auth is working | ✅ |

### Read-only Automotive

| Tool | Description | Auth Required |
|---|---|---|
| `decode-vin` | Decode a VIN number using the NHTSA vPIC API | ❌ |
| `check-recalls` | Check NHTSA recalls for a vehicle by make, model, and year | ❌ |
| `lookup-tsbs` | Look up Technical Service Bulletins for a vehicle | ❌ |
| `list-vehicles` | List the authenticated user's vehicles | ✅ |
| `get-vehicle` | Get a single vehicle by ID (RLS enforces ownership) | ✅ |
| `get-maintenance-history` | Get maintenance records for a vehicle | ✅ |
| `get-manual-status` | Check if an owner's manual is indexed for a vehicle | ✅ |
| `search-manual` | Search indexed owner's manual content for a vehicle | ✅ |

### Mutations

| Tool | Description | Auth Required |
|---|---|---|
| `log-maintenance` | Create a maintenance record for a vehicle | ✅ |
| `acknowledge-recall` | Mark a recall as acknowledged by the user (idempotent) | ✅ |
| `add-vehicle` | Add a new vehicle to the user's garage | ✅ |
| `update-vehicle` | Update fields on a vehicle (RLS enforces ownership) | ✅ |
| `delete-vehicle` | Soft-delete a vehicle (sets `is_active=false`) | ✅ |

### AI Advisory

| Tool | Description | Auth Required |
|---|---|---|
| `analyze-dtc` | Analyze one or more OBD-II diagnostic trouble codes with safety classification | ❌ |
| `get-vehicle-health` | Compute comprehensive health score for a user's vehicle | ✅ |
| `symptom-check` | AI-assisted symptom analysis mapping driver-reported symptoms to likely causes | ⬚ (only if `vehicle_id` provided) |

---

## Resource Reference

| URI Pattern | Name | Description | Auth Required |
|---|---|---|---|
| `vehicles://garage` | Vehicle Garage | Summary of all vehicles in the user's garage | ✅ |
| `vehicle://{id}/dashboard` | Vehicle Dashboard | Complete vehicle profile with specs, recalls, and health snapshot | ✅ |
| `vehicle://{id}/recalls` | Vehicle Recalls | NHTSA recall alerts for this vehicle | ✅ |
| `vehicle://{id}/maintenance` | Maintenance History | Recent maintenance records for this vehicle | ✅ |
| `vehicle://{id}/manual-index` | Owner's Manual Index | Availability and indexing status of the owner's manual | ✅ |

---

## Prompt Reference

| Prompt | Description | Parameters |
|---|---|---|
| `diagnose-vehicle` | Generate a structured diagnostic workflow for a vehicle exhibiting symptoms or DTC codes | `vehicle_id`, `symptoms`, `dtc_codes` |
| `maintenance-advisor` | Produce a prioritized maintenance plan based on vehicle age, mileage, and service history | `vehicle_id` |
| `pre-purchase-inspection` | Create a pre-purchase inspection checklist and risk assessment for a prospective vehicle | `vin`, `year`, `make`, `model`, `mileage` |

> **Note:** Prompts are being added by a concurrent agent. If your server instance shows 0 prompts, the definitions above reflect the planned API surface.

---

## Shared Domain Layer

The pure business logic lives in `../lib/automotive/` and is shared between the mobile app and this MCP server. It has **no** Expo/React Native dependencies.

Key exports:

| Module | Exports |
|---|---|
| `vin-decoder` | `decodeVIN`, `isValidVIN`, `validateVINChecksum`, `getMakesForYear`, `getModelsForMake` |
| `recall-checker` | `checkRecallsByVehicle`, `lookupTSBs`, `lookupComplaints` |
| `dtc-analyzer` | `parseDTCCode`, `isSafetyCritical`, `getSafetyEscalation` |
| `health-scorer` | `computeHealthScore` |
| `manual-search` | `searchManualChunks`, `getManualStatus` |

If you need to change recall-checking logic or DTC severity rules, edit the shared library — not this server.

---

## Architecture

```
gear_ai_v2/
├── mcp-server/              # Dev workspace server (port 3000, no auth)
├── mcp-server-automotive/   # This server (port 3002, user-scoped)
│   ├── index.ts             # Tool, resource, and prompt definitions
│   ├── auth.ts              # Supabase JWT + API key auth
│   └── rate-limit.ts        # Sliding-window rate limiter
└── lib/automotive/          # Shared domain logic (pure TS, no framework deps)
```

- **User-scoped** — every authenticated request creates a Supabase client with the caller's JWT so RLS policies enforce data isolation.
- **Separate from dev server** — `mcp-server/` is for developer tooling; this server is for end-user automotive features.
- **Port 3002** — avoids conflicts with the dev workspace server on port 3000.
