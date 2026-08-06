/**
 * Grounding check — RESCOPED from a lexical-difference heuristic to
 * CONCRETE-ENTITY detection (grounding-rescope work order).
 *
 * The 8th check, distinct from the 7 tone/evaluative guardrail categories:
 * those check HOW the Narrator talks; this checks WHETHER what it says is
 * traceable to the evidence it was given. Found necessary by a real incident:
 * a Case 001 message asserted "an indicator check" — a tool that exists
 * nowhere in Case 001's evidence, only in Case 002's.
 *
 * WHY THE RESCOPE. The previous version flagged ANY distinctive word absent
 * from the evidence. That false-fired on ordinary synthesis/framing prose a
 * coach legitimately uses to describe real evidence ("investigative", "going",
 * "beyond", "leading", "broader", "fixing", "tracked", ...). Each fresh live
 * generation reached for NEW framing words, so the stopword list chased an
 * unbounded set. And rarity cannot separate the two classes: the real
 * fabrication "indicator" is MORE common than the false positive
 * "investigative", so no frequency cutoff works.
 *
 * THE ACTUAL FAILURE CLASS is narrower and stable: a fabricated CONCRETE
 * ENTITY — a physical tool / instrument / device the coach names as something
 * the learner used, that appears nowhere in the evidence. So this check flags
 * only concrete-entity nouns absent from the evidence, and lets all
 * prose/abstract vocabulary pass. It generalizes from the failure class
 * rather than banning words one at a time.
 *
 * HONEST LIMITATION (reported, not hidden): the concrete-entity vocabulary is
 * curated and therefore incomplete — a fabricated tool NOT in it is missed (a
 * false negative). This trades the old UNBOUNDED false-positive problem for a
 * BOUNDED false-negative one, on the safer side of a coaching product (a
 * missed catch degrades silently to the same safe fallback; an over-flag
 * degrades good coaching every turn). The maintenance model is also healthier:
 * the vocabulary grows only when a REAL fabrication is missed — a rare,
 * reviewable safety event — never on benign prose noise. This is not a claim
 * of completeness; a fully general solution needs semantic/NER capability,
 * out of scope here.
 */

export interface GroundingResult {
  passed: boolean;
  ungrounded_terms: string[];
  /** false when no evidence quotes were supplied — grounding is not
   * meaningfully checkable against nothing, so this is reported as
   * not-applicable rather than a false pass or false fail. */
  checked: boolean;
}

/**
 * Concrete physical entities — tools, instruments, measuring devices, and
 * distinctive hardware — the class the "indicator" incident belongs to.
 * Seeded from the known fabrication vocabulary plus common domain tooling.
 * Deliberately conservative: entries are (as far as practical) UNAMBIGUOUS
 * nouns, to avoid re-introducing false positives on noun/verb words used as
 * prose (e.g. "drill"/"file"/"scale"/"monitor" are intentionally omitted —
 * they are commonly verbs). Grows only on observed missed fabrications.
 *
 * Coverage is manufacturing-heavy because that is where the real incidents
 * occurred; cross-domain tooling (clinical, software, field) is sparse and
 * flagged as a known gap.
 */
const CONCRETE_ENTITY_LEMMAS = new Set<string>([
  // measuring / inspection instruments
  "indicator", "micrometer", "caliper", "gauge", "protractor", "thermometer",
  "multimeter", "voltmeter", "ammeter", "oscilloscope", "spectrometer",
  "tachometer", "manometer", "comparator", "interferometer", "feeler",
  "dial", "laser", "sensor", "transducer", "scanner", "goniometer",
  // machine tools / workholding
  "wrench", "spanner", "screwdriver", "pliers", "lathe", "grinder", "reamer",
  "mandrel", "arbor", "collet", "chuck", "spindle", "fixture", "gripper",
  "jig", "vise", "broach", "hone",
  // parts / hardware / physical objects
  "bearing", "gasket", "bushing", "flange", "actuator", "robot", "casting",
  "rivet", "fastener", "washer", "motor", "valve", "manifold", "solenoid",
  // light cross-domain (sparse — known gap)
  "syringe", "catheter", "defibrillator", "stethoscope", "spreadsheet",
  "server", "database",
]);

/** 5-char stem, tolerant of inflection ("machining"/"machined"), same basis both sides. */
function stem(word: string): string {
  return word.slice(0, Math.min(5, word.length));
}

/** Normalize a token to a bare lowercase word; strip possessive and a trailing plural -s. */
function normalize(raw: string): string {
  const w = raw.toLowerCase().replace(/'s$/, "").replace(/^-+|-+$/g, "");
  return w;
}

/** Is this token a known concrete entity? Exact lemma or its singular (strip trailing -s). */
function isConcreteEntity(word: string): boolean {
  if (CONCRETE_ENTITY_LEMMAS.has(word)) return true;
  if (word.endsWith("s") && CONCRETE_ENTITY_LEMMAS.has(word.slice(0, -1))) return true;
  return false;
}

/**
 * Flags concrete-entity nouns in the message that are absent from the cited
 * evidence. A word is "present" if its stem appears among the evidence stems
 * (tolerating inflection). Everything that is not a known concrete entity —
 * all synthesis, framing, and abstract vocabulary — is ignored by design.
 */
export function groundingCheck(message: string, evidenceQuotes: string[]): GroundingResult {
  if (evidenceQuotes.length === 0) {
    return { passed: true, ungrounded_terms: [], checked: false };
  }
  const evidenceStems = new Set((evidenceQuotes.join(" ").toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).map((w) => stem(normalize(w))));

  const words = message.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
  const seen = new Set<string>();
  const ungrounded_terms: string[] = [];
  for (const raw of words) {
    const w = normalize(raw);
    if (w.length < 3 || seen.has(w)) continue;
    seen.add(w);
    if (!isConcreteEntity(w)) continue;          // only concrete entities are in scope
    if (evidenceStems.has(stem(w))) continue;    // present in the learner's own words → grounded
    ungrounded_terms.push(w);
  }
  return { passed: ungrounded_terms.length === 0, ungrounded_terms, checked: true };
}
