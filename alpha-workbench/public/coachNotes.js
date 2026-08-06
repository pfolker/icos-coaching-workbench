/**
 * Coach's Notes — per-entry render helper.
 *
 * Extracted from index.html's inline script (V3.4 bug fix) so the
 * expand/collapse affordance has one source of truth, used by the browser
 * AND by the unit tests in test/coachNotes.test.ts — instead of only being
 * checkable by eye in a running page.
 *
 * Bug this fixes: the <details>/<summary> control for expandable entries
 * was real and functional (clicking it already toggled open/closed via
 * native <details> behavior) but had NO visible affordance. index.html's
 * CSS suppressed the native disclosure marker in both rendering engines
 * (`list-style:none` for Firefox, `::-webkit-details-marker{display:none}`
 * for Chrome/WebKit) and nothing was ever put in its place, so an
 * expandable flag and a non-expandable positive rendered as visually
 * identical lines. This module adds an explicit "+" marker element to the
 * generated markup itself, so the affordance doesn't depend on
 * browser-specific native-marker styling at all.
 */

export function escapeHtml(x) {
  return String(x).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[c]);
}

/** entry: { polarity: "good"|"flag"|"neutral", label, explanation?, needs_expand } */
export function noteHtml(entry) {
  const icon = entry.polarity === "good" ? "✓" : entry.polarity === "neutral" ? "•" : "⚠";
  const cls = entry.polarity === "good" ? "ok" : entry.polarity === "neutral" ? "neutral" : "warn";
  const label = '<span class="' + cls + '">' + icon + " " + escapeHtml(entry.label) + "</span>";

  if (entry.needs_expand && entry.explanation) {
    return (
      '<details class="note">' +
        '<summary><span class="mark" aria-hidden="true">+</span> ' + label + "</summary>" +
        '<div class="expl">' + escapeHtml(entry.explanation) + "</div>" +
      "</details>"
    );
  }
  return "<div>" + label + "</div>";
}
