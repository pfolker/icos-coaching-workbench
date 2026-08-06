# Proof Experience Prototype — Self-Critique (brutal, per the brief)

Built, tested (11/11), smoke-run over HTTP. Now the honest part.

## What still feels artificial
1. **Typing is the emotion killer, and it's structural.** The design assumes
   a learner in spoken flow; the prototype makes them TYPE the retry and then
   TYPE it again to lock it in. A typed "one clean repetition" has no fluency
   payoff — the mouth never gets the rep, so Beat 5's strongest feeling
   (smoothness you can physically feel) is muted to near zero. Consequence:
   **this prototype under-measures the wow.** If it lands even slightly while
   typed, the voiced version lands harder. If it fails typed, that is NOT yet
   disconfirmation. Evaluate accordingly.
2. **The notebooks are honest but will repeat verbatim by session three.**
   "no specifics I could write down" twice in one evening reads as a stamp,
   not an interviewer. Production needs fragment variation (or the LLM
   generator) — same grounding rules, varied handwriting.
3. **The handwriting is a CSS costume.** Serif italic on a dark card gestures
   at a notebook; it does not feel like one. Acceptable for an experiment;
   the metaphor deserves real treatment later.

## Where emotion gets interrupted
4. **Beat 1's question is almost always trivially easy** — V2 is obviously
   better, so the pick can feel like a rigged quiz. I kept it anyway: the
   click is a commitment device, and triviality IS the proof ("it's not close,
   and I did that"). But watch the failure case: when the retry did NOT
   improve, asking the learner to pick their own disappointment stings. The
   coach copy stays warm there, but this is the moment most likely to hurt an
   anxious user two days before an interview. Founder should feel this case
   deliberately during evaluation.
5. **Claim-It was gating the fork** — you had to write the sentence to see
   your choices. That is coercion wearing pedagogy's clothes, and it violated
   "the learner always controls depth." **Fixed in this pass:** the fork now
   appears immediately after the pick; the claim sits above it, offered.
6. **Client-side beat sequencing leaks.** The proof payload (diff, notebooks)
   arrives before the learner picks; dev tools can peek. Fine for a
   workbench, must be server-gated in any real deployment.

## Where the coach still talks too much
7. **Beat 2 originally had the coach speak right after the pick** — restating
   what the glowing words had already shown. Redundant, and worse, it put the
   AI's voice inside the learner's discovery beat. **Fixed in this pass:**
   the coach line is demoted below the notebooks, dimmed, last. The order is
   now: your words glow → the room's verdict (notebook) → only then, quietly,
   the coach. On a correct pick + achieved verdict, even that line is
   arguably deletable. Next iteration: silence as the coach's highest
   compliment.
8. The event log still narrates in engineering voice ("machine verdict
   implies v2") — invisible to learners, but the DEBUG panel open during
   founder evaluation will color his read. Evaluate learner-view-only first.

## What should become invisible
- The state line ("state: COMPARED") in the header.
- The verdict, everywhere learner-facing — already done; keep it that way
  even when an LLM writes the copy and is tempted to say "great improvement."
- Eventually, the retry BUTTON itself: in a voiced product, finishing your
  retry should simply... become Beat 1. No submit. The seam is the tell.

## Would a learner tell a friend?
The Notebook survives the typing handicap — watching "no specifics I could
write down" turn into "8%, 2% — quotable" in an interviewer's hand is the
moment with a story shape (discomfort → redemption), and "Take these into
Thursday" gives them a possession to mention. **Lock It In does not survive
typed** — nobody brags about retyping a paragraph. Verdict: the signature is
real, but its full tellable form requires voice. This prototype proves the
skeleton; the founder's evaluation should judge the skeleton, not the
costume.

## Thursday test, applied retroactively
Removed/changed under the constraint: verdicts (grading ≠ readiness), the
claim gate (friction ≠ readiness), coach-first reveal (AI presence ≠
readiness). Kept because they ARE readiness: the pick ("which one walks in
with you"), the notebook ("what survives the room"), Your Lines ("what you
carry in"). Everything on screen now answers the question or is gone.
