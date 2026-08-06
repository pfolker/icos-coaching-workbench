/**
 * Test Build v1 server. Static file server + one POST endpoint that runs
 * a submitted transcript through the real, unmodified pipeline (see
 * realTurn.ts) and appends a diagnostic entry to the suppression log (see
 * suppressionLog.ts). No account system, no auth, no persistence beyond
 * the local log file — fully standalone and disposable.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runRealTurn } from "./realTurn";
import { appendLogEntry } from "./suppressionLog";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4326);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync(join(here, "../public/index.html")));
    }
    if (req.method === "GET" && (url.pathname === "/app.js" || url.pathname === "/app.css")) {
      const ext = url.pathname.endsWith(".js") ? ".js" : ".css";
      res.writeHead(200, { "content-type": CONTENT_TYPES[ext]! });
      return res.end(readFileSync(join(here, `../public${url.pathname}`)));
    }

    if (req.method === "POST" && url.pathname === "/api/submit") {
      const bodyText = await readBody(req);
      let parsed: { transcript?: unknown; session_id?: unknown; turn_label?: unknown; force_failure?: unknown };
      try {
        parsed = JSON.parse(bodyText || "{}");
      } catch {
        return json(res, 400, { error: { code: "BAD_JSON", message: "request body must be valid JSON" } });
      }
      const transcript = typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
      if (!transcript) {
        return json(res, 400, { error: { code: "EMPTY_TRANSCRIPT", message: "transcript must be a non-empty string" } });
      }
      const sessionId = typeof parsed.session_id === "string" && parsed.session_id ? parsed.session_id : "unknown-session";
      const turnLabel = typeof parsed.turn_label === "string" && parsed.turn_label ? parsed.turn_label : "turn";
      // Verification-only hook (Step 7's forced-failure test). The shipped
      // frontend (public/app.js) never sends this field.
      const forceFailure = parsed.force_failure === true;

      const { result, logDetail } = await runRealTurn(transcript, { forceFailure });
      appendLogEntry(sessionId, turnLabel, logDetail);
      return json(res, 200, result);
    }

    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "no such route" } }));
  } catch (e) {
    const anyE = e as { message?: string };
    res.writeHead(500, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "INTERNAL", message: anyE.message ?? "error" } }));
  }
}).listen(PORT, () => {
  console.log(`Test Build v1 -> http://localhost:${PORT}`);
});
