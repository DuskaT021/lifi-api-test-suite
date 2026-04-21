#!/usr/bin/env node
/**
 * Build Postman iteration data from mcp/generated-scenarios.json.
 *
 * Output schema:
 * [
 *   {
 *     "name": "...",
 *     "endpoint": "/quote",
 *     "requestUrl": "https://li.quest/v1/quote?...",
 *     "expectedStatusCsv": "200,404",
 *     "expectedBehaviour": "valid_route",
 *     "notes": "..."
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'mcp', 'generated-scenarios.json');
const OUTPUT_DIR = path.join(ROOT, 'postman', 'data');
const OUTPUT = path.join(OUTPUT_DIR, 'agentic-scenarios.postman_data.json');

function safeEncode(value) {
  return encodeURIComponent(String(value));
}

function buildRequestUrl(endpoint, params) {
  const baseUrl = 'https://li.quest/v1';
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return `${baseUrl}${endpoint}`;
  const query = entries
    .map(([k, v]) => `${safeEncode(k)}=${safeEncode(v)}`)
    .join('&');
  return `${baseUrl}${endpoint}?${query}`;
}

function toRow(scenario) {
  const expectedStatus = Array.isArray(scenario.expectedStatus)
    ? scenario.expectedStatus.filter((n) => Number.isInteger(n))
    : [200];

  return {
    name: scenario.name,
    endpoint: scenario.endpoint,
    requestUrl: buildRequestUrl(scenario.endpoint, scenario.params),
    expectedStatusCsv: expectedStatus.join(','),
    expectedBehaviour: scenario.expectedBehaviour ?? '',
    notes: scenario.notes ?? '',
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Input not found: ${INPUT}`);
  }

  const raw = fs.readFileSync(INPUT, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('generated-scenarios.json must be an array');
  }

  const rows = parsed
    .filter((s) => s && typeof s === 'object' && typeof s.endpoint === 'string')
    .map(toRow);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(rows, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${rows.length} row(s) to ${OUTPUT}`);
}

main();
