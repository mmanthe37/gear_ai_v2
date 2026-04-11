import { MCPServer, text, object, error, getRequestContext, type ReadResourceTemplateCallback } from "mcp-use/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { resolveUser, createUserScopedClient, type AuthUser } from "./auth.js";
import { RateLimiter } from "./rate-limit.js";
import {
  decodeVIN,
  checkRecallsByVehicle,
  lookupTSBs,
  getManualStatus,
  searchManualChunks,
  isValidVIN,
  parseDTCCode,
  isSafetyCritical,
  getSafetyEscalation,
  computeHealthScore,
} from "../lib/automotive/index.js";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

// ---------------------------------------------------------------------------
// Shared clients
// ---------------------------------------------------------------------------
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Rate limiter — 60 req / min per user
// ---------------------------------------------------------------------------
const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 60 });

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = new MCPServer({
  name: "gear-ai-automotive",
  title: "Gear AI Automotive",
  version: "1.0.0",
  description:
    "User-facing MCP server for Gear AI: VIN decoding, recalls, diagnostics, maintenance, and owner's manual search",
});

// ---------------------------------------------------------------------------
// Auth helper — extracts and validates the caller's identity
// ---------------------------------------------------------------------------
function getHeaders(): Record<string, string> {
  const c = getRequestContext();
  if (!c) return {};
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function requireAuth(): Promise<AuthUser> {
  const headers = getHeaders();
  const user = await resolveUser(headers);

  if (!limiter.check(user.userId)) {
    throw new Error("Rate limit exceeded — try again shortly");
  }

  return user;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.tool(
  {
    name: "whoami",
    description: "Returns the authenticated user's ID and email — useful for verifying auth is working",
  },
  async () => {
    const user = await requireAuth();
    return text(`userId: ${user.userId}\nemail: ${user.email ?? "(none)"}`);
  },
);

// ---------------------------------------------------------------------------
// Helper — extract raw bearer token from ctx headers
// ---------------------------------------------------------------------------
function extractToken(): string {
  const headers = getHeaders();
  const header = headers["authorization"] ?? headers["Authorization"];
  if (!header?.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }
  return header.slice(7);
}

// ---------------------------------------------------------------------------
// Public tools (no auth required — NHTSA public data)
// ---------------------------------------------------------------------------

server.tool(
  {
    name: "decode-vin",
    description: "Decode a VIN number using the NHTSA vPIC API. No auth required.",
    schema: z.object({ vin: z.string().length(17), year: z.number().optional() }),
    annotations: { readOnlyHint: true },
  },
  async ({ vin, year }) => {
    try {
      const result = await decodeVIN(vin, year);
      return object(result as unknown as Record<string, unknown>);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to decode VIN");
    }
  },
);

server.tool(
  {
    name: "check-recalls",
    description: "Check NHTSA recalls for a vehicle by make, model, and year. No auth required.",
    schema: z.object({ make: z.string(), model: z.string(), year: z.number() }),
    annotations: { readOnlyHint: true },
  },
  async ({ make, model, year }) => {
    try {
      const recalls = await checkRecallsByVehicle(make, model, year);
      return object({ total: recalls.length, recalls });
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to check recalls");
    }
  },
);

server.tool(
  {
    name: "lookup-tsbs",
    description: "Look up Technical Service Bulletins for a vehicle. No auth required.",
    schema: z.object({ make: z.string(), model: z.string(), year: z.number() }),
    annotations: { readOnlyHint: true },
  },
  async ({ make, model, year }) => {
    try {
      const tsbs = await lookupTSBs(make, model, year);
      return object({ total: tsbs.length, tsbs });
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to look up TSBs");
    }
  },
);

// ---------------------------------------------------------------------------
// Authenticated tools (require valid JWT)
// ---------------------------------------------------------------------------

server.tool(
  {
    name: "list-vehicles",
    description: "List the authenticated user's vehicles. Requires auth.",
    schema: z.object({ include_inactive: z.boolean().optional() }),
    annotations: { readOnlyHint: true },
  },
  async ({ include_inactive }) => {
    try {
      const user = await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      let query = db
        .from("vehicles")
        .select("*")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false });

      if (!include_inactive) {
        query = query.eq("is_active", true);
      }

      const { data, error: dbErr } = await query;
      if (dbErr) return error(dbErr.message);

      const vehicles = data ?? [];
      return object({ total: vehicles.length, vehicles });
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to list vehicles");
    }
  },
);

