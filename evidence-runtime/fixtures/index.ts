import * as case001 from "./case001";
import * as case002 from "./case002";
import * as case004 from "./case004";
import * as case005 from "./case005";
import * as case006 from "./case006";
import * as case007 from "./case007";
import * as case008 from "./case008";
import * as case009 from "./case009";
import * as case010 from "./case010";

export interface FixtureCase {
  case_id: string;
  label: string;
  transcript: string;
  fixture: import("../src/modelOutput").ListenEngineRawOutput;
}

/** The 9 required Atlas cases (Phase 3A task), in Atlas order. Case 007 and
 * 009 additionally have their own extra exported variants (multi-candidate,
 * adversarial) used directly by tests, not listed as separate pipeline
 * cases here. */
export const FIXTURE_CASES: FixtureCase[] = [
  { case_id: "001", label: "Founder's Original Answer", transcript: case001.TRANSCRIPT, fixture: case001.LISTEN_ENGINE_FIXTURE },
  { case_id: "002", label: "Founder's Retry", transcript: case002.TRANSCRIPT, fixture: case002.LISTEN_ENGINE_FIXTURE },
  { case_id: "004", label: "Rambling but Substantive", transcript: case004.TRANSCRIPT, fixture: case004.LISTEN_ENGINE_FIXTURE },
  { case_id: "005", label: "Ambiguous Ownership", transcript: case005.TRANSCRIPT, fixture: case005.LISTEN_ENGINE_FIXTURE },
  { case_id: "006", label: "Contradictory Ownership", transcript: case006.TRANSCRIPT, fixture: case006.LISTEN_ENGINE_FIXTURE },
  { case_id: "007", label: "Red-Herring Quote", transcript: case007.TRANSCRIPT, fixture: case007.LISTEN_ENGINE_FIXTURE },
  { case_id: "008", label: "Two Plausible Causes", transcript: case008.TRANSCRIPT, fixture: case008.LISTEN_ENGINE_FIXTURE },
  { case_id: "009", label: "Genuine Quotes, Invalid Reasoning", transcript: case009.TRANSCRIPT, fixture: case009.LISTEN_ENGINE_FIXTURE },
  { case_id: "010", label: "Missing Context Makes Inference Tempting but Unsafe", transcript: case010.TRANSCRIPT, fixture: case010.LISTEN_ENGINE_FIXTURE },
];

export { case001, case002, case004, case005, case006, case007, case008, case009, case010 };
