/**
 * Registry — signatures + verdict copy as data.
 * Signatures are the SAME strings as conversation-engine's registry (the
 * shared topic vocabulary; future home: /config, single-sourced). The
 * verifier uses them for selected-topic-present, rejected-absent, and
 * banked-flaws-not-in-copy checks.
 */

export interface OppMeta {
  signature: string;
  habit_id: string;
}

export const OPP_META: Record<string, OppMeta> = {
  O2_structureless_ramble: { signature: "one sentence of setup", habit_id: "H2" },
  O3_missing_result: { signature: "what changed because", habit_id: "H2" },
  O3_unquantified_result: { signature: "put a number on it", habit_id: "H5" },
  O4_ownership_hiding: { signature: "your role only", habit_id: "H3" },
  // V3.3 copy pass: was "believe you were there" — shares conversation-
  // engine's V3.3 fix (registry.ts there), reframed around memory not trust.
  O5_vagueness: { signature: "picture exactly where you were", habit_id: "H4" },
  O7_weak_close: { signature: "new last sentence", habit_id: "H9" },
  O8_buried_lede: { signature: "opening sentence the answer", habit_id: "H8" },
  O10_filler_density: { signature: "let silence do the work", habit_id: "H10" },
  O11_employer_negativity: { signature: "no verdicts on people", habit_id: "H12" },
};

/**
 * Verdict copy per opportunity. {R} = retry quote, {O} = original quote.
 * Every string contains its opportunity's signature so selected-topic-present
 * holds across all verdicts. No em dashes. Task-level only. not_yet stays
 * warm and repeats the SAME ask; it never adds a second point.
 */
export const VERDICT_COPY: Record<string, Record<"achieved" | "partial" | "not_yet", string>> = {
  O3_unquantified_result: {
    achieved: 'There it is: "{R}". You put a number on it, and that is the difference between a claim and evidence.',
    partial: "A number made it in, and it helps. One more pass: put a number on it right where the result lands. Estimates count.",
    not_yet: "The ending still reads the same as before. Same story, and this time put a number on it. Estimates count.",
  },
  O3_missing_result: {
    achieved: 'Now the story lands: "{R}". That is what changed because of your work, said out loud.',
    partial: "You got closer to the ending. Finish the thought: what changed because of the work, in one clear line.",
    not_yet: "The story still stops before the payoff. One more pass, ending on what changed because of the work.",
  },
  O2_structureless_ramble: {
    achieved: "Now it has a shape. One sentence of setup, then the action, then the landing. A listener can take notes on that.",
    partial: "Tighter already. It still runs long, but the shape is showing. Keep it to one sentence of setup, then straight to the action.",
    not_yet: "Still one long stretch. One more pass: one sentence of setup, then what you did, then how it ended.",
  },
  O4_ownership_hiding: {
    achieved: '"{R}". Your role only this time, and it changes how the whole answer reads.',
    partial: "More of you in it this time. Keep going: your role only, and give every action an I.",
    not_yet: "The team is still doing all the work in this telling. Once more, your role only.",
  },
  O5_vagueness: {
    achieved: '"{R}". Only someone who was there could say that. Now I can picture exactly where you were.',
    partial: "Some real detail made it in. Push further so I can picture exactly where you were: the machine, the week, the part.",
    not_yet: "It still reads like anyone could have said it. Again, help me picture exactly where you were.",
  },
  O7_weak_close: {
    achieved: '"{R}". A new last sentence, planted on purpose. That is the line they walk away with.',
    partial: "The ending is firmer, not planted yet. One more pass at that new last sentence: land it and stop.",
    not_yet: "It still fades out at the end. Same answer, new last sentence. End on the result and stop.",
  },
  O8_buried_lede: {
    achieved: '"{R}". You made the opening sentence the answer itself. They had your point immediately.',
    partial: "The answer shows up sooner now. One more pass: make the opening sentence the answer itself.",
    not_yet: "The answer is still arriving late. Again, with the opening sentence the answer itself.",
  },
  O10_filler_density: {
    achieved: "Cleaner all the way through. You let silence do the work, and it reads as confidence.",
    partial: "Fewer fillers this time. Keep going: let silence do the work in the spots that are left.",
    not_yet: "The fillers held their ground on that one. Once more, and let silence do the work instead.",
  },
  O11_employer_negativity: {
    achieved: "That is the same story with the facts carrying it. No verdicts on people, and you sound bigger for it.",
    partial: "Less heat on the people this time. One more pass with no verdicts on people at all.",
    not_yet: "They are still in there. Same story, facts only, no verdicts on people.",
  },
};

export const GENERIC_VERDICT_COPY: Record<"achieved" | "partial" | "not_yet", string> = {
  achieved: "That pass did the job. The thing we worked on is in there now.",
  partial: "That pass moved it. Part of the fix is in there; one more run seals it.",
  not_yet: "Not yet, and that is fine. Same ask, one more run at it.",
};

/** Thresholds — mirror opportunity-engine defaults; injectable. */
export interface ComparisonConfig {
  ramble_min_words: number;
  ramble_word_drop_partial: number;     // fraction, e.g. 0.25
  filler_per_minute_threshold: number;
  filler_drop_partial: number;          // fraction, e.g. 0.4
  banked_filler_rise: number;           // fraction rise that banks O10
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  ramble_min_words: 260,
  ramble_word_drop_partial: 0.25,
  filler_per_minute_threshold: 6,
  filler_drop_partial: 0.4,
  banked_filler_rise: 0.5,
};

export const SECOND_POINT_BANLIST: RegExp[] = [
  /\balso\b/i, /\banother thing\b/i, /\bone more thing\b/i, /\badditionally\b/i,
  /\bsecond issue\b/i, /\bon top of that\b/i, /\bwhile we are at it\b/i, /\bas well\b/i,
];

export const DEGRADED_COPY: Record<"achieved" | "partial" | "not_yet", string> = {
  achieved: "You took another run at it and the fix landed. That is the work.",
  partial: "You took another run at it and moved it forward. One more pass finishes the job.",
  not_yet: "You took another run at it, and that already counts. Same ask, once more.",
};