server.tool(
  {
    name: "get-vehicle",
    description: "Get a single vehicle by ID. Requires auth (RLS enforces ownership).",
    schema: z.object({ vehicle_id: z.string() }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data, error: dbErr } = await db
        .from("vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .single();

      if (dbErr) return error(dbErr.message);
      if (!data) return error("Vehicle not found");

      return object(data);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to get vehicle");
    }
  },
);

server.tool(
  {
    name: "get-maintenance-history",
    description: "Get maintenance records for a vehicle. Requires auth.",
    schema: z.object({ vehicle_id: z.string(), limit: z.number().default(20) }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id, limit }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data, count, error: dbErr } = await db
        .from("maintenance_records")
        .select("*", { count: "exact" })
        .eq("vehicle_id", vehicle_id)
        .order("date", { ascending: false })
        .limit(limit);

      if (dbErr) return error(dbErr.message);

      const records = data ?? [];
      return object({ vehicle_id, total: count ?? records.length, records });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to get maintenance history",
      );
    }
  },
);

server.tool(
  {
    name: "get-manual-status",
    description: "Check if an owner's manual is indexed for a vehicle. Requires auth.",
    schema: z.object({ vehicle_id: z.string() }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id }) => {
    try {
      await requireAuth();
      const status = await getManualStatus(vehicle_id);
      return object(status as unknown as Record<string, unknown>);
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to get manual status",
      );
    }
  },
);

