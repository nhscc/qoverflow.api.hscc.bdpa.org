// * These tests run through the entire process of acquiring this software,
// * using its features, and dealing with its error conditions across a variety
// * of runtimes (e.g. the currently maintained node versions).
// *
// * Typically, these tests involve the use of deep mock fixtures and/or Docker
// * containers, and are built to run in GitHub Actions CI pipelines; some can
// * also be run locally.

import { createDebugLogger } from 'rejoinder';

import { name as packageName } from 'rootverse:package.json';

import { reconfigureJestGlobalsToSkipTestsInThisFileIfRequested } from 'testverse:util.ts';

const TEST_IDENTIFIER = `${packageName.split('/').at(-1)!}-e2e`;
const debug = createDebugLogger({ namespace: 'qoverflow.api.hscc.bdpa.org' }).extend(
  TEST_IDENTIFIER
);
const nodeVersion = process.env.XPIPE_MATRIX_NODE_VERSION || process.version;

debug(`nodeVersion: "${nodeVersion}" (process.version=${process.version})`);

reconfigureJestGlobalsToSkipTestsInThisFileIfRequested({ it: true, test: true });

test.todo('this');
