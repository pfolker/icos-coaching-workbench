/**
 * Alpha Workbench — HTTP server. Static UI + JSON API. No framework.
 * The API surface IS the UI↔engine contract; engines are never exposed raw.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { advance, createSession, debugView, getSession, goDeeper, lockIn, publicView, recordClaim, recordPick, submitAnswer, submitRetry } from "./orchestrator";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4321);

const json = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const readBody = (req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1_000_000) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid JSON")); } });
  });

createServer(async (req, res) => {
  const url = req.url ?? "/";
  try {
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync(join(here, "../public/index.html")));
    }
    if (req.method === "GET" && url === "/coachNotes.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(readFileSync(join(here, "../public/coachNotes.js")));
    }
    if (req.method === "POST" && url === "/api/session") {
      const s = createSession();
      return json(res, 201, { session: publicView(s), debug: debugView(s) });
    }
    const m = url.match(/^\/api\/session\/([a-z0-9]+)(\/(answer|retry|advance|pick|claim|go-deeper|lock-in))?$/);
    if (m) {
      const id = m[1]!;
      const action = m[3];
      if (req.method === "GET" && !action) {
        const s = getSession(id);
        return json(res, 200, { session: publicView(s), debug: debugView(s) });
      }
      if (req.method === "POST" && action) {
        const body = await readBody(req);
        const transcript = typeof body.transcript === "string" ? body.transcript : "";
        const duration = typeof body.duration_seconds === "number" ? body.duration_seconds : undefined;
        if (action === "answer") return json(res, 200, submitAnswer(id, transcript, duration));
        if (action === "retry") return json(res, 200, submitRetry(id, transcript, duration));
        if (action === "advance") return json(res, 200, advance(id));
        if (action === "pick") return json(res, 200, recordPick(id, body.version === "v1" ? "v1" : "v2"));
        if (action === "claim") return json(res, 200, recordClaim(id, String(body.text ?? "")));
        if (action === "go-deeper") return json(res, 200, goDeeper(id));
        if (action === "lock-in") return json(res, 200, lockIn(id, transcript));
      }
    }
    return json(res, 404, { error: { code: "NOT_FOUND", message: "no such route" } });
  } catch (e) {
    const anyE = e as { code?: string; status?: number; message?: string };
    const status = anyE.status ?? (anyE.code === "INPUT_INVALID" ? 400 : 500);
    return json(res, status, { error: { code: anyE.code ?? "INTERNAL", message: anyE.message ?? "error" } });
  }
}).listen(PORT, () => {
  console.log(`Alpha Workbench → http://localhost:${PORT}`);
  console.log("Engines: observation → opportunity → decision → conversation → comparison (all frozen, all imported directly)");
});