server.tool(
  {
    name: "search-manual",
    description: "Search indexed owner's manual content for a vehicle. Requires auth.",
    schema: z.object({ vehicle_id: z.string(), query: z.string(), limit: z.number().default(5) }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id, query: q, limit }) => {
    try {
      await requireAuth();
      const chunks = await searchManualChunks(vehicle_id, q, limit);
      return object({ vehicle_id, query: q, total: chunks.length, chunks });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to search manual",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Mutation tools (require valid JWT)
// ---------------------------------------------------------------------------

server.tool(
  {
    name: "log-maintenance",
    description: "Create a maintenance record for a vehicle. Requires auth.",
    schema: z.object({
      vehicle_id: z.string(),
      type: z.enum([
        "oil_change",
        "tire_rotation",
        "brake_service",
        "fluid_flush",
        "filter_replacement",
        "inspection",
        "repair",
        "recall_service",
        "other",
      ]),
      date: z.string(),
      mileage: z.number().optional(),
      title: z.string(),
      description: z.string().optional(),
      cost: z.number().optional(),
      labor_cost: z.number().optional(),
      parts_cost: z.number().optional(),
      service_provider: z.string().optional(),
    }),
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  async (params) => {
    try {
      const user = await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data, error: dbErr } = await db
        .from("maintenance_records")
        .insert({
          vehicle_id: params.vehicle_id,
          user_id: user.userId,
          type: params.type,
          date: params.date,
          mileage: params.mileage,
          title: params.title,
          description: params.description,
          cost: params.cost,
          labor_cost: params.labor_cost,
          parts_cost: params.parts_cost,
          service_provider: params.service_provider,
        })
        .select()
        .single();

      if (dbErr) return error(dbErr.message);

      return object({ success: true, record: data });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to log maintenance record",
      );
    }
  },
);

server.tool(
  {
    name: "acknowledge-recall",
    description: "Mark a recall as acknowledged by the user. Idempotent. Requires auth.",
    schema: z.object({
      vehicle_id: z.string(),
      nhtsa_campaign: z.string(),
    }),
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  async ({ vehicle_id, nhtsa_campaign }) => {
    try {
      const user = await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { error: dbErr } = await db
        .from("recall_acknowledgments")
        .upsert(
          {
            vehicle_id,
            user_id: user.userId,
            nhtsa_campaign,
            acknowledged: true,
            acknowledged_at: new Date().toISOString(),
          },
          { onConflict: "vehicle_id, nhtsa_campaign" },
        );

      if (dbErr) return error(dbErr.message);

      return text(
        `Recall ${nhtsa_campaign} acknowledged for vehicle ${vehicle_id}`,
      );
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to acknowledge recall",
      );
    }
  },
);

server.tool(
  {
    name: "add-vehicle",
    description: "Add a new vehicle to the user's garage. Requires auth.",
    schema: z.object({
      year: z.number().min(1900).max(2030),
      make: z.string(),
      model: z.string(),
      vin: z.string().length(17).optional(),
      trim: z.string().optional(),
      color: z.string().optional(),
      mileage: z.number().optional(),
      license_plate: z.string().optional(),
      nickname: z.string().optional(),
    }),
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  async (params) => {
    try {
      const user = await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      if (params.vin && !isValidVIN(params.vin)) {
        return error("Invalid VIN format");
      }

      const { data, error: dbErr } = await db
        .from("vehicles")
        .insert({
          user_id: user.userId,
          year: params.year,
          make: params.make,
          model: params.model,
          vin: params.vin,
          trim: params.trim,
          color: params.color,
          mileage: params.mileage,
          license_plate: params.license_plate,
          nickname: params.nickname,
          is_active: true,
          status: "active",
        })
        .select()
        .single();

      if (dbErr) return error(dbErr.message);

      return object({
        success: true,
        vehicle: data,
        message: `${params.year} ${params.make} ${params.model} added`,
      });
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to add vehicle");
    }
  },
);

server.tool(
  {
    name: "update-vehicle",
    description: "Update fields on a vehicle. Requires auth (RLS enforces ownership).",
    schema: z.object({
      vehicle_id: z.string(),
      fields: z.record(z.string(), z.unknown()),
    }),
    annotations: { destructiveHint: false, readOnlyHint: false },
  },
  async ({ vehicle_id, fields }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      // Strip immutable fields
      const sanitized = { ...fields };
      delete sanitized.user_id;
      delete sanitized.vehicle_id;
      delete sanitized.created_at;

      const { data, error: dbErr } = await db
        .from("vehicles")
        .update({ ...sanitized, updated_at: new Date().toISOString() })
        .eq("id", vehicle_id)
        .select()
        .single();

      if (dbErr) return error(dbErr.message);

      return object({ success: true, vehicle: data });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to update vehicle",
      );
    }
  },
);

server.tool(
  {
    name: "delete-vehicle",
    description: "Soft-delete a vehicle (sets is_active=false). Requires auth.",
    schema: z.object({ vehicle_id: z.string() }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ vehicle_id }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { error: dbErr } = await db
        .from("vehicles")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", vehicle_id);

      if (dbErr) return error(dbErr.message);

      return text(`Vehicle ${vehicle_id} deactivated`);
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to delete vehicle",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.resource(
  {
    name: "vehicle_garage",
    uri: "vehicles://garage",
    title: "Vehicle Garage",
    description: "Summary of all vehicles in the user's garage",
  },
  async (ctx) => {
    try {
      const user = await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data, error: dbErr } = await db
        .from("vehicles")
        .select("*")
        .eq("user_id", user.userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (dbErr) return error(dbErr.message);

      const vehicles = data ?? [];
      if (vehicles.length === 0) {
        return text("🚗 Your garage is empty. Add a vehicle to get started!");
      }

      const lines = vehicles.map((v: any, i: number) => {
        const nickname = v.nickname ? ` "${v.nickname}"` : "";
        const mileage = v.mileage ? ` • ${Number(v.mileage).toLocaleString()} mi` : "";
        const status = v.status ? ` • ${v.status}` : "";
        return `${i + 1}. **${v.year} ${v.make} ${v.model}**${nickname}\n   VIN: ${v.vin ?? "N/A"}${mileage}${status}`;
      });

      return text(`# 🚗 Vehicle Garage (${vehicles.length})\n\n${lines.join("\n\n")}`);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to load garage");
    }
  },
);

server.resourceTemplate(
  {
    name: "vehicle_dashboard",
    uriTemplate: "vehicle://{id}/dashboard",
    title: "Vehicle Dashboard",
    description: "Complete vehicle profile with specs, recalls, and health snapshot",
  },
  (async (_uri: URL, params: { id: string }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data: vehicle, error: dbErr } = await db
        .from("vehicles")
        .select("*")
        .eq("id", params.id)
        .single();

      if (dbErr) return error(dbErr.message);
      if (!vehicle) return error("Vehicle not found");

      let recallCount = 0;
      try {
        const recalls = await checkRecallsByVehicle(vehicle.make, vehicle.model, vehicle.year);
        recallCount = recalls.length;
      } catch { /* recall check is best-effort */ }

      const nickname = vehicle.nickname ? ` "${vehicle.nickname}"` : "";
      const mileage = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} mi` : "N/A";
      const recallBadge = recallCount > 0 ? `⚠️ ${recallCount} active` : "✅ None";

      const md = [
        `# ${vehicle.year} ${vehicle.make} ${vehicle.model}${nickname}`,
        "",
        "## Vehicle Details",
        `- **VIN:** ${vehicle.vin ?? "N/A"}`,
        `- **Mileage:** ${mileage}`,
        `- **Status:** ${vehicle.status ?? "N/A"}`,
        `- **Color:** ${vehicle.color ?? "N/A"}`,
        `- **Engine:** ${vehicle.engine ?? "N/A"}`,
        `- **Transmission:** ${vehicle.transmission ?? "N/A"}`,
        `- **Drivetrain:** ${vehicle.drivetrain ?? "N/A"}`,
        "",
        "## Health Snapshot",
        `- **Active Recalls:** ${recallBadge}`,
      ].join("\n");

      return text(md);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to load vehicle dashboard");
    }
  }) as ReadResourceTemplateCallback<Record<string, any>>,
);

