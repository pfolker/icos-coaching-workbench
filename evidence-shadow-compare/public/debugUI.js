const caseSelect = document.getElementById("caseSelect");
const modeSelect = document.getElementById("modeSelect");
const runBtn = document.getElementById("runBtn");
const liveStatus = document.getElementById("liveStatus");
const transcriptBox = document.getElementById("transcriptBox");
const stagesEl = document.getElementById("stages");

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const json = (obj) => `<pre class="json">${esc(JSON.stringify(obj, null, 2))}</pre>`;

let KNOWN_CASES = [];

async function loadCases() {
  const res = await fetch("/api/cases");
  const data = await res.json();
  KNOWN_CASES = data.cases;
  caseSelect.innerHTML =
    `<option value="">— paste your own below —</option>` +
    data.cases.map((c) => `<option value="${c.case_id}">${esc(c.label)}</option>`).join("");
  liveStatus.textContent = data.live_available ? "live mode available" : "live mode unavailable (no API key)";
  liveStatus.className = "live-status " + (data.live_available ? "available" : "unavailable");
}

caseSelect.addEventListener("change", () => {
  const known = KNOWN_CASES.find((c) => c.case_id === caseSelect.value);
  transcriptBox.value = known ? known.transcript : "";
});

function stage(title, bodyHtml, openByDefault) {
  const el = document.createElement("details");
  el.className = "stage";
  el.open = !!openByDefault;
  el.innerHTML = `<summary>${esc(title)}</summary><div class="stage-body">${bodyHtml}</div>`;
  return el;
}

function renderQuickScan(scan) {
  const order = ["STORY", "CREDIBILITY", "IMPACT", "DELIVERY"];
  return order
    .filter((cat) => scan[cat] && scan[cat].length > 0)
    .map((cat) => `
      <div class="note-cat">
        <h4>${cat}</h4>
        ${scan[cat].map((n) => `
          <div class="note ${n.polarity}">
            <div>${esc(n.label)}</div>
            ${n.explanation ? `<div class="explanation">${esc(n.explanation)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    `).join("") || '<p class="plain">nothing fired</p>';
}

function renderCandidates(candidates) {
  if (candidates.length === 0) return '<p class="plain">no candidates fired</p>';
  return `<div class="claim-list">${candidates.map((c) => `
    <div class="claim pass"><b>${esc(c.opportunity_id)}</b> — confidence ${c.confidence}, growth ${esc(c.growth_potential)}</div>
  `).join("")}</div>`;
}

function renderDecision(decision) {
  if (decision.decision_type === "reinforce_only") {
    return `<span class="badge reinforce">reinforce only</span><p class="plain">no coachable candidate this turn</p>`;
  }
  const sel = decision.selected;
  return `
    <div class="claim pass"><b>${esc(sel.opportunity.opportunity_id)}</b> via ${esc(sel.intervention_type)} (${esc(sel.priority_class)})</div>
    ${decision.reasoning.rejected.length ? `<p class="plain">${decision.reasoning.rejected.length} rejected: ${decision.reasoning.rejected.map((r) => esc(r.opportunity_id)).join(", ")}</p>` : ""}
  `;
}

function renderEvidenceGraph(graph) {
  return `<div class="claim-list">
    ${graph.nodes.map((n) => `<div class="claim pass"><b>${esc(n.id)}</b> — ${esc(n.claim_type)}<div>&ldquo;${esc(n.quote)}&rdquo;</div></div>`).join("") || '<p class="plain">no nodes</p>'}
    ${graph.edges.map((e) => `<div class="claim pass"><b>${esc(e.id)}</b> — ${esc(e.relationship_type)} (${e.component_ids.map(esc).join(", ")})</div>`).join("")}
  </div>`;
}

function renderUnmapped(list) {
  return `<div class="unmapped-note">
    <h3>Step 1 finding: 7 of 9 opportunity ids do NOT map onto the Evidence Graph (by design, not oversight)</h3>
    <ul>${list.map((u) => `<li><code>${esc(u.opportunity_id)}</code> — ${esc(u.reason)}</li>`).join("")}</ul>
  </div>`;
}

async function run() {
  const case_id = caseSelect.value || undefined;
  const mode = modeSelect.value;
  const transcript = transcriptBox.value.trim();
  if (!case_id && !transcript) {
    stagesEl.innerHTML = `<p class="plain">paste a transcript or pick a known case first</p>`;
    return;
  }
  stagesEl.innerHTML = `<p class="plain">Running comparison in ${esc(mode)} mode...</p>`;

  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ case_id, transcript, mode }),
  });
  const data = await res.json();

  if (data.error) {
    stagesEl.innerHTML = `<div class="error-box"><b>${esc(data.error.code)}</b>: ${esc(data.error.message)}</div>`;
    return;
  }

  const r = data.result;
  stagesEl.innerHTML = "";
  stagesEl.appendChild(stage("Transcript", `<div class="transcript-box">${esc(r.transcript)}</div>`, true));
  stagesEl.appendChild(stage("Step 1 mapping gap (7 unmapped ids)", renderUnmapped(r.unmapped_opportunity_ids), false));

  const columns = document.createElement("div");
  columns.className = "columns";
  columns.innerHTML = `
    <div>
      <div class="col-head left">LEFT — regex Observation -&gt; Opportunity -&gt; Decision (today's Workbench, unmodified)</div>
      <div class="col-body">
        <h4>Candidates fired (${r.left.candidates.length})</h4>
        ${renderCandidates(r.left.candidates)}
        <h4>Decision</h4>
        ${renderDecision(r.left.decision)}
        <h4>Coach's Notes (quickScan, via proof.ts/categoryMap.ts)</h4>
        ${renderQuickScan(r.left.quick_scan)}
      </div>
    </div>
    <div>
      <div class="col-head right">RIGHT — Listen LLM -&gt; Validator -&gt; adapter -&gt; SAME Decision Engine (regex candidates + adapter candidates, merged)</div>
      <div class="col-body">
        ${r.right.listen_meta ? `<p class="plain">live call: ${esc(r.right.listen_meta.model)}, ${r.right.listen_meta.response_bytes} response bytes</p>` : ""}
        <h4>Evidence Graph</h4>
        ${renderEvidenceGraph(r.right.evidence_graph)}
        <h4>Adapter candidates (${r.right.adapter_candidates.length}, from the Evidence Graph only)</h4>
        ${renderCandidates(r.right.adapter_candidates)}
        <h4>Merged candidates fed to Decision Engine (${r.right.merged_candidates.length})</h4>
        ${renderCandidates(r.right.merged_candidates)}
        <h4>Decision</h4>
        ${renderDecision(r.right.decision)}
        ${r.right.ladder_conflicts_resolved.length ? `<p class="plain">ladder-exclusivity fix: dropped ${r.right.ladder_conflicts_resolved.map(esc).join(", ")} from RENDERING only (contradicted a co-fired presence candidate for the same ladder) — decide() above still received the full pool.</p>` : ""}
        <h4>Coach's Notes (quickScan, via proof.ts/categoryMap.ts — same rendering code as LEFT)</h4>
        ${renderQuickScan(r.right.quick_scan)}
      </div>
    </div>
  `;
  stagesEl.appendChild(columns);
}

runBtn.addEventListener("click", run);
loadCases();
