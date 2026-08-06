const stagesEl = document.getElementById("stages");
const caseSelect = document.getElementById("caseSelect");
const modeSelect = document.getElementById("modeSelect");
const runBtn = document.getElementById("runBtn");
const liveStatus = document.getElementById("liveStatus");

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const json = (obj) => `<pre class="json">${esc(JSON.stringify(obj, null, 2))}</pre>`;

async function loadCases() {
  const res = await fetch("/api/cases");
  const data = await res.json();
  caseSelect.innerHTML = data.cases.map((c) => `<option value="${c.case_id}">${esc(c.label)}</option>`).join("");
  liveStatus.textContent = data.live_available ? "live mode available" : "live mode unavailable (no API key)";
  liveStatus.className = "live-status " + (data.live_available ? "available" : "unavailable");
}

function stage(num, title, bodyHtml, openByDefault) {
  const el = document.createElement("details");
  el.className = "stage";
  el.open = !!openByDefault;
  el.innerHTML = `<summary><span class="num">${num}</span> ${esc(title)}</summary><div class="stage-body">${bodyHtml}</div>`;
  return el;
}

function renderGraph(graph) {
  return `<div class="claim-list">
    ${graph.nodes.map((n) => `<div class="claim pass"><b>${esc(n.id)}</b> — ${esc(n.claim_type)}<div>&ldquo;${esc(n.quote)}&rdquo;</div></div>`).join("") || '<p class="note">no nodes</p>'}
    ${graph.edges.map((e) => `<div class="claim pass"><b>${esc(e.id)}</b> — ${esc(e.relationship_type)} (${e.component_ids.map(esc).join(", ")})</div>`).join("")}
  </div>`;
}

async function run() {
  const caseId = caseSelect.value;
  const mode = modeSelect.value;
  stagesEl.innerHTML = `<p class="note">Running case ${esc(caseId)} in ${esc(mode)} mode...</p>`;
  const res = await fetch(`/api/run/${caseId}?mode=${mode}`);
  const data = await res.json();

  if (data.error) {
    stagesEl.innerHTML = `<div class="error-box"><b>${esc(data.error.code)}</b>: ${esc(data.error.message)}</div>`;
    return;
  }

  const r = data.result;
  stagesEl.innerHTML = "";
  stagesEl.appendChild(stage(1, "Transcript", `<div class="transcript-box">${esc(data.transcript)}</div>`, true));
  stagesEl.appendChild(stage(2, "Evidence Graph (in)", renderGraph(r.evidence_graph), true));
  stagesEl.appendChild(stage(3, "Teaching Move selected", `
    <div class="claim pass"><b>${esc(r.teaching_move.type)}</b><div class="note">${esc(r.teaching_move.reason)}</div>
    <div class="note">anchor claims: ${r.teaching_move.anchor_claim_ids.map(esc).join(", ") || "(none)"}</div></div>
  `, true));
  stagesEl.appendChild(stage(4, "Coaching Act assembled", json(r.coaching_act)));
  stagesEl.appendChild(stage(5, "Raw Narrator output (mode: " + esc(data.mode) + ")", `
    <div class="claim ${r.guardrail.passed ? "pass" : "fail"}">${esc(r.narrator_result.message)}</div>
    ${r.narrator_result.meta ? json(r.narrator_result.meta) : ""}
  `));
  stagesEl.appendChild(stage(6, "Guardrail check result (7 tone categories)", `
    <span class="badge ${r.guardrail.passed ? "pass" : "fail"}">${r.guardrail.passed ? "passed" : "failed"}</span>
    ${r.guardrail.violations.length ? json(r.guardrail.violations) : '<p class="note">no violations</p>'}
  `, !r.guardrail.passed));
  stagesEl.appendChild(stage(7, "Grounding check result (8th check — is it TRUE relative to its own evidence?)", `
    <span class="badge ${r.grounding.passed ? "pass" : "fail"}">${r.grounding.checked ? (r.grounding.passed ? "passed" : "failed") : "not applicable (no evidence given)"}</span>
    ${r.grounding.ungrounded_terms.length ? `<p class="note">terms not traceable to referenced evidence:</p>${json(r.grounding.ungrounded_terms)}` : '<p class="note">no ungrounded terms</p>'}
  `, !r.grounding.passed));
  stagesEl.appendChild(stage(8, "Final learner-facing text" + (r.fallback_used ? " (fallback used)" : ""), `
    ${r.fallback_used ? '<span class="badge fallback">fallback</span>' : ""}
    <div class="final-text">${esc(r.final_text)}</div>
  `, true));
}

runBtn.addEventListener("click", run);
loadCases().then(() => run());
