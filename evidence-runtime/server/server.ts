/**
 * Evidence Runtime Prototype — Debug UI server. Static developer-inspection
 * page + a tiny JSON API. This is NOT the Alpha Workbench and does not
 * touch it: separate port, separate package, no shared server code.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FIXTURE_CASES } from "../fixtures/index";
import { hasLiveApiKey, NoApiKeyError, runListenEngineFixture, runListenEngineLive } from "../src/listenEngine";
import { runPipeline } from "../src/pipeline";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4322);

const json = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync(join(here, "../public/index.html")));
    }
    if (req.method === "GET" && (url.pathname === "/debugUI.js" || url.pathname === "/debugUI.css")) {
      const ext = url.pathname.endsWith(".js") ? ".js" : ".css";
      res.writeHead(200, { "content-type": CONTENT_TYPES[ext]! });
      return res.end(readFileSync(join(here, `../public${url.pathname}`)));
    }

    if (req.method === "GET" && url.pathname === "/api/cases") {
      return json(res, 200, {
        cases: FIXTURE_CASES.map((c) => ({ case_id: c.case_id, label: c.label })),
        live_available: hasLiveApiKey(),
      });
    }

    const m = url.pathname.match(/^\/api\/run\/([a-z0-9-]+)$/);
    if (req.method === "GET" && m) {
      const caseId = m[1]!;
      const mode = url.searchParams.get("mode") === "live" ? "live" : "fixture";
      const found = FIXTURE_CASES.find((c) => c.case_id === caseId);
      if (!found) return json(res, 404, { error: { code: "NOT_FOUND", message: `no such case: ${caseId}` } });

      if (mode === "fixture") {
        const listenResult = runListenEngineFixture(found.fixture);
        const result = runPipeline(found.case_id, found.transcript, listenResult);
        return json(res, 200, { case_id: found.case_id, label: found.label, mode, result });
      }

      try {
        const listenResult = await runListenEngineLive(found.transcript);
        const result = runPipeline(found.case_id, found.transcript, listenResult);
        return json(res, 200, { case_id: found.case_id, label: found.label, mode, result });
      } catch (e) {
        if (e instanceof NoApiKeyError) {
          return json(res, 200, { case_id: found.case_id, label: found.label, mode, error: { code: "NO_API_KEY", message: e.message } });
        }
        throw e;
      }
    }

    return json(res, 404, { error: { code: "NOT_FOUND", message: "no such route" } });
  } catch (e) {
    const anyE = e as { message?: string };
    return json(res, 500, { error: { code: "INTERNAL", message: anyE.message ?? "error" } });
  }
}).listen(PORT, () => {
  console.log(`Evidence Runtime Debug UI -> http://localhost:${PORT}`);
  console.log(`Live mode: ${hasLiveApiKey() ? "available (ANTHROPIC_API_KEY set)" : "UNAVAILABLE — no ANTHROPIC_API_KEY in this environment"}`);
});
