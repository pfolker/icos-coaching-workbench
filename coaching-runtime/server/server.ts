/**
 * Coaching Runtime Prototype — Debug UI server. Same pattern as
 * evidence-runtime's: static developer-inspection page + a tiny JSON API.
 * Not the Alpha Workbench; separate port, separate package.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateEvidence } from "../../evidence-validator/src/index";
import { materializeSourceSpans } from "../../evidence-runtime/src/modelOutput";
import { runListenEngineFixture } from "../../evidence-runtime/src/listenEngine";
import { buildEvidenceGraph, EvidenceGraph } from "../../evidence-runtime/src/evidenceGraph";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case002 from "../../evidence-runtime/fixtures/case002";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import * as founderCase from "../src/founderCase";
import { runCoachingRuntime } from "../src/pipeline";
import { hasLiveApiKey, NoApiKeyError } from "../src/narrator";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4323);

interface CaseDef { case_id: string; label: string; transcript: string; fixture: ReturnType<typeof runListenEngineFixture>["raw"]; fixtureMessage: string; }

const CASES: CaseDef[] = [
  { case_id: "001", label: "Case 001 — Founder's Original Answer", transcript: case001.TRANSCRIPT, fixture: case001.LISTEN_ENGINE_FIXTURE,
    // Corrected: the previous version of this message said "an indicator
    // check" — that content belongs to Case 002/founder's transcript, not
    // this one. Case 001 never mentions an indicator anywhere. See
    // README.md's grounding-check incident report.
    fixtureMessage: "You named the fix: two locating divots machined into the part and a conical gripper profile, after realizing the robot was applying force that let the casting move on a rough casting surface." },
  { case_id: "002", label: "Case 002 — Founder's Retry (Atlas wording)", transcript: case002.TRANSCRIPT, fixture: case002.LISTEN_ENGINE_FIXTURE,
    fixtureMessage: "You named the diagnostic method and the fix: an indicator check before and after, plus the conical gripper redesign." },
  { case_id: "009", label: "Case 009 — Genuine Quotes, Invalid Reasoning", transcript: case009.TRANSCRIPT, fixture: case009.LISTEN_ENGINE_FIXTURE,
    fixtureMessage: "You haven't put a number on the drop yet — how many complaints, or by what percent?" },
  { case_id: "founder", label: "Founder's Actual Real Retry Text (capstone test)", transcript: founderCase.TRANSCRIPT, fixture: founderCase.LISTEN_ENGINE_FIXTURE,
    fixtureMessage: "You named the tools and the fix: an indicator check, two locating divots, and a conical gripper redesign." },
];

function graphFor(c: CaseDef): EvidenceGraph {
  const output = validateEvidence(materializeSourceSpans(c.transcript, c.fixture));
  return buildEvidenceGraph(output);
}

const json = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
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
      res.writeHead(200, { "content-type": ext === ".js" ? "text/javascript" : "text/css" });
      return res.end(readFileSync(join(here, `../public${url.pathname}`)));
    }

    if (req.method === "GET" && url.pathname === "/api/cases") {
      return json(res, 200, { cases: CASES.map((c) => ({ case_id: c.case_id, label: c.label })), live_available: hasLiveApiKey() });
    }

    const m = url.pathname.match(/^\/api\/run\/([a-z0-9-]+)$/);
    if (req.method === "GET" && m) {
      const caseId = m[1]!;
      const mode = url.searchParams.get("mode") === "live" ? "live" : "fixture";
      const found = CASES.find((c) => c.case_id === caseId);
      if (!found) return json(res, 404, { error: { code: "NOT_FOUND", message: `no such case: ${caseId}` } });

      const graph = graphFor(found);
      try {
        const result = await runCoachingRuntime({
          case_id: found.case_id, graph, mode,
          fixtureMessage: mode === "fixture" ? found.fixtureMessage : undefined,
        });
        return json(res, 200, { case_id: found.case_id, label: found.label, mode, transcript: found.transcript, result });
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
  console.log(`Coaching Runtime Debug UI -> http://localhost:${PORT}`);
  console.log(`Live mode: ${hasLiveApiKey() ? "available" : "UNAVAILABLE — no ANTHROPIC_API_KEY"}`);
});
