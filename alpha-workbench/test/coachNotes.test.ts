// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { noteHtml } from "../public/coachNotes.js";

const flag = {
  polarity: "flag" as const,
  label: "Outcome could be easier to measure.",
  explanation: "Give the interviewer a clearer sense of how much changed.",
  needs_expand: true,
};
const goodEntry = {
  polarity: "good" as const,
  label: "Reaches a result",
  needs_expand: false,
};
const flagNoExplanation = {
  polarity: "flag" as const,
  label: "Heavy filler",
  needs_expand: false,
};

function mount(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("Coach's Notes expand affordance (V3.4 bug fix)", () => {
  it("expandable entries render a visible marker inside a details/summary control", () => {
    const el = mount(noteHtml(flag));
    const details = el.querySelector("details");
    expect(details).not.toBeNull();
    const mark = el.querySelector("summary .mark");
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe("+");
    expect(el.textContent).toContain("Outcome could be easier to measure.");
  });

  it("clicking the summary opens the explanation; clicking again closes it", () => {
    const el = mount(noteHtml(flag));
    const details = el.querySelector("details") as HTMLDetailsElement;
    const summary = el.querySelector("summary") as HTMLElement;
    expect(details.open).toBe(false);

    summary.click();
    expect(details.open).toBe(true);
    expect(el.querySelector(".expl")!.textContent).toContain("clearer sense of how much changed");

    summary.click();
    expect(details.open).toBe(false);
  });

  it("non-expandable positive entries show no marker and no details control", () => {
    const el = mount(noteHtml(goodEntry));
    expect(el.querySelector("details")).toBeNull();
    expect(el.querySelector(".mark")).toBeNull();
    expect(el.textContent).toContain("Reaches a result");
  });

  it("needs_expand: false entries never render a control even with a flag polarity", () => {
    const el = mount(noteHtml(flagNoExplanation));
    expect(el.querySelector("details")).toBeNull();
    expect(el.querySelector(".mark")).toBeNull();
  });

  it("needs_expand: true with no explanation degrades safely to non-expandable (defensive)", () => {
    const el = mount(noteHtml({ polarity: "flag" as const, label: "No explanation here", needs_expand: true }));
    expect(el.querySelector("details")).toBeNull();
    expect(el.querySelector(".mark")).toBeNull();
  });
});
