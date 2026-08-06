const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
let current = null; // current case id

async function loadCases() {
  const cases = await (await fetch("/api/cases")).json();
  $("caseSelect").innerHTML = cases.map((c) => `<option value="${c.id}">${esc(c.label)} — ${esc(c.domain)}</option>`).join("");
}

async function run() {
  const id = $("caseSelect").value;
  $("status").textContent = "running both coaches (structured makes a live call)…";
  $("runBtn").disabled = true;
  try {
    const r = await fetch(`/api/compare?case=${encodeURIComponent(id)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "compare failed");
    current = id;
    $("transcriptText").textContent = data.transcript;
    $("detText").textContent = data.deterministic.coaching_text || "(no coaching text)";
    $("detMeta").innerHTML = `<b>opportunity:</b> ${esc(data.deterministic.selected_opportunity ?? "—")} · <b>intervention:</b> ${esc(data.deterministic.intervention_type ?? "—")} · <b>type:</b> ${esc(data.deterministic.decision_type)}${data.deterministic.degraded ? " · <span class='flag'>degraded</span>" : ""}`;
    $("strText").textContent = data.structured.final_text || "(no text)";
    const s = data.structured;
    $("strMeta").innerHTML = `<b>move:</b> ${esc(s.teaching_move)} · <b>fallback:</b> ${s.fallback_used ? "<span class='flag'>yes</span>" : "no"} · <b>grounding:</b> ${s.grounding_passed ? "pass" : "<span class='flag'>flag</span>"} · <b>model:</b> ${esc(s.model)}` + (s.fallback_used ? `<br><span class="hint">raw (pre-fallback): ${esc(s.raw_message)}</span>` : "");
    ["transcript", "columns", "observe"].forEach((el) => $(el).classList.remove("hidden"));
    document.querySelectorAll("input[type=radio]").forEach((r) => (r.checked = r.name === "con" && r.value === "PASS"));
    ["why", "conNote", "surNote", "notes"].forEach((el) => ($(el).value = ""));
    $("status").textContent = "";
  } catch (e) {
    $("status").textContent = "error: " + e.message;
  } finally {
    $("runBtn").disabled = false;
  }
}

async function save() {
  if (!current) return;
  const val = (name) => document.querySelector(`input[name=${name}]:checked`)?.value ?? "";
  const body = {
    case_id: current,
    preferred: val("pref"),
    why: $("why").value.trim(),
    constitution: val("con") || "PASS",
    constitution_note: $("conNote").value.trim(),
    retry_motivation: val("ret"),
    surprised: val("sur"),
    surprised_note: $("surNote").value.trim(),
    notes: $("notes").value.trim(),
  };
  $("saveStatus").textContent = "saving…";
  const r = await fetch("/api/observe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  $("saveStatus").textContent = r.ok ? "saved ✓" : "save failed";
  await loadObservations();
}

async function loadObservations() {
  const obs = await (await fetch("/api/observations")).json();
  $("logCount").textContent = `(${obs.length})`;
  $("logList").innerHTML = obs.slice().reverse().map((o) =>
    `<div class="obs"><span class="tag">${esc(o.case_id)}</span> · preferred: <b>${esc(o.preferred || "—")}</b> · constitution: ${o.constitution === "FLAG" ? `<span class="flag">FLAG${o.constitution_note ? " — " + esc(o.constitution_note) : ""}</span>` : "PASS"} · retry: ${esc(o.retry_motivation || "—")} · surprised: ${o.surprised === "YES" ? `<b class="tag">YES${o.surprised_note ? " — " + esc(o.surprised_note) : ""}</b>` : esc(o.surprised || "—")}<br>${o.why ? "why: " + esc(o.why) : ""}${o.notes ? " · notes: " + esc(o.notes) : ""}</div>`
  ).join("") || "<span class='hint'>none yet</span>";
}

$("runBtn").addEventListener("click", run);
$("saveBtn").addEventListener("click", save);
loadCases();
loadObservations();
