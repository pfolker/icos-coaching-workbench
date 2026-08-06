/**
 * Shadow-mode comparison tool — Debug UI server. Same pattern as
 * evidence-runtime's / coaching-runtime's: static page + a tiny JSON API.
 * A person runs this deliberately; it is not in any real learner's request
 * path (nothing here touches the live Alpha Workbench).
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { KNOWN_CASES, findKnownCase } from "../src/knownCases";
import { runShadowCompare, hasLiveApiKey, NoApiKeyError } from "../src/pipeline";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4324);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function serveStatic(path: string, res: import("node:http").ServerResponse): boolean {
  const rel = path === "/" ? "/index.html" : path;
  const ext = extname(rel);
  if (!MIME[ext]) return false;
  try {
    const body = readFileSync(join(here, "..", "public", rel));
    res.writeHead(200, { "content-type": MIME[ext] });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/cases") {
    sendJson(res, 200, {
      cases: KNOWN_CASES.map((c) => ({ case_id: c.case_id, label: c.label, transcript: c.transcript })),
      live_available: hasLiveApiKey(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/run") {
    let bodyText = "";
    for await (const chunk of req) bodyText += chunk;
    let body: { case_id?: string; transcript?: string; mode?: "live" | "fixture" };
    try {
      body = JSON.parse(bodyText || "{}");
    } catch {
      sendJson(res, 400, { error: { code: "BAD_JSON", message: "request body must be JSON" } });
      return;
    }

    const mode = body.mode === "live" ? "live" : "fixture";
    let transcript = body.transcript?.trim();
    let fixture;

    if (body.case_id) {
      const known = findKnownCase(body.case_id);
      if (!known) {
        sendJson(res, 404, { error: { code: "UNKNOWN_CASE", message: `no known case: ${body.case_id}` } });
        return;
      }
      transcript = known.transcript;
      fixture = known.fixture;
    }

    if (!transcript) {
      sendJson(res, 400, { error: { code: "INPUT_INVALID", message: "transcript is required" } });
      return;
    }
    if (mode === "fixture" && !fixture) {
      sendJson(res, 400, {
        error: {
          code: "NO_FIXTURE",
          message: "fixture mode only works for a known case (no hand-authored fixture exists for arbitrary pasted text) — switch to live mode or pick a known case",
        },
      });
      return;
    }

    try {
      const result = await runShadowCompare({ transcript, mode, fixture });
      sendJson(res, 200, { result });
    } catch (e) {
      if (e instanceof NoApiKeyError) {
        sendJson(res, 503, { error: { code: "NO_API_KEY", message: e.message } });
        return;
      }
      const err = e as Error;
      sendJson(res, 500, { error: { code: "PIPELINE_ERROR", message: err.message } });
    }
    return;
  }

  if (req.method === "GET" && serveStatic(url.pathname, res)) return;

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`evidence-shadow-compare Debug UI: http://localhost:${PORT}`);
  console.log(`live mode available: ${hasLiveApiKey()}`);
});
