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
  caseSelect.innerHTML = data.cases.map((c) => `<option value="${c.case_id}">Case ${c.case_id} — ${esc(c.label)}</option>`).join("");
  liveStatus.textContent = data.live_available ? "live mode available" : "live mode unavailable (no API key)";
  liveStatus.className = "live-status " + (data.live_available ? "available" : "unavailable");
}

function stage(num, title, bodyHtml) {
  const el = document.createElement("details");
  el.className = "stage";
  el.open = num <= 2;
  el.innerHTML = `<summary><span class="num">${num}</span> ${esc(title)}</summary><div class="stage-body">${bodyHtml}</div>`;
  return el;
}

function outcomeFor(proposalId, validator) {
  if (validator.validated_class_a.some((c) => c.proposal_id === proposalId)) return { status: "accepted", detail: validator.validated_class_a.find((c) => c.proposal_id === proposalId) };
  if (validator.validated_class_b.some((c) => c.proposal_id === proposalId)) return { status: "accepted", detail: validator.validated_class_b.find((c) => c.proposal_id === proposalId) };
  if (validator.class_c_non_admissible.some((c) => c.proposal_id === proposalId)) return { status: "classc", detail: validator.class_c_non_admissible.find((c) => c.proposal_id === proposalId) };
  if (validator.rejected.some((c) => c.proposal_id === proposalId)) return { status: "rejected", detail: validator.rejected.find((c) => c.proposal_id === proposalId) };
  if (validator.requires_review.some((c) => c.proposal_id === proposalId)) return { status: "review", detail: validator.requires_review.find((c) => c.proposal_id === proposalId) };
  return { status: "unknown", detail: null };
}

function renderRawClaims(listenRaw, validator) {
  const rows = [];
  for (const p of listenRaw.class_a_proposals) {
    const o = outcomeFor(p.proposal_id, validator);
    rows.push(`<div class="claim ${o.status}"><span class="badge ${o.status}">${o.status}</span><b>${esc(p.proposal_id)}</b> — ${esc(p.claim_type)}<div class="quote">&ldquo;${esc(p.quote)}&rdquo;</div></div>`);
  }
  for (const p of listenRaw.class_b_proposals) {
    const o = outcomeFor(p.proposal_id, validator);
    rows.push(`<div class="claim ${o.status}"><span class="badge ${o.status}">${o.status}</span><b>${esc(p.proposal_id)}</b> — ${esc(p.relationship_type)} (${p.components.map(esc).join(", ")})</div>`);
  }
  for (const p of listenRaw.class_c_proposals) {
    const o = outcomeFor(p.proposal_id, validator);
    rows.push(`<div class="claim classc"><span class="badge classc">class c</span><b>${esc(p.proposal_id)}</b><div class="quote">${esc(p.hypothesis)}</div></div>`);
  }
  return `<p class="note">Proposals exactly as the Listen Engine produced them (source_span not shown here — computed downstream). Badge shows the eventual Stage 3 outcome for quick scanning; full reasoning is in Stage 3.</p><div class="claim-list">${rows.join("")}</div>`;
}

