/**
 * Guardrail — deterministic, mechanical check of the Narrator's message
 * against the 7 forbidden Coaching Admissibility categories. Runs AFTER
 * the Narrator, as a separate step. Never trusts the Narrator's own prompt
 * discipline as the only safeguard — same principle as the Evidence
 * Validator never trusting the Listen LLM's self-assigned class.
 *
 * Checked before writing this: alpha-workbench/test/proof.test.ts has an
 * inline banned-phrase array (["you should", "try ", "improve", "next
 * time", "lying", "dishonest"]) — NOT reusable here. It is not exported
 * from any package (test-local only), and it targets a different concern
 * entirely (imperative/dishonesty framing in Coach's Notes copy), with zero
 * lexical overlap with the 7 Coaching Admissibility categories below. A new
 * lexicon was necessary; this is not a rebuild of something that already
 * existed for this purpose.
 *
 * Regex-based, same discipline as evidence-validator/src/lexicons.ts:
 * narrow, catches obvious/literal violations, does not attempt semantic
 * judgment. Regressed against all 12 Coaching Atlas cases before ever
 * being run against real Narrator output — see test/guardrail.test.ts.
 */

export interface ForbiddenCategory {
  id: number;
  label: string;
  patterns: RegExp[];
}

export const FORBIDDEN_CATEGORIES: ForbiddenCategory[] = [
  {
    id: 1,
    label: "Evaluate competence",
    patterns: [
      /\bsenior[- ]level\b/i,
      /\b(shows?|demonstrates?) (strong|real|great|solid) (skills?|communication|judgment|thinking|competence)\b/i,
      /\b(cleverly|brilliantly|skillfully|smartly|expertly|masterfully)\b/i,
      /\bimpressive (thinking|skills?|work|judgment)\b/i,
      // Found via real live Narrator output (Case 009, forced-evidence test):
      // "shows you're tracking multiple variables at once" — a competence
      // inference this pattern list didn't cover (no intensifier + closed
      // noun list match). Added narrowly for this shape rather than
      // broadened generally, matching this project's "smallest responsible
      // change" discipline — see README.md.
      /\bshows? you('re| are) (tracking|thinking|reasoning|considering|weighing)\b/i,
    ],
  },
  {
    id: 2,
    label: "Predict outcomes",
    patterns: [
      /\bwill impress\b/i,
      /\bgets? you hired\b/i,
      /\bwill (get|land) you\b/i,
      /\bwinner:/i,
      /\bwill win\b/i,
    ],
  },
  {
    id: 3,
    label: "Infer personality or character traits",
    patterns: [
      /\byou (come across as|seem like|are) (a |an )?[\w-]+ (person|type)\b/i,
      /\bshows? you('re| are) (detail-oriented|meticulous|thorough|confident|honest|hardworking|diligent)\b/i,
    ],
  },
  {
    id: 4,
    label: "Assign unsupported numeric confidence",
    patterns: [
      /\b\d+(\.\d+)?\s*\/\s*10\b/,
      /\b\d+(\.\d+)?\s*out of\s*10\b/i,
      /\bscore:\s*\d/i,
      /\brating:\s*\d/i,
    ],
  },
  {
    id: 5,
    label: "Affirm that the learner's reasoning or conclusion is correct",
    patterns: [
      /\bexplains? why\b/i,
      // Both word orders: "that confirms X" AND "confirms that X" — an
      // earlier version of this pattern only caught the first order and
      // missed a real adversarial test message ("This confirms that... was
      // the root cause..."), the same reversed-word-order failure shape
      // found earlier tonight in the action-marker lexicon ("then i" vs
      // "i then"). Fixed the same way: cover both orders explicitly.
      /\b(which|that) (proves|confirms|validates)\b/i,
      /\b(proves|confirms|validates) (that|this)\b/i,
      /\bcorrectly identifies?\b/i,
      /\bthe right call\b/i,
      /\bwas the right\b/i,
      /\b(the|this is the) root cause\b/i,
      /\bwas the (root )?cause\b/i,
    ],
  },
  {
    id: 6,
    label: "Unsupported comparative or qualitative judgment about the answer",
    patterns: [
      /\b(more|much more|far more) (specific|compelling|convincing|impressive)\b/i,
      /\b(stronger|weaker|better|worse) (answer|version|attempt|story)\b/i,
    ],
  },
  {
    id: 7,
    label: "Imply suspicion or doubt about honesty",
    patterns: [
      /\bhonesty test\b/i,
      /\bcan'?t verify\b/i,
      /\bcannot verify\b/i,
      /\bverify your claims?\b/i,
      /\bhard to believe\b/i,
      /\bsounds? made up\b/i,
    ],
  },
];

export interface GuardrailViolation {
  category: number;
  label: string;
  matched_text: string;
  pattern: string;
}

export interface GuardrailResult {
  passed: boolean;
  violations: GuardrailViolation[];
}

export function guardrailCheck(message: string): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  for (const cat of FORBIDDEN_CATEGORIES) {
    for (const pattern of cat.patterns) {
      const match = message.match(pattern);
      if (match) {
        violations.push({ category: cat.id, label: cat.label, matched_text: match[0], pattern: pattern.source });
      }
    }
  }
  return { passed: violations.length === 0, violations };
}
