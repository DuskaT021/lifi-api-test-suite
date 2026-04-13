/**
 * Agentic scenario loader
 *
 * Reads the AI-generated scenario file (`mcp/generated-scenarios.json`) and
 * exposes `getAgentScenarios(endpoint)` so Playwright tests can consume
 * scenario-driven test cases without duplicating file-reading logic.
 *
 * If the JSON file cannot be read or parsed the function returns an empty
 * array and logs a warning — tests that depend on agentic scenarios are
 * silently skipped rather than hard-failing the suite.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeneratedScenario, ScenarioEndpoint, isValidScenario } from '../../mcp/mcp-test-scenarios';

// Re-export the type so test files only need one import.
export type { GeneratedScenario, ScenarioEndpoint };

// -- Path resolution ----------------------------------------------------------

// Resolved relative to this file's location:
//   playwright/helpers/ → ../../mcp/generated-scenarios.json
const SCENARIOS_PATH = path.resolve(__dirname, '../../mcp/generated-scenarios.json');

// -- Loader -------------------------------------------------------------------

/**
 * Returns all valid scenarios that target the given `endpoint`.
 *
 * Falls back to an empty array (with a console warning) if the file is
 * missing, unreadable, or contains no scenarios matching the endpoint.
 *
 * @example
 *   const scenarios = getAgentScenarios('/quote');
 *   // [{ name: '...', endpoint: '/quote', params: {...}, ... }, ...]
 */
export function getAgentScenarios(endpoint: ScenarioEndpoint): GeneratedScenario[] {
  let raw: string;

  try {
    raw = fs.readFileSync(SCENARIOS_PATH, 'utf-8');
  } catch (err) {
    console.warn(
      `[agentic-scenarios] Warning: could not read ${SCENARIOS_PATH} — ` +
      `${err instanceof Error ? err.message : String(err)}. ` +
      'Agentic scenario tests will be skipped.'
    );
    return [];
  }

  let parsed: unknown[];
  try {
    const json = JSON.parse(raw) as unknown;
    if (!Array.isArray(json)) {
      console.warn(
        `[agentic-scenarios] Warning: ${SCENARIOS_PATH} does not contain a JSON array. ` +
        'Agentic scenario tests will be skipped.'
      );
      return [];
    }
    parsed = json;
  } catch (err) {
    console.warn(
      `[agentic-scenarios] Warning: failed to parse ${SCENARIOS_PATH} — ` +
      `${err instanceof Error ? err.message : String(err)}. ` +
      'Agentic scenario tests will be skipped.'
    );
    return [];
  }

  return parsed
    .filter(isValidScenario)
    .filter((s) => s.endpoint === endpoint);
}
