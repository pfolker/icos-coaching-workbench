/** Alpha Workbench question bank — three behavioral questions, config not code. */
export interface WorkbenchQuestion {
  id: string;
  text: string;
  type: "behavioral" | "opinion" | "motivation" | "situational" | "unknown";
}

export const QUESTIONS: WorkbenchQuestion[] = [
  { id: "q1", type: "behavioral",
    text: "Tell me about a time you solved a difficult problem at work." },
  { id: "q2", type: "behavioral",
    text: "Tell me about a time you improved a process or saved your team time or money." },
  { id: "q3", type: "behavioral",
    text: "Tell me about a time something went wrong and how you handled it." },
];