server.resourceTemplate(
  {
    name: "vehicle_recalls",
    uriTemplate: "vehicle://{id}/recalls",
    title: "Vehicle Recalls",
    description: "NHTSA recall alerts for this vehicle",
  },
  (async (_uri: URL, params: { id: string }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data: vehicle, error: dbErr } = await db
        .from("vehicles")
        .select("make, model, year")
        .eq("id", params.id)
        .single();

      if (dbErr) return error(dbErr.message);
      if (!vehicle) return error("Vehicle not found");

      const recalls = await checkRecallsByVehicle(vehicle.make, vehicle.model, vehicle.year);

      if (recalls.length === 0) {
        return text(`# ✅ No Active Recalls\n\nNo NHTSA recalls found for ${vehicle.year} ${vehicle.make} ${vehicle.model}.`);
      }

      const lines = recalls.map((r: any, i: number) => {
        return [
          `## ${i + 1}. ${r.Component ?? "Unknown Component"}`,
          r.NHTSACampaignNumber ? `- **Campaign:** ${r.NHTSACampaignNumber}` : null,
          r.Summary ? `- **Summary:** ${r.Summary}` : null,
          r.Consequence ? `- **Consequence:** ${r.Consequence}` : null,
          r.Remedy ? `- **Remedy:** ${r.Remedy}` : null,
        ].filter(Boolean).join("\n");
      });

      return text(`# ⚠️ Recalls for ${vehicle.year} ${vehicle.make} ${vehicle.model} (${recalls.length})\n\n${lines.join("\n\n")}`);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to load recalls");
    }
  }) as ReadResourceTemplateCallback<Record<string, any>>,
);

server.resourceTemplate(
  {
    name: "vehicle_maintenance",
    uriTemplate: "vehicle://{id}/maintenance",
    title: "Maintenance History",
    description: "Recent maintenance records for this vehicle",
  },
  (async (_uri: URL, params: { id: string }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data: vehicle, error: vErr } = await db
        .from("vehicles")
        .select("id, year, make, model")
        .eq("id", params.id)
        .single();

      if (vErr) return error(vErr.message);
      if (!vehicle) return error("Vehicle not found");

      const { data, error: dbErr } = await db
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", params.id)
        .order("date", { ascending: false })
        .limit(20);

      if (dbErr) return error(dbErr.message);

      const records = data ?? [];
      if (records.length === 0) {
        return text(`# 🔧 Maintenance History\n\nNo maintenance records found for ${vehicle.year} ${vehicle.make} ${vehicle.model}.`);
      }

      const lines = records.map((r: any) => {
        const cost = r.cost != null ? ` • $${Number(r.cost).toFixed(2)}` : "";
        const mileage = r.mileage ? ` • ${Number(r.mileage).toLocaleString()} mi` : "";
        return `- **${r.date}** — ${r.type ?? "Service"}: ${r.title ?? r.description ?? "N/A"}${mileage}${cost}`;
      });

      return text(`# 🔧 Maintenance History — ${vehicle.year} ${vehicle.make} ${vehicle.model}\n\nShowing last ${records.length} records:\n\n${lines.join("\n")}`);
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to load maintenance history");
    }
  }) as ReadResourceTemplateCallback<Record<string, any>>,
);

