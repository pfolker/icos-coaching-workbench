/**
 * Founder Calibration Workbench server (Phase 3).
 *
 * node:http, no framework. Serves the two-column comparison UI and:
 *   GET  /api/cases            → the calibration corpus (id/label/domain)
 *   GET  /api/compare?case=ID  → runs BOTH coaches live, returns both outputs
 *   POST /api/observe          → append one four-field observation (JSONL)
 *   GET  /api/observations     → all saved observations
 *
 * The structured coach makes a live Narrator call per compare; refuses if no
 * ANTHROPIC_API_KEY (never fabricates output).
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { hasLiveApiKey } from "../../coaching-runtime/src/coachProvider";
import { CALIBRATION_CASES, CALIBRATION_CASES_BY_ID } from "../src/corpus";
import { runComparison } from "../src/runComparison";
import { appendObservation, readObservations, CalibrationObservation } from "../src/observations";

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, "../public");
const OBS_PATH = join(here, "../logs/observations.jsonl");
const PORT = Number(process.env.PORT ?? 4325);

const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function send(res: import("node:http").ServerResponse, status: number, body: string, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname;

    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      return send(res, 200, readFileSync(join(PUBLIC, "index.html"), "utf8"), "text/html");
    }
    if (req.method === "GET" && (path === "/app.js" || path === "/app.css")) {
      const file = join(PUBLIC, path.slice(1));
      if (existsSync(file)) return send(res, 200, readFileSync(file, "utf8"), MIME[extname(file)] ?? "text/plain");
    }

    if (req.method === "GET" && path === "/api/cases") {
      return send(res, 200, JSON.stringify(CALIBRATION_CASES.map((c) => ({ id: c.id, label: c.label, domain: c.domain }))));
    }

    if (req.method === "GET" && path === "/api/compare") {
      const id = url.searchParams.get("case") ?? "";
      const c = CALIBRATION_CASES_BY_ID.get(id);
      if (!c) return send(res, 404, JSON.stringify({ error: `unknown case ${id}` }));
      if (!hasLiveApiKey()) return send(res, 400, JSON.stringify({ error: "NO_API_KEY: ANTHROPIC_API_KEY not configured; refusing to fabricate structured-coach output." }));
      const result = await runComparison(c);
      return send(res, 200, JSON.stringify(result));
    }

    if (req.method === "GET" && path === "/api/observations") {
      return send(res, 200, JSON.stringify(readObservations(OBS_PATH)));
    }

    if (req.method === "POST" && path === "/api/observe") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || "{}") as Omit<CalibrationObservation, "ts">;
      if (!body.case_id) return send(res, 400, JSON.stringify({ error: "case_id required" }));
      const saved = appendObservation(OBS_PATH, {
        case_id: body.case_id,
        preferred: body.preferred ?? "",
        why: body.why ?? "",
        constitution: body.constitution ?? "PASS",
        constitution_note: body.constitution_note ?? "",
        retry_motivation: body.retry_motivation ?? "",
        surprised: body.surprised ?? "",
        surprised_note: body.surprised_note ?? "",
        notes: body.notes ?? "",
      });
      return send(res, 200, JSON.stringify(saved));
    }

    return send(res, 404, JSON.stringify({ error: "not found" }));
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Founder Calibration Workbench → http://localhost:${PORT}`);
  console.log(`Cases: ${CALIBRATION_CASES.length} | live key: ${hasLiveApiKey() ? "present" : "MISSING"} | observations → logs/observations.jsonl`);
});
