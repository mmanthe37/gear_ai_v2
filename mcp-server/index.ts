/**
 * Gear AI Workspace — MCP Server
 *
 * All-in-one AI assistant toolset for the Gear AI application.
 * Covers four domains:
 *  1. Vehicle Data     — Supabase CRUD for vehicles
 *  2. Codebase Analysis — search, read, list project files
 *  3. File Editing     — edit and create project files
 *  4. Build & Management — lint, type-check, git status, npm scripts
 *
 * Required env vars:
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — Service role key for full DB access
 *   PROJECT_ROOT          — Absolute path to gear_ai_v2 (auto-detected if omitted)
 *   MCP_URL               — Public URL of this server (default: http://localhost:3001)
 */

import { MCPServer, error, markdown, object, text } from "mcp-use/server";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// ── Config ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? path.resolve(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

function requireSupabase() {
  if (!supabase)
    return error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
    );
  return null;
}

function safeExec(cmd: string, opts: { cwd?: string; timeout?: number } = {}) {
  return execSync(cmd, {
    cwd: opts.cwd ?? PROJECT_ROOT,
    maxBuffer: 2 * 1024 * 1024,
    timeout: opts.timeout ?? 60_000,
  }).toString();
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new MCPServer({
  name: "gear-ai-workspace",
  title: "Gear AI Workspace",
  version: "1.0.0",
  description:
    "All-in-one MCP assistant for Gear AI: vehicle data, codebase analysis, file editing, and build utilities",
  baseUrl: process.env.MCP_URL ?? "http://localhost:3000",
  favicon: "favicon.ico",
  icons: [{ src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] }],
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN 1 — Vehicle Data
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  {
    name: "list-vehicles",
    description: "List all vehicles for a given user from the Gear AI database",
    schema: z.object({
      user_id: z.string().describe("The user's UUID from Supabase"),
      include_inactive: z
        .boolean()
        .optional()
        .describe("Include soft-deleted vehicles (default: false)"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ user_id, include_inactive = false }) => {
    const missing = requireSupabase();
    if (missing) return missing;
    try {
      let query = supabase!
        .from("vehicles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });
      if (!include_inactive) query = query.eq("is_active", true);
      const { data, error: err } = await query;
      if (err) return error(`Failed to list vehicles: ${err.message}`);
      return object({ total: data?.length ?? 0, vehicles: data ?? [] });
    } catch (e) {
      return error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "get-vehicle",
    description: "Get a single vehicle record by its vehicle_id",
    schema: z.object({
      vehicle_id: z.string().describe("The vehicle's UUID"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ vehicle_id }) => {
    const missing = requireSupabase();
    if (missing) return missing;
    try {
      const { data, error: err } = await supabase!
        .from("vehicles")
        .select("*")
        .eq("vehicle_id", vehicle_id)
        .single();
      if (err) return error(`Vehicle not found: ${err.message}`);
      return object(data);
    } catch (e) {
      return error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "add-vehicle",
    description: "Add a new vehicle to a user's garage in the Gear AI database",
    schema: z.object({
      user_id: z.string().describe("The owner's Supabase UUID"),
      year: z.number().int().min(1900).max(2030).describe("Model year (e.g., 2021)"),
      make: z.string().describe("Manufacturer (e.g., Toyota)"),
      model: z.string().describe("Model name (e.g., Camry)"),
      vin: z.string().optional().describe("17-character VIN"),
      trim: z.string().optional().describe("Trim level (e.g., XLE)"),
      color: z.string().optional().describe("Exterior color"),
      mileage: z.number().optional().describe("Current odometer reading in miles"),
      license_plate: z.string().optional().describe("License plate number"),
      nickname: z.string().optional().describe("User-defined nickname"),
      status: z
        .enum(["active", "stored", "for_sale", "sold", "totaled"])
        .optional()
        .describe("Vehicle status (default: active)"),
    }),
  },
  async (input) => {
    const missing = requireSupabase();
    if (missing) return missing;
    try {
      const { data, error: err } = await supabase!
        .from("vehicles")
        .insert({
          user_id: input.user_id,
          year: input.year,
          make: input.make,
          model: input.model,
          vin: input.vin ?? "",
          trim: input.trim,
          color: input.color,
          current_mileage: input.mileage,
          license_plate: input.license_plate,
          nickname: input.nickname,
          status: input.status ?? "active",
          is_active: true,
        })
        .select()
        .single();
      if (err) return error(`Failed to add vehicle: ${err.message}`);
      return object({
        success: true,
        vehicle: data,
        message: `${input.year} ${input.make} ${input.model} added successfully`,
      });
    } catch (e) {
      return error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "update-vehicle",
    description: "Update one or more fields on an existing vehicle record",
    schema: z.object({
      vehicle_id: z.string().describe("The vehicle's UUID to update"),
      fields: z
        .record(z.string(), z.unknown())
        .describe(
          "Key-value pairs of fields to update (e.g., {current_mileage: 50000, color: 'Red'})"
        ),
    }),
  },
  async ({ vehicle_id, fields }) => {
    const missing = requireSupabase();
    if (missing) return missing;
    try {
      const { data, error: err } = await supabase!
        .from("vehicles")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("vehicle_id", vehicle_id)
        .select()
        .single();
      if (err) return error(`Failed to update vehicle: ${err.message}`);
      return object({ success: true, vehicle: data });
    } catch (e) {
      return error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "delete-vehicle",
    description:
      "Soft-delete a vehicle by setting is_active=false. Data is preserved and can be restored.",
    schema: z.object({
      vehicle_id: z.string().describe("The vehicle's UUID to deactivate"),
    }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ vehicle_id }) => {
    const missing = requireSupabase();
    if (missing) return missing;
    try {
      const { error: err } = await supabase!
        .from("vehicles")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("vehicle_id", vehicle_id);
      if (err) return error(`Failed to deactivate vehicle: ${err.message}`);
      return text(`Vehicle ${vehicle_id} deactivated successfully`);
    } catch (e) {
      return error(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN 2 — Codebase Analysis
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  {
    name: "search-code",
    description: "Search the Gear AI codebase for a pattern using ripgrep",
    schema: z.object({
      pattern: z.string().describe("Regex or literal string to search for"),
      glob: z
        .string()
        .optional()
        .describe("Glob pattern to filter files (e.g., '*.ts', '**/*.tsx')"),
      case_insensitive: z
        .boolean()
        .optional()
        .describe("Case-insensitive search (default: false)"),
      context_lines: z
        .number()
        .int()
        .min(0)
        .max(10)
        .optional()
        .describe("Lines of context around each match (default: 2)"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum result lines to return (default: 50)"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({
    pattern,
    glob: globPattern,
    case_insensitive = false,
    context_lines = 2,
    max_results = 50,
  }) => {
    try {
      const flags = [
        `--context=${context_lines}`,
        "--glob=!**/node_modules/**",
        "--glob=!**/dist/**",
        "--glob=!**/.git/**",
        "--glob=!**/mcp-server/node_modules/**",
        "-n",
      ];
      if (case_insensitive) flags.push("-i");
      if (globPattern) flags.push(`--glob=${globPattern}`);
      const cmd = `rg ${flags.join(" ")} -- ${JSON.stringify(pattern)} ${PROJECT_ROOT}`;
      const result = safeExec(cmd);
      const lines = result.split("\n");
      const trimmed = lines.slice(0, max_results).join("\n");
      return markdown(
        `## Search: \`${pattern}\`${globPattern ? ` | Filter: \`${globPattern}\`` : ""}\n\n` +
          `\`\`\`\n${trimmed}\n\`\`\`\n\n_Showing up to ${max_results} lines_`
      );
    } catch (e: any) {
      if (e.status === 1) return text(`No matches found for pattern: "${pattern}"`);
      return error(`Search failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "read-file",
    description: "Read the contents of a file in the Gear AI project",
    schema: z.object({
      file_path: z
        .string()
        .describe(
          "Path relative to project root (e.g., 'services/vehicle-service.ts')"
        ),
      start_line: z
        .number()
        .int()
        .optional()
        .describe("First line to return, 1-indexed (optional)"),
      end_line: z
        .number()
        .int()
        .optional()
        .describe("Last line to return, 1-indexed (optional)"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ file_path, start_line, end_line }) => {
    try {
      const absPath = path.resolve(PROJECT_ROOT, file_path);
      if (!absPath.startsWith(PROJECT_ROOT))
        return error("Access denied: path is outside project root");
      const content = fs.readFileSync(absPath, "utf-8");
      let lines = content.split("\n");
      if (start_line || end_line) {
        lines = lines.slice((start_line ?? 1) - 1, end_line ?? lines.length);
      }
      const lang = path.extname(file_path).replace(".", "") || "text";
      return markdown(`## ${file_path}\n\n\`\`\`${lang}\n${lines.join("\n")}\n\`\`\``);
    } catch (e: any) {
      if (e.code === "ENOENT") return error(`File not found: ${file_path}`);
      return error(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "list-files",
    description: "List files in the Gear AI project matching a glob pattern",
    schema: z.object({
      pattern: z
        .string()
        .describe(
          "Glob pattern relative to project root (e.g., 'services/**/*.ts', 'app/**/*.tsx')"
        ),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ pattern }) => {
    try {
      const result = safeExec(
        `rg --files --glob '${pattern}' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.git/**' ${PROJECT_ROOT} | head -100`
      );
      const files = result
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((f) => f.replace(PROJECT_ROOT + "/", ""));
      return object({ pattern, count: files.length, files });
    } catch (e) {
      return error(
        `Failed to list files: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

server.tool(
  {
    name: "analyze-dependencies",
    description:
      "Analyze the Gear AI app's package.json: list dependencies and npm scripts",
    schema: z.object({
      show_dev: z
        .boolean()
        .optional()
        .describe("Include devDependencies in output (default: true)"),
    }),
    annotations: { readOnlyHint: true },
  },
  async ({ show_dev = true }) => {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")
      );
      return object({
        name: pkg.name,
        version: pkg.version,
        scripts: pkg.scripts ?? {},
        dependencies: pkg.dependencies ?? {},
        ...(show_dev ? { devDependencies: pkg.devDependencies ?? {} } : {}),
      });
    } catch (e) {
      return error(
        `Failed to read package.json: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN 3 — File Editing
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  {
    name: "edit-file",
    description:
      "Replace an exact string occurrence in a project file. old_str must match exactly one occurrence (including whitespace).",
    schema: z.object({
      file_path: z
        .string()
        .describe(
          "Path relative to project root (e.g., 'services/vehicle-service.ts')"
        ),
      old_str: z
        .string()
        .describe("Exact string to find and replace (must be unique in the file)"),
      new_str: z.string().describe("Replacement string"),
    }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ file_path, old_str, new_str }) => {
    try {
      const absPath = path.resolve(PROJECT_ROOT, file_path);
      if (!absPath.startsWith(PROJECT_ROOT))
        return error("Access denied: path is outside project root");
      const content = fs.readFileSync(absPath, "utf-8");
      const count = content.split(old_str).length - 1;
      if (count === 0)
        return error(
          `String not found in ${file_path}. Verify old_str matches exactly.`
        );
      if (count > 1)
        return error(
          `Found ${count} occurrences of old_str in ${file_path}. Add more context to make it unique.`
        );
      fs.writeFileSync(absPath, content.replace(old_str, new_str), "utf-8");
      return text(`✅ Successfully edited ${file_path}`);
    } catch (e: any) {
      if (e.code === "ENOENT") return error(`File not found: ${file_path}`);
      return error(`Failed to edit file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "create-file",
    description:
      "Create a new file in the project with given content. Fails if the file already exists unless overwrite is true.",
    schema: z.object({
      file_path: z
        .string()
        .describe("Path relative to project root for the new file"),
      content: z.string().describe("Full text content to write to the file"),
      overwrite: z
        .boolean()
        .optional()
        .describe("Allow overwriting an existing file (default: false)"),
    }),
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
  async ({ file_path, content, overwrite = false }) => {
    try {
      const absPath = path.resolve(PROJECT_ROOT, file_path);
      if (!absPath.startsWith(PROJECT_ROOT))
        return error("Access denied: path is outside project root");
      if (!overwrite && fs.existsSync(absPath))
        return error(
          `File already exists: ${file_path}. Set overwrite: true to replace it.`
        );
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
      return text(`✅ Created ${file_path} (${content.length} bytes)`);
    } catch (e) {
      return error(
        `Failed to create file: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN 4 — Build & Management
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  {
    name: "run-lint",
    description: "Run ESLint on the Gear AI project (npm run lint) and return output",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      const result = safeExec("npm run lint 2>&1");
      return markdown(`## Lint Results\n\n\`\`\`\n${result}\n\`\`\``);
    } catch (e: any) {
      const output = e.stdout?.toString() ?? e.message;
      return markdown(`## Lint Results (Issues Found)\n\n\`\`\`\n${output}\n\`\`\``);
    }
  }
);

server.tool(
  {
    name: "run-type-check",
    description: "Run TypeScript type checking on the Gear AI project with tsc --noEmit",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      const result = safeExec("npx tsc --noEmit 2>&1");
      return text(`✅ TypeScript: No type errors found\n\n${result}`);
    } catch (e: any) {
      const output = e.stdout?.toString() ?? e.stderr?.toString() ?? e.message;
      return markdown(`## TypeScript Errors\n\n\`\`\`\n${output}\n\`\`\``);
    }
  }
);

server.tool(
  {
    name: "get-app-status",
    description:
      "Get the current git branch, working tree status, recent commits, and project metadata for Gear AI",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
  },
  async () => {
    try {
      const branch = safeExec("git rev-parse --abbrev-ref HEAD").trim();
      const status = safeExec("git --no-pager status --short").trim();
      const commits = safeExec("git --no-pager log --oneline -10").trim();
      const pkg = JSON.parse(
        fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")
      );
      return object({
        branch,
        git_status: status || "clean",
        recent_commits: commits.split("\n"),
        app: { name: pkg.name, version: pkg.version },
        project_root: PROJECT_ROOT,
      });
    } catch (e) {
      return error(
        `Failed to get app status: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

const ALLOWED_SCRIPTS = ["lint", "build", "setup"] as const;

server.tool(
  {
    name: "run-script",
    description: `Run an allowed npm script from the Gear AI project. Allowed: ${ALLOWED_SCRIPTS.join(", ")}`,
    schema: z.object({
      script: z
        .enum(ALLOWED_SCRIPTS)
        .describe(`npm script name to run (one of: ${ALLOWED_SCRIPTS.join(", ")})`),
      timeout_seconds: z
        .number()
        .int()
        .min(5)
        .max(120)
        .optional()
        .describe("Timeout in seconds (default: 60)"),
    }),
  },
  async ({ script, timeout_seconds = 60 }) => {
    try {
      const result = safeExec(`npm run ${script} 2>&1`, {
        timeout: timeout_seconds * 1000,
      });
      return markdown(`## npm run ${script}\n\n\`\`\`\n${result}\n\`\`\``);
    } catch (e: any) {
      const output = e.stdout?.toString() ?? e.message;
      return markdown(
        `## npm run ${script} (Exit Code: ${e.status ?? "unknown"})\n\n\`\`\`\n${output}\n\`\`\``
      );
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ═══════════════════════════════════════════════════════════════════════════════

server.resource(
  {
    name: "project_structure",
    uri: "project://structure",
    title: "Project Structure",
    description: "Directory tree of the Gear AI project (excludes node_modules, dist, .git)",
  },
  async () => {
    try {
      const result = safeExec(
        "find . -not -path './node_modules*' -not -path './dist*' -not -path './.git*' " +
          "-not -path './mcp-server/node_modules*' -not -path './mcp-server/dist*' | sort | head -200"
      );
      return text(result);
    } catch (e) {
      return error(
        `Failed to get project structure: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

server.resource(
  {
    name: "project_readme",
    uri: "project://readme",
    title: "Project README",
    description: "Contents of the Gear AI README.md",
  },
  async () => {
    try {
      const content = fs.readFileSync(
        path.join(PROJECT_ROOT, "README.md"),
        "utf-8"
      );
      return text(content);
    } catch (e) {
      return error(
        `Failed to read README: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen().then(() => {
  console.log("🚗 Gear AI Workspace MCP Server running");
  console.log(`📁 Project root: ${PROJECT_ROOT}`);
  console.log(
    `🗄️  Supabase: ${supabase ? "configured ✅" : "not configured ⚠️  (set SUPABASE_URL and SUPABASE_SERVICE_KEY)"}`
  );
});
