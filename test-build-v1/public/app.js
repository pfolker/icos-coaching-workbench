// Test Build v1 — genuinely interactive: real typed input, real live
// pipeline call per submission (POST /api/submit), O5 suppression applied
// live. No fixture data anywhere in this package.

const screens = {
  firstAnswer: document.getElementById("screen-first-answer"),
  waiting: document.getElementById("screen-waiting"),
  coaching: document.getElementById("screen-coaching"),
  retry: document.getElementById("screen-retry"),
  waitingRetry: document.getElementById("screen-waiting-retry"),
  comparison: document.getElementById("screen-comparison"),
  lockin: document.getElementById("screen-lockin"),
  end: document.getElementById("screen-end"),
};

const sessionId = (crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const state = {
  firstText: "",
  retryText: "",
  firstQuickScan: null,
  retryQuickScan: null,
};

function showScreen(name) {
  for (const el of Object.values(screens)) el.hidden = true;
  screens[name].hidden = false;
}

function renderNoteItem(item) {
  const wrap = document.createElement("div");
  wrap.className = `note-item ${item.polarity}`;
  const icon = document.createElement("span");
  icon.className = "note-icon";
  icon.textContent = item.polarity === "good" ? "✓" : item.polarity === "flag" ? "!" : "●";
  const text = document.createElement("span");
  text.className = "note-text";
  const label = document.createElement("span");
  label.textContent = item.label;
  text.appendChild(label);
  if (item.explanation) {
    const expl = document.createElement("span");
    expl.className = "note-explanation";
    expl.textContent = item.explanation;
    text.appendChild(expl);
  }
  wrap.appendChild(icon);
  wrap.appendChild(text);
  return wrap;
}

function renderCoachesNotes(container, quickScan) {
  container.innerHTML = "";
  const order = ["STORY", "CREDIBILITY", "IMPACT", "DELIVERY"];
  let delay = 0;
  for (const category of order) {
    const items = quickScan[category];
    if (!items || items.length === 0) continue;
    const sorted = [...items].sort((a, b) => {
      const rank = { good: 0, neutral: 1, flag: 2 };
      return rank[a.polarity] - rank[b.polarity];
    });
    const block = document.createElement("div");
    block.className = "notes-category";
    const title = document.createElement("div");
    title.className = "notes-category-title";
    title.textContent = category;
    block.appendChild(title);
    for (const item of sorted) {
      const el = renderNoteItem(item);
      el.style.animationDelay = `${delay}ms`;
      delay += 120;
      block.appendChild(el);
    }
    container.appendChild(block);
  }
}

/**
 * Grounded lock-in acknowledgment, computed live from the two REAL
 * quick_scan results (unlike Product Alpha, where this was a hardcoded
 * fact about one fixed pair). Looks for any non-flag note item present in
 * the retry's Coach's Notes that wasn't present in the first take's — the
 * same "what's real and different" reasoning Product Alpha used, applied
 * generically to arbitrary input. Per Design Principles #1/#4, this never
 * fabricates an improvement claim when nothing genuinely new shows up.
 */
function computeGroundedAcknowledgment(firstScan, retryScan) {
  const firstLabels = new Set(
    Object.values(firstScan).flat().filter((e) => e.polarity !== "flag").map((e) => e.label)
  );
  const categories = ["STORY", "CREDIBILITY", "IMPACT", "DELIVERY"];
  for (const cat of categories) {
    const items = retryScan[cat] || [];
    for (const item of items) {
      if (item.polarity === "good" && !firstLabels.has(item.label)) {
        return `You added something new here: ${item.label.toLowerCase()} — the retry shows it, the first take didn't.`;
      }
    }
  }
  // Honest fallback: nothing detectably new. Never claim improvement that
  // isn't there.
  return "Nothing new stood out to the coach between these two — that doesn't mean the retry didn't help, just that this check didn't catch a difference this time.";
}

async function submitTurn(transcript, turnLabel, forceFailure = false) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript, session_id: sessionId, turn_label: turnLabel, force_failure: forceFailure }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `request failed (${res.status})`);
  }
  return res.json();
}

function showError(bannerEl, message) {
  bannerEl.textContent = message;
  bannerEl.hidden = false;
}

function main() {
  const firstBox = document.getElementById("first-answer-box");
  const retryBox = document.getElementById("retry-answer-box");
  const errorBanner1 = document.getElementById("error-banner-1");
  const errorBanner2 = document.getElementById("error-banner-2");

  document.getElementById("submit-first-answer").addEventListener("click", async () => {
    const text = firstBox.value.trim();
    errorBanner1.hidden = true;
    if (!text) return showError(errorBanner1, "Type an answer before submitting.");
    state.firstText = text;

    showScreen("waiting");
    try {
      const result = await submitTurn(text, "first_take");
      state.firstQuickScan = result.quickScan;

      document.getElementById("degraded-banner").hidden = !result.degraded;

      const notesEl = document.getElementById("coaches-notes");
      renderCoachesNotes(notesEl, result.quickScan);

      const focusEl = document.getElementById("todays-focus");
      const nothingEl = document.getElementById("nothing-further");
      const tryAgainBtn = document.getElementById("try-again-btn");
      focusEl.hidden = true;
      nothingEl.hidden = true;
      tryAgainBtn.hidden = true;

      showScreen("coaching");
      setTimeout(() => {
        if (result.todaysFocus) {
          document.getElementById("focus-label").textContent = result.todaysFocus.label;
          document.getElementById("focus-explanation").textContent = result.todaysFocus.explanation;
          focusEl.hidden = false;
        } else {
          nothingEl.hidden = false;
        }
        tryAgainBtn.hidden = false;
      }, 500);
    } catch (e) {
      showScreen("firstAnswer");
      showError(errorBanner1, `Something went wrong: ${e.message}. Try submitting again.`);
    }
  });

  document.getElementById("try-again-btn").addEventListener("click", () => {
    document.getElementById("first-answer-reference-text").textContent = state.firstText;
    retryBox.value = "";
    showScreen("retry");
  });

  document.getElementById("submit-retry").addEventListener("click", async () => {
    const text = retryBox.value.trim();
    errorBanner2.hidden = true;
    if (!text) return showError(errorBanner2, "Type a retry before submitting.");
    state.retryText = text;

    showScreen("waitingRetry");
    try {
      const result = await submitTurn(text, "retry");
      state.retryQuickScan = result.quickScan;

      document.getElementById("compare-first-text").textContent = state.firstText;
      document.getElementById("compare-retry-text").textContent = state.retryText;
      showScreen("comparison");
    } catch (e) {
      showScreen("retry");
      showError(errorBanner2, `Something went wrong: ${e.message}. Try submitting again.`);
    }
  });

  for (const btn of document.querySelectorAll(".pick-btn")) {
    btn.addEventListener("click", () => {
      const ack = computeGroundedAcknowledgment(state.firstQuickScan, state.retryQuickScan);
      document.getElementById("lockin-ack").textContent = ack;
      showScreen("lockin");
    });
  }

  document.getElementById("next-question-btn").addEventListener("click", () => {
    showScreen("end");
  });
}

main();
