/**
 * Loads evidence-runtime/.env (if present) into process.env, for local
 * development convenience — so ANTHROPIC_API_KEY can live in a git-ignored
 * file instead of requiring the host process's inherited environment to
 * already have it set. Side-effect-only module: import it once, before
 * anything reads process.env.ANTHROPIC_API_KEY.
 *
 * Uses Node's built-in process.loadEnvFile (stable since Node ~20.6, no
 * dependency added) rather than the "dotenv" package. If no .env file
 * exists, this is a silent no-op and process.env is used exactly as
 * before — this is additive infrastructure, not a behavior change for
 * anyone who was already setting the variable in their shell.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "../.env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
