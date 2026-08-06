/**
 * Copy Registry — ALL learner-facing language lives here as data.
 * Style rules (verifier-enforced where mechanical):
 *  - no em dashes, ever (founder style rule, checked by the verifier)
 *  - task-level language only, never person-level praise
 *  - double quotes are reserved for verbatim learner spans
 *
 * Each opportunity's retry copy contains that opportunity's SIGNATURE phrase.
 * Signatures are unique across opportunities and are how the verifier proves
 * (a) the copy addresses the selected opportunity and (b) no rejected
 * opportunity's coaching leaked into the card.
 */

export interface OpportunityCopy {
  signature: string;      // unique fragment, present in this opportunity's retry copy
  retry_pattern_key: string;
  retry_copy: string;
  habit_id: string;       // primary habit for why_it_matters lookup
  elicit_question: string; // I3 branch opener (question form)
}

export const OPPORTUNITY_COPY: Record<string, OpportunityCopy> = {
  O2_structureless_ramble: {
    signature: "one sentence of setup",
    retry_pattern_key: "structure_constrained",
    retry_copy: "Run it again with one sentence of setup, then what you did, then how it ended.",
    habit_id: "H2",
    elicit_question: "You know the shape a story needs. Where did the setup end and the action start in that one?",
  },
  O3_missing_result: {
    signature: "what changed because",
    retry_pattern_key: "end_on_what_changed",
    retry_copy: "Same story. This time, end on what changed because of the work.",
    habit_id: "H2",
    elicit_question: "You have landed endings before. So what happened at the end of this one?",
  },
  O3_unquantified_result: {
    signature: "put a number on it",
    retry_pattern_key: "end_on_a_number",
    retry_copy: "Same ending, but put a number on it. Estimates count.",
    habit_id: "H5",
    elicit_question: "You have shown me numbers before, so I will just ask: what did the numbers do here?",
  },
  O4_ownership_hiding: {
    signature: "your role only",
    retry_pattern_key: "your_role_only",
    retry_copy: "Tell it again, your role only. Give every action an I.",
    habit_id: "H3",
    elicit_question: "You have claimed your own work before. Which of those actions were yours?",
  },
  // V3.3 copy pass: was signature "believe you were there" / retry "make me
  // believe you were there" / elicit "prove you lived this one" — all three
  // framed this around trust (implying the coach doubts the learner).
  // Reframed around memory: the goal is a picture an interviewer can recall,
  // not proof the coach didn't already have.
  O5_vagueness: {
    signature: "picture exactly where you were",
    retry_pattern_key: "make_me_believe",
    retry_copy: "Again, and help me picture exactly where you were. Name the machine, the week, the part.",
    habit_id: "H4",
    elicit_question: "You know the details. Which specifics would help someone picture exactly where you were?",
  },
  O7_weak_close: {
    signature: "new last sentence",
    retry_pattern_key: "new_last_sentence",
    retry_copy: "Same answer, new last sentence. End on the result and stop.",
    habit_id: "H9",
    elicit_question: "You have landed strong closes before. What should the final line of that answer have been?",
  },
  O8_buried_lede: {
    signature: "opening sentence the answer",
    retry_pattern_key: "answer_in_sentence_one",
    retry_copy: "Again, answer first. Make your opening sentence the answer itself.",
    habit_id: "H8",
    elicit_question: "You know the answer they are after. What is it in one sentence, up front?",
  },
  O10_filler_density: {
    signature: "let silence do the work",
    retry_pattern_key: "pause_substitution",
    retry_copy: "Once more, and wherever an um wants out, let silence do the work.",
    habit_id: "H10",
    elicit_question: "You can hear them now. Where would a pause have served you better?",
  },
  O11_employer_negativity: {
    signature: "no verdicts on people",
    retry_pattern_key: "facts_not_verdicts",
    retry_copy: "Same story, facts only. What happened and what you did, no verdicts on people.",
    habit_id: "H12",
    elicit_question: "You know what actually happened. Can you tell it with just the facts and your part in it?",
  },
};

export const WHY_IT_MATTERS: Record<string, string> = {
  H2: "Interviewers score against a rubric. A story with a clear arc is evidence they can write down. One without an arc cannot be scored at all.",
  H3: "They are hiring you, not your old team. If your part stays invisible, the safest call for them is no.",
  // V3.3 copy pass: was framed around verification/honesty-testing. Reframed
  // around memory, matching O5_vagueness's retry/elicit copy above.
  H4: "Specific details help interviewers picture the moment and remember your story, especially once they are comparing notes on every candidate they saw that day.",
  H5: "People who measure their work are read as people who manage their work. The number is what survives the interviewer's notes and the debrief.",
  H8: "Leading with the answer reads as clear thinking. It is the difference between making them dig for your point and handing it to them.",
  H9: "The last line is what sticks. Interviewers remember endings, and their notes lean on whatever you said last.",
  H10: "Content beats polish, but heavy filler makes listeners work harder than they should. Silence in the same spots reads as thought.",
  H12: "How you talk about hard moments and other people is read as a preview of how you will handle them on their team.",
};

/** I7 reframes, ONLY for the belief-blocked habit set. */
export const REFRAMES: Record<string, string> = {
  H3: "First, one reframe: saying I is not bragging. It is precision. The interviewer needs to know which decisions were yours.",
  H10: "First, one reframe: silence is not dead air. It is the sound of someone thinking, and interviewers respect it.",
  H12: "First, one reframe: a real setback told honestly scores better than a polished dodge. They ask because they want to see you handle it.",
};

/** Mission focus lines, used ONLY when mission_handling === aligned_selected. */
export const MISSION_FOCUS: Record<string, string> = {
  H2: "giving your answers a clear shape",
  H3: "making your ownership impossible to miss",
  H4: "grounding your stories in real specifics",
  H5: "making your results measurable",
  H8: "leading with the answer",
  H9: "landing your endings",
  H10: "letting pauses carry the pace",
  H12: "telling the hard stories with steadiness",
};

/** Second-coaching-point language, banned in learner-facing copy (word-boundary regexes). */
export const SECOND_POINT_BANLIST: RegExp[] = [
  /\balso\b/i, /\banother thing\b/i, /\bone more thing\b/i, /\badditionally\b/i,
  /\bsecond issue\b/i, /\bon top of that\b/i, /\bwhile we are at it\b/i, /\bas well\b/i,
];

/** Honest recognition when nothing earns a quote (JA-08 gate). */
export const DOWNGRADED_RECOGNITION =
  "You gave me a real answer to work with. That is the raw material coaching needs.";

export const ADVANCE_COPY =
  "That answer stands on its own. Take a breath and carry that into the next question.";

export const PROTECT_PREFIX = "One small thing, then we are done strong: ";