server.resourceTemplate(
  {
    name: "vehicle_manual_index",
    uriTemplate: "vehicle://{id}/manual-index",
    title: "Owner's Manual Index",
    description: "Availability and indexing status of the owner's manual for this vehicle",
  },
  (async (_uri: URL, params: { id: string }) => {
    try {
      await requireAuth();

      const status = await getManualStatus(params.id);

      if (!status) {
        return text("# 📖 Owner's Manual\n\nNo manual information available for this vehicle.");
      }

      const s = status as any;
      const lines = [
        "# 📖 Owner's Manual Index",
        "",
        `- **Vehicle ID:** ${params.id}`,
        `- **Indexed:** ${s.indexed ? "✅ Yes" : "❌ No"}`,
        s.chunk_count != null ? `- **Chunks:** ${s.chunk_count}` : null,
        s.last_indexed ? `- **Last Indexed:** ${s.last_indexed}` : null,
        s.manual_url ? `- **Source:** ${s.manual_url}` : null,
      ].filter(Boolean);

      return text(lines.join("\n"));
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to load manual status");
    }
  }) as ReadResourceTemplateCallback<Record<string, any>>,
);

// ---------------------------------------------------------------------------
// AI Advisory Tools
// ---------------------------------------------------------------------------

server.tool(
  {
    name: "analyze-dtc",
    description: "Analyze one or more OBD-II diagnostic trouble codes with safety classification. No auth required — pure analysis.",
    schema: z.object({
      codes: z
        .array(z.string())
        .describe("One or more OBD-II DTC codes (e.g. ['P0301', 'C0110'])"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ codes }) => {
    try {
      let criticalCount = 0;
      let warningCount = 0;
      let cautionCount = 0;
      let hasCritical = false;

      const analyzed = codes.map((code) => {
        const info = parseDTCCode(code);
        const safetyCritical = isSafetyCritical(code);
        const safetyEscalation = getSafetyEscalation(code);

        if (safetyCritical) hasCritical = true;

        if (info.severity === "critical") criticalCount++;
        else if (info.severity === "warning") warningCount++;
        else cautionCount++;

        return {
          code,
          system: info.system,
          subsystem: info.subsystem,
          severity: info.severity,
          description: info.description,
          safety_critical: safetyCritical,
          safety_escalation: safetyEscalation,
        };
      });

      const parts: string[] = [];
      if (criticalCount > 0) parts.push(`${criticalCount} critical`);
      if (warningCount > 0) parts.push(`${warningCount} warning`);
      if (cautionCount > 0) parts.push(`${cautionCount} caution`);

      return object({
        source: "gear-ai-dtc-analyzer",
        confidence: "high",
        disclaimer:
          "This analysis is for informational purposes only. Always consult a certified mechanic for safety-critical issues.",
        has_critical_codes: hasCritical,
        codes: analyzed,
        summary: `Analyzed ${codes.length} codes: ${parts.join(", ")}`,
      });
    } catch (e: unknown) {
      return error(e instanceof Error ? e.message : "Failed to analyze DTC codes");
    }
  },
);

server.tool(
  {
    name: "get-vehicle-health",
    description: "Compute comprehensive health score for a user's vehicle. Requires auth.",
    schema: z.object({
      vehicle_id: z.string().describe("Vehicle UUID from the user's garage"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id }) => {
    try {
      await requireAuth();
      const token = extractToken();
      const db = createUserScopedClient(token);

      const { data: vehicle, error: vErr } = await db
        .from("vehicles")
        .select("*")
        .eq("id", vehicle_id)
        .eq("is_active", true)
        .single();

      if (vErr) return error(vErr.message);
      if (!vehicle) return error("Vehicle not found");

      const { data: maintenanceData } = await db
        .from("maintenance_records")
        .select("*")
        .eq("vehicle_id", vehicle_id)
        .order("service_date", { ascending: false });

      const maintenanceRecords = maintenanceData ?? [];

      const { data: ackData } = await db
        .from("recall_acknowledgments")
        .select("*")
        .eq("vehicle_id", vehicle_id);

      const acknowledgedCount = ackData?.length ?? 0;

      let openRecalls = 0;
      try {
        const recalls = await checkRecallsByVehicle(
          vehicle.make,
          vehicle.model,
          vehicle.year,
        );
        openRecalls = Math.max(0, recalls.length - acknowledgedCount);
      } catch {
        /* recall check is best-effort */
      }

      const activeDTCs: string[] = vehicle.active_dtc_codes ?? [];

      const healthReport = computeHealthScore({
        maintenanceRecords,
        activeDTCs,
        openRecalls,
        mileage: vehicle.mileage,
        year: vehicle.year,
      });

      const recommendations: string[] = [];

      if (healthReport.systems) {
        const sorted = [...healthReport.systems].sort(
          (a: any, b: any) => a.score - b.score,
        );
        for (const sys of sorted) {
          if (sys.score < 60) {
            recommendations.push(
              `Urgent: Schedule ${sys.system} inspection`,
            );
          } else if (sys.score < 80) {
            recommendations.push(
              `Recommended: ${sys.system} service at next convenience`,
            );
          }
          if (recommendations.length >= 3) break;
        }
      }

      if (openRecalls > 0) {
        recommendations.push(
          `Contact your dealer about ${openRecalls} open recall(s)`,
        );
      }

      return object({
        source: "gear-ai-health-scorer",
        confidence: "medium",
        disclaimer:
          "Health scores are estimates based on available data. Actual vehicle condition may differ.",
        vehicle: {
          id: vehicle.id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          mileage: vehicle.mileage,
        },
        health: healthReport,
        recommendations: recommendations.slice(0, 3),
      });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to compute vehicle health",
      );
    }
  },
);

const SYMPTOM_PATTERNS: Record<
  string,
  { likely_causes: string[]; severity: string; recommended_action: string }
> = {
  "engine knocking": {
    likely_causes: [
      "Low octane fuel",
      "Carbon buildup",
      "Worn rod bearings",
      "Detonation/pre-ignition",
    ],
    severity: "warning",
    recommended_action:
      "Have engine inspected. If knocking persists, do not drive at high RPM.",
  },
  "check engine light": {
    likely_causes: [
      "Emission system fault",
      "Oxygen sensor",
      "Catalytic converter",
      "Loose gas cap",
    ],
    severity: "caution",
    recommended_action:
      "Scan for DTC codes. If light is flashing, pull over safely.",
  },
  "rough idle": {
    likely_causes: [
      "Dirty throttle body",
      "Vacuum leak",
      "Worn spark plugs",
      "Fuel injector issue",
    ],
    severity: "caution",
    recommended_action: "Check spark plugs and air filter first.",
  },
  vibration: {
    likely_causes: [
      "Unbalanced tires",
      "Worn brake rotors",
      "CV joint wear",
      "Engine misfire",
    ],
    severity: "caution",
    recommended_action: "Check tire balance and brake rotors.",
  },
  overheating: {
    likely_causes: [
      "Low coolant",
      "Failed thermostat",
      "Water pump failure",
      "Radiator blockage",
    ],
    severity: "critical",
    recommended_action:
      "STOP driving immediately. Allow engine to cool. Check coolant level.",
  },
  "brake noise": {
    likely_causes: [
      "Worn brake pads",
      "Glazed rotors",
      "Stuck caliper",
      "Dust/debris",
    ],
    severity: "warning",
    recommended_action:
      "Inspect brake pads immediately. If grinding, do not drive.",
  },
  "transmission slipping": {
    likely_causes: [
      "Low transmission fluid",
      "Worn clutch packs",
      "Solenoid failure",
      "Torque converter issue",
    ],
    severity: "critical",
    recommended_action:
      "Check transmission fluid level. Do not drive if slipping is severe.",
  },
  "steering pull": {
    likely_causes: [
      "Alignment issue",
      "Uneven tire pressure",
      "Worn tie rod",
      "Brake caliper sticking",
    ],
    severity: "caution",
    recommended_action:
      "Check tire pressure first, then schedule alignment check.",
  },
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  warning: 2,
  caution: 1,
  unknown: 0,
};

server.tool(
  {
    name: "symptom-check",
    description: "AI-assisted symptom analysis that maps driver-reported symptoms to likely causes. Auth required only if vehicle_id is provided.",
    schema: z.object({
      vehicle_id: z
        .string()
        .optional()
        .describe("Optional vehicle UUID for context"),
      symptoms: z
        .array(z.string())
        .describe(
          "Driver-reported symptoms (e.g. ['engine knocking', 'check engine light on', 'rough idle'])",
        ),
      active_dtcs: z
        .array(z.string())
        .optional()
        .describe("Optional current DTC codes to cross-reference"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id, symptoms, active_dtcs }) => {
    try {
      let vehicleContext: {
        year: number;
        make: string;
        model: string;
        mileage: number | null;
      } | null = null;

      if (vehicle_id) {
        await requireAuth();
        const token = extractToken();
        const db = createUserScopedClient(token);

        const { data: vehicle, error: vErr } = await db
          .from("vehicles")
          .select("year, make, model, mileage")
          .eq("id", vehicle_id)
          .single();

        if (vErr) return error(vErr.message);
        if (!vehicle) return error("Vehicle not found");

        vehicleContext = {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          mileage: vehicle.mileage,
        };
      }

      const parsedDTCs = (active_dtcs ?? []).map((code) => ({
        code,
        info: parseDTCCode(code),
      }));

      let worstSeverity = "unknown";

      const analyses = symptoms.map((symptom) => {
        const lower = symptom.toLowerCase();

        let matchedKey: string | null = null;
        for (const key of Object.keys(SYMPTOM_PATTERNS)) {
          if (lower.includes(key) || key.includes(lower)) {
            matchedKey = key;
            break;
          }
        }

        const pattern = matchedKey ? SYMPTOM_PATTERNS[matchedKey] : null;

        const severity = pattern?.severity ?? "unknown";
        if (
          (SEVERITY_ORDER[severity] ?? 0) >
          (SEVERITY_ORDER[worstSeverity] ?? 0)
        ) {
          worstSeverity = severity;
        }

        const correlatedDTCs = parsedDTCs
          .filter((d) => {
            const sys = d.info.system?.toLowerCase() ?? "";
            return lower.includes(sys) || sys.includes(lower);
          })
          .map((d) => d.code);

        return {
          symptom,
          matched_pattern: matchedKey,
          likely_causes: pattern?.likely_causes ?? [],
          severity,
          recommended_action:
            pattern?.recommended_action ??
            "Consult a certified mechanic for diagnosis.",
          correlated_dtcs: correlatedDTCs,
        };
      });

      const matched = analyses.filter((a) => a.matched_pattern).length;
      const unmatched = analyses.length - matched;
      const summaryParts = [`Analyzed ${symptoms.length} symptom(s)`];
      if (matched > 0) summaryParts.push(`${matched} matched known patterns`);
      if (unmatched > 0) summaryParts.push(`${unmatched} unrecognized`);
      summaryParts.push(`overall severity: ${worstSeverity}`);

      return object({
        source: "gear-ai-symptom-checker",
        confidence: "low",
        disclaimer:
          "Symptom analysis is approximate and based on common patterns. Always consult a certified mechanic for diagnosis.",
        vehicle_context: vehicleContext,
        analyses,
        overall_severity: worstSeverity,
        summary: summaryParts.join("; "),
      });
    } catch (e: unknown) {
      return error(
        e instanceof Error ? e.message : "Failed to analyze symptoms",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// MCP Prompts (reusable AI conversation templates)
// ---------------------------------------------------------------------------

server.prompt(
  {
    name: "diagnose-vehicle",
    description:
      "Run a full diagnostic workflow for a vehicle — pulls health data, analyzes DTC codes, cross-references symptoms, and produces a prioritized report.",
    schema: z.object({
      vehicle_id: z.string().describe("Vehicle UUID from the user's garage"),
      symptoms: z
        .string()
        .optional()
        .describe("Optional symptom description from the driver"),
    }),
  },
  async (params) => {
    const symptomBlock = params.symptoms
      ? `\n\nThe driver also reports the following symptoms:\n"${params.symptoms}"\nPlease call the **symptom-check** tool with these symptoms and the vehicle_id to cross-reference them against known failure patterns.`
      : "";

    return {
      messages: [
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: [
              "I am **Gear AI Diagnostic Assistant**, an expert automotive diagnostician.",
              "",
              "I follow these rules on every diagnosis:",
              "1. I always prioritize safety-critical findings — I surface them first and flag them clearly.",
              "2. I cite every data source (tool name, DTC code, sensor reading) that supports my conclusions.",
              "3. I include the following disclaimer at the end of every response:",
              '   "⚠️ This analysis is AI-generated and for informational purposes only. It is not a substitute for a professional inspection by a certified mechanic. If you suspect a safety issue, do not drive the vehicle and consult a qualified technician immediately."',
              "4. I never guess — if data is insufficient, I say so and recommend a physical inspection.",
            ].join("\n"),
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Please run a comprehensive diagnostic for vehicle **${params.vehicle_id}**.`,
              "",
              "Follow these steps:",
              `1. Call **get-vehicle-health** with vehicle_id "${params.vehicle_id}" to retrieve the current health status.`,
              "2. If there are any active DTC codes in the health data, call **analyze-dtc** for each code to classify severity and root cause.",
              "3. Synthesize all findings into a diagnostic report with prioritized recommendations (safety-critical → urgent → advisory).",
              "4. End with the safety disclaimer.",
              symptomBlock,
            ].join("\n"),
          },
        },
      ],
    };
  },
);

server.prompt(
  {
    name: "maintenance-advisor",
    description:
      "Generate a prioritized maintenance schedule for a vehicle based on its current health status and service history.",
    schema: z.object({
      vehicle_id: z.string().describe("Vehicle UUID from the user's garage"),
    }),
  },
  async (params) => {
    return {
      messages: [
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: [
              "I am **Gear AI Maintenance Advisor**, a specialist in preventive vehicle care and service scheduling.",
              "",
              "I follow these rules on every maintenance plan:",
              "1. I always prioritize safety-critical and overdue items above all else.",
              "2. I cite the data source for every recommendation (health report field, service record date, etc.).",
              "3. When estimating costs, I provide reasonable ranges and note they vary by location and shop.",
              "4. I include the following disclaimer at the end of every response:",
              '   "⚠️ This maintenance plan is AI-generated and for informational purposes only. Always verify service intervals with your vehicle\'s owner manual and consult a certified technician for accurate quotes."',
            ].join("\n"),
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Please create a prioritized maintenance plan for vehicle **${params.vehicle_id}**.`,
              "",
              "Follow these steps:",
              `1. Call **get-vehicle-health** with vehicle_id "${params.vehicle_id}" to retrieve the current health status including any overdue maintenance items.`,
              `2. Call **get-maintenance-history** for vehicle_id "${params.vehicle_id}" to review past service records.`,
              "3. Compile a prioritized maintenance schedule organized as:",
              "   • **Urgent** — overdue or safety-critical items that need immediate attention.",
              "   • **Recommended** — items approaching their service interval or showing early wear.",
              "   • **Upcoming** — scheduled maintenance within the next 3-6 months or 5,000 miles.",
              "4. For each item include: what the service is, why it is needed, estimated cost range, and suggested timeframe.",
              "5. End with the disclaimer.",
            ].join("\n"),
          },
        },
      ],
    };
  },
);

server.prompt(
  {
    name: "pre-purchase-inspection",
    description:
      "Compile a comprehensive buyer's report for a vehicle under consideration — decodes the VIN, checks recalls, reviews TSBs, and rates the purchase.",
    schema: z.object({
      vin: z
        .string()
        .describe("VIN of the vehicle being considered for purchase"),
    }),
  },
  async (params) => {
    return {
      messages: [
        {
          role: "assistant" as const,
          content: {
            type: "text" as const,
            text: [
              "I am **Gear AI Pre-Purchase Inspector**, an expert at evaluating used vehicles for prospective buyers.",
              "",
              "I follow these rules on every inspection:",
              "1. I am objective — I present both positives and negatives clearly.",
              "2. I cite every data source (VIN decode fields, recall IDs, TSB numbers) that supports my assessment.",
              "3. I rate the vehicle using a simple traffic-light system:",
              "   🟢 **Green** — No major concerns found; proceed with standard pre-purchase inspection.",
              "   🟡 **Yellow** — Some issues found; proceed with caution and address items before buying.",
              "   🔴 **Red** — Significant concerns found; strongly consider alternatives or negotiate heavily.",
              "4. I include the following disclaimer at the end of every response:",
              '   "⚠️ This report is AI-generated and for informational purposes only. It does not replace a hands-on pre-purchase inspection by a certified mechanic. Always verify vehicle history with a trusted service such as CARFAX or AutoCheck."',
            ].join("\n"),
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Please evaluate VIN **${params.vin}** as a potential purchase.`,
              "",
              "Follow these steps:",
              `1. Call **decode-vin** with VIN "${params.vin}" to retrieve full vehicle details (year, make, model, engine, transmission, etc.).`,
              `2. Call **check-recalls** with the VIN to check for any NHTSA recall history.`,
              `3. Call **lookup-tsbs** for the decoded vehicle to find known technical service bulletins.`,
              "4. Compile a buyer's checklist that includes:",
              "   • Vehicle overview (year, make, model, key specs).",
              "   • Recall status — open vs. completed recalls with descriptions.",
              "   • Known issues — TSBs and common problems for this model/year.",
              "   • Questions to ask the seller (maintenance records, accident history, tire age, etc.).",
              "5. Rate the vehicle as 🟢 Green, 🟡 Yellow, or 🔴 Red with a summary justification.",
              "6. End with the disclaimer.",
            ].join("\n"),
          },
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen();
