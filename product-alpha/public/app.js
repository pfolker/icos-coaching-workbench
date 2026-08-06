// Product Alpha — single clickable path through one complete 10-step
// coaching loop. All data comes from /api/reference-scenario, which
// serves literal, pre-captured constants (server/referenceScenario.ts).
// No typing here is ever sent anywhere; the textareas are readonly,
// pre-filled reference examples, honestly labeled as such.

const screens = {
  firstAnswer: document.getElementById("screen-first-answer"),
  waiting: document.getElementById("screen-waiting"),
  coaching: document.getElementById("screen-coaching"),
  retry: document.getElementById("screen-retry"),
  comparison: document.getElementById("screen-comparison"),
  lockin: document.getElementById("screen-lockin"),
  end: document.getElementById("screen-end"),
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
  const order = ["STORY", "CREDIBILITY", "IMPACT"];
  let delay = 0;
  for (const category of order) {
    const items = quickScan[category];
    if (!items || items.length === 0) continue;
    // Positive-first ordering within each category, per the Spec's Stage 3
    // requirement ("checkmarks visually lead").
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

async function main() {
  const data = await fetch("/api/reference-scenario").then((r) => r.json());

  document.getElementById("first-answer-box").value = data.firstTake.transcript;
  document.getElementById("retry-answer-box").value = data.retry.transcript;
  document.getElementById("first-answer-reference-text").textContent = data.firstTake.transcript;
  document.getElementById("compare-first-text").textContent = data.firstTake.transcript;
  document.getElementById("compare-retry-text").textContent = data.retry.transcript;
  document.getElementById("lockin-ack").textContent = data.lockIn.acknowledgment;
  document.getElementById("progress-marker").textContent = data.nextQuestionMarker;

  // Stage 1 -> Stage 2: instant acknowledgment, then a shortened simulated
  // wait (compromise, documented in the deliverables report: real Listen
  // Engine latency measures 15-25s; nothing is actually computing here, so
  // the wait is compressed rather than padded with a meaningless delay).
  document.getElementById("submit-first-answer").addEventListener("click", () => {
    showScreen("waiting");
    setTimeout(() => {
      showScreen("coaching");
      const notesEl = document.getElementById("coaches-notes");
      renderCoachesNotes(notesEl, data.firstTake.coachesNotes);

      // Interaction Philosophy: the reveal from Coach's Notes into Today's
      // Focus is sequential, not simultaneous.
      const focusEl = document.getElementById("todays-focus");
      setTimeout(() => {
        document.getElementById("focus-label").textContent = data.firstTake.todaysFocus.label;
        document.getElementById("focus-explanation").textContent = data.firstTake.todaysFocus.explanation;
        focusEl.hidden = false;
        document.getElementById("try-again-btn").hidden = false;
      }, 900);
    }, 2600);
  });

  document.getElementById("try-again-btn").addEventListener("click", () => {
    showScreen("retry");
  });

  document.getElementById("submit-retry").addEventListener("click", () => {
    showScreen("comparison");
  });

  for (const btn of document.querySelectorAll(".pick-btn")) {
    btn.addEventListener("click", () => {
      showScreen("lockin");
    });
  }

  document.getElementById("next-question-btn").addEventListener("click", () => {
    showScreen("end");
  });
}

main();