function renderValidator(validator) {
  const section = (title, items, render) => `<h3>${esc(title)} (${items.length})</h3>${items.length ? `<div class="claim-list">${items.map(render).join("")}</div>` : `<p class="note">none</p>`}`;
  return [
    section("Accepted — Class A", validator.validated_class_a, (c) =>
      `<div class="claim accepted"><span class="badge accepted">accepted</span><b>${esc(c.proposal_id)}</b> — ${esc(c.claim_type)}<div class="quote">&ldquo;${esc(c.quote)}&rdquo;</div><div class="rule">admitted by: ${esc(c.admitted_by)}</div></div>`),
    section("Accepted — Class B", validator.validated_class_b, (c) =>
      `<div class="claim accepted"><span class="badge accepted">accepted</span><b>${esc(c.proposal_id)}</b> — ${esc(c.relationship_type)} (${c.components.map(esc).join(", ")})${c.ordering_basis ? ` [ordering_basis: ${esc(c.ordering_basis)}]` : ""}<div class="rule">admitted by: ${esc(c.admitted_by)}</div></div>`),
    section("Class C — non-admissible", validator.class_c_non_admissible, (c) =>
      `<div class="claim classc"><span class="badge classc">non-admissible</span><b>${esc(c.proposal_id)}</b><div class="quote">${esc(c.hypothesis)}</div><div class="rule">${esc(c.admitted_by)}</div></div>`),
    section("Rejected", validator.rejected, (c) =>
      `<div class="claim rejected"><span class="badge rejected">rejected</span><b>${esc(c.proposal_id)}</b> — ${esc(c.reason_code)}<div class="why">${esc(c.explanation)}</div></div>`),
    section("Requires review", validator.requires_review, (c) =>
      `<div class="claim review"><span class="badge review">review</span><b>${esc(c.proposal_id)}</b><div class="why">${esc(c.explanation)}</div></div>`),
    section("Selection required (multi-candidate)", validator.selection_required, (c) =>
      `<div class="claim review"><span class="badge review">selection required</span>${esc(c.claim_type)}: ${c.candidate_proposal_ids.map(esc).join(", ")}<div class="meta">${esc(c.explanation)}</div>${c.discourse_marker ? `<div class="meta">discourse marker (metadata only): "${esc(c.discourse_marker.marker_text)}" -> ${esc(c.discourse_marker.marked_proposal_id)}</div>` : ""}</div>`),
  ].join("");
}

function renderGraph(graph) {
  return `<div class="graph-columns">
    <div class="graph-col"><h3>Nodes — Class A (${graph.nodes.length})</h3>${graph.nodes.map((n) => `<div class="claim accepted"><b>${esc(n.id)}</b> — ${esc(n.claim_type)}<div class="quote">&ldquo;${esc(n.quote)}&rdquo;</div>${n.speaker_assertion ? '<div class="meta">speaker_assertion: true (stated belief, not established fact)</div>' : ""}</div>`).join("") || '<p class="note">none</p>'}</div>
    <div class="graph-col"><h3>Edges — Class B (${graph.edges.length})</h3>${graph.edges.map((e) => `<div class="claim accepted"><b>${esc(e.id)}</b> — ${esc(e.relationship_type)}<div class="meta">${e.component_ids.map(esc).join(" -> ")}${e.ordering_basis ? ` [${esc(e.ordering_basis)}]` : ""}</div></div>`).join("") || '<p class="note">none</p>'}</div>
    <div class="graph-col"><h3>Non-admissible — Class C (${graph.non_admissible.length})</h3>${graph.non_admissible.map((c) => `<div class="claim classc"><b>${esc(c.id)}</b><div class="quote">${esc(c.hypothesis)}</div><div class="meta">never wired into nodes/edges above</div></div>`).join("") || '<p class="note">none</p>'}</div>
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
  stagesEl.appendChild(stage(1, "Transcript", `<div class="transcript-box">${esc(r.transcript)}</div>`));
  stagesEl.appendChild(stage(2, "Raw Evidence Claims (Listen Engine output, mode: " + esc(data.mode) + ")", renderRawClaims(r.listen_engine.raw, r.validator_output) + (r.listen_engine.meta ? json(r.listen_engine.meta) : "")));
  stagesEl.appendChild(stage(3, "Evidence Validator", renderValidator(r.validator_output)));
  stagesEl.appendChild(stage(4, "Validated Evidence Graph", renderGraph(r.evidence_graph)));
  stagesEl.appendChild(stage(5, "Observation Engine Input (same transcript, NOT fed by the Evidence Graph)", `<div class="transcript-box">${esc(r.transcript)}</div><p class="note">This is the literal transcript string passed to the unmodified observe() function — identical to Stage 1's text, computed with zero knowledge of Stages 1-4.</p>`));
  stagesEl.appendChild(stage(6, "Observation Output", json(r.existing_engines.observation_set)));
  stagesEl.appendChild(stage(7, "Decision Output", json(r.existing_engines.decision)));
  stagesEl.appendChild(stage(8, "Conversation Output", json(r.existing_engines.move)));
}

runBtn.addEventListener("click", run);
loadCases().then(() => run());
