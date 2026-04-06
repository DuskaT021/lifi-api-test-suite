#!/usr/bin/env node
/**
 * Newman CLI validation script
 *
 * Runs the full LI.FI Postman collection via Newman and produces
 * a structured summary — pass/fail counts, failures, timing.
 *
 * Usage:
 *   node scripts/newman-run.js
 *   node scripts/newman-run.js --collection quote          # quote folder only
 *   node scripts/newman-run.js --bail                      # stop on first failure
 *   node scripts/newman-run.js --env staging               # use staging environment
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed
 */

const newman = require('newman');
const path = require('path');
const fs = require('fs');

// -- CLI args ----------------------------------------------------------------

const args = process.argv.slice(2);
const bail = args.includes('--bail');
const envArg = args.find(a => a.startsWith('--env='))?.split('=')[1] ?? 'production';
const folderArg = args.find(a => a.startsWith('--collection='))?.split('=')[1];

// -- Paths -------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const COLLECTION = path.join(ROOT, 'postman/collections/lifi_full_suite.postman_collection.json');
const ENVIRONMENT = path.join(ROOT, `postman/environments/${envArg}.postman_environment.json`);
const REPORT_DIR = path.join(ROOT, 'newman-reports');
const REPORT_JSON = path.join(REPORT_DIR, `report-${Date.now()}.json`);
const REPORT_HTML = path.join(REPORT_DIR, `report-${Date.now()}.html`);

if (!fs.existsSync(COLLECTION)) {
  console.error(`Collection not found: ${COLLECTION}`);
  process.exit(1);
}

if (!fs.existsSync(ENVIRONMENT)) {
  console.error(`Environment not found: ${ENVIRONMENT}`);
  process.exit(1);
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

// -- Newman options ----------------------------------------------------------

const options = {
  collection: require(COLLECTION),
  environment: require(ENVIRONMENT),
  bail,
  reporters: ['cli', 'json'],
  reporter: {
    json: { export: REPORT_JSON },
  },
  // Inject API key from env if set
  envVar: process.env.LIFI_API_KEY
    ? [{ key: 'apiKey', value: process.env.LIFI_API_KEY }]
    : [],
};

if (folderArg) {
  options.folder = folderArg;
  console.log(`\nRunning folder: "${folderArg}"\n`);
} else {
  console.log('\nRunning full LI.FI suite\n');
}

// -- Run ---------------------------------------------------------------------

newman.run(options, (err, summary) => {
  if (err) {
    console.error('Newman run error:', err);
    process.exit(1);
  }

  const { stats, failures, timings } = summary.run;

  // -- Summary output --------------------------------------------------------

  console.log('\n' + '═'.repeat(60));
  console.log('  LI.FI API Test Results');
  console.log('═'.repeat(60));
  console.log(`  Requests  : ${stats.requests.total} total, ${stats.requests.failed} failed`);
  console.log(`  Tests     : ${stats.assertions.total} total, ${stats.assertions.failed} failed`);
  console.log(`  Duration  : ${(timings.completed - timings.started) / 1000}s`);
  console.log('═'.repeat(60));

  if (failures.length > 0) {
    console.log('\n  FAILURES:\n');
    failures.forEach(({ error, source }) => {
      console.log(`  ✗ ${source?.name ?? 'unknown'}`);
      console.log(`    ${error.message}\n`);
    });
  } else {
    console.log('\n  ✓ All tests passed\n');
  }

  console.log(`  JSON report: ${REPORT_JSON}`);
  console.log('');

  process.exit(stats.assertions.failed > 0 ? 1 : 0);
});
