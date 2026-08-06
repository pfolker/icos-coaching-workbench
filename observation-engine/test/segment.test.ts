import { describe, it, expect } from "vitest";
import { segment, sentenceIndexAt } from "../src/segment";

describe("segment", () => {
  it("splits on terminal punctuation with correct offsets", () => {
    const t = "I fixed the fixture. It worked! Scrap dropped?";
    const s = segment(t);
    expect(s.map((x) => x.text)).toEqual([
      "I fixed the fixture.", "It worked!", "Scrap dropped?",
    ]);
    for (const sent of s) expect(t.slice(sent.char_start, sent.char_end)).toBe(sent.text);
  });

  it("indexes sentences sequentially from 0", () => {
    const s = segment("One. Two. Three.");
    expect(s.map((x) => x.index)).toEqual([0, 1, 2]);
  });

  it("secondary-splits an unpunctuated spoken run-on at discourse markers", () => {
    const runOn =
      "we had this problem with the fixture on the second op and the parts kept " +
      "warping every single time we ran them so I went and redesigned the clamping " +
      "setup with new supports because the old one was putting stress on the thin wall " +
      "and then we ran a test batch of fifty parts and every one of them came out clean";
    const s = segment(runOn);
    expect(s.length).toBeGreaterThan(1);
    // pieces keep a sane minimum size
    for (const sent of s) expect(sent.word_count).toBeGreaterThanOrEqual(8);
    // offsets reassemble the original text exactly
    for (const sent of s) expect(runOn.slice(sent.char_start, sent.char_end)).toBe(sent.text);
  });

  it("does not split short punctuation-free answers", () => {
    const s = segment("I helped the team with the changeover");
    expect(s.length).toBe(1);
  });

  it("handles leading/trailing whitespace without breaking offsets", () => {
    const t = "   So yeah.   We shipped it.  ";
    const s = segment(t);
    expect(s.length).toBe(2);
    for (const sent of s) expect(t.slice(sent.char_start, sent.char_end)).toBe(sent.text);
  });

  it("sentenceIndexAt attributes offsets, including gaps, to a valid sentence", () => {
    const t = "First one. Second one.";
    const s = segment(t);
    expect(sentenceIndexAt(s, 0)).toBe(0);
    expect(sentenceIndexAt(s, t.indexOf("Second"))).toBe(1);
    expect(sentenceIndexAt(s, 10)).toBe(0); // the gap after "First one."
  });
});
