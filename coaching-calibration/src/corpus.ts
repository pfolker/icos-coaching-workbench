/**
 * Calibration corpus — REAL transcripts that already exist in the repo, each
 * with a Listen fixture so the structured coach's evidence graph is built
 * deterministically (only the Narrator is a live call). No new transcripts,
 * no recruiting (Phase 3 constraint).
 *
 * 16 fixture-backed cases spanning manufacturing, sales, healthcare, software,
 * customer support, and a deliberately thin answer. More can be added via a
 * live Listen call for transcripts without a fixture (HF dimensional cases,
 * adversarial cases) — see README; kept to fixtures here to bound live calls.
 */
import type { ListenEngineRawOutput } from "../../evidence-runtime/src/modelOutput";
import * as case001 from "../../evidence-runtime/fixtures/case001";
import * as case002 from "../../evidence-runtime/fixtures/case002";
import * as case004 from "../../evidence-runtime/fixtures/case004";
import * as case005 from "../../evidence-runtime/fixtures/case005";
import * as case006 from "../../evidence-runtime/fixtures/case006";
import * as case007 from "../../evidence-runtime/fixtures/case007";
import * as case008 from "../../evidence-runtime/fixtures/case008";
import * as case009 from "../../evidence-runtime/fixtures/case009";
import * as case010 from "../../evidence-runtime/fixtures/case010";
import * as founderCase from "../../coaching-runtime/src/founderCase";
import * as salesCase from "../../evidence-shadow-compare/src/salesRetentionCase";
import * as nursingCase from "../../evidence-shadow-compare/src/nursingCase";
import * as checkoutCase from "../../evidence-shadow-compare/src/checkoutOutageCase";
import * as supportCase from "../../evidence-shadow-compare/src/customerSupportCase";
import * as thinCase from "../../evidence-shadow-compare/src/thinCase";

export interface CalibrationCase {
  id: string;
  label: string;
  domain: string;
  transcript: string;
  fixture: ListenEngineRawOutput;
}

const c = (id: string, label: string, domain: string, m: { TRANSCRIPT: string; LISTEN_ENGINE_FIXTURE: ListenEngineRawOutput }): CalibrationCase =>
  ({ id, label, domain, transcript: m.TRANSCRIPT, fixture: m.LISTEN_ENGINE_FIXTURE });

export const CALIBRATION_CASES: CalibrationCase[] = [
  c("001", "Founder's original (deburring)", "manufacturing", case001),
  c("002", "Founder's retry (indicator check)", "manufacturing", case002),
  c("004", "Rambling but substantive (packaging line)", "manufacturing", case004),
  c("005", "Ambiguous ownership (reports automation)", "data/reporting", case005),
  c("006", "Contradictory ownership (staging env)", "software", case006),
  c("007", "Red-herring quote (vision inspection)", "manufacturing/quality", case007),
  c("008", "Two plausible causes (pressure-test)", "manufacturing", case008),
  c("009", "Genuine quotes, invalid reasoning (return policy)", "customer_support", case009),
  c("010", "Missing context inference (onboarding)", "product", case010),
  c("founder", "Founder's actual real retry (capstone)", "manufacturing", founderCase),
  c("sales", "Account about to churn → renewed +15%", "sales", salesCase),
  c("nursing", "Patient confusion + elevated HR → sepsis", "healthcare", nursingCase),
  c("checkout", "Recurring checkout outage → circuit breaker", "software/SRE", checkoutCase),
  c("support", "Order damaged twice → retained customer", "customer_support", supportCase),
  c("thin", "Deliberately evidence-poor answer", "manufacturing", thinCase),
];

export const CALIBRATION_CASES_BY_ID: Map<string, CalibrationCase> = new Map(CALIBRATION_CASES.map((x) => [x.id, x]));
