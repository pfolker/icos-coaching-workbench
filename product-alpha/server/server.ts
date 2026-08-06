/**
 * Product Alpha server. Static file server + one read-only JSON endpoint
 * serving the frozen reference scenario (referenceScenario.ts). No
 * Decision Engine, Observation Engine, evidence-*, opportunity-engine, or
 * coaching-runtime import anywhere in this package — the data those
 * packages once produced was captured once, by hand, outside this
 * package, and is served here as a literal constant. No live typing is
 * accepted anywhere; no input is ever processed by a backend.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { QUESTION, FIRST_TAKE, RETRY, LOCK_IN, NEXT_QUESTION_MARKER } from "./referenceScenario";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4325);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

createServer((req, res) => {
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

    if (req.method === "GET" && url.pathname === "/api/reference-scenario") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ question: QUESTION, firstTake: FIRST_TAKE, retry: RETRY, lockIn: LOCK_IN, nextQuestionMarker: NEXT_QUESTION_MARKER }));
    }

    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "no such route" } }));
  } catch (e) {
    const anyE = e as { message?: string };
    res.writeHead(500, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: { code: "INTERNAL", message: anyE.message ?? "error" } }));
  }
}).listen(PORT, () => {
  console.log(`Product Alpha -> http://localhost:${PORT}`);
});
