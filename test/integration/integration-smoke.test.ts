// * These brutally minimal "smoke" tests ensure this software can be invoked
// * and, when it is, exits cleanly. Functionality testing is not the goal here.

import { createDebugLogger } from 'rejoinder';

import { name as packageName } from 'rootverse:package.json';

import { reconfigureJestGlobalsToSkipTestsInThisFileIfRequested } from 'testverse:util.ts';

const TEST_IDENTIFIER = `${packageName.split('/').at(-1)!}-smoke`;
const debug = createDebugLogger({ namespace: 'qoverflow.api.hscc.bdpa.org' }).extend(
  TEST_IDENTIFIER
);
const nodeVersion = process.env.XPIPE_MATRIX_NODE_VERSION || process.version;

debug(`nodeVersion: "${nodeVersion}" (process.version=${process.version})`);

reconfigureJestGlobalsToSkipTestsInThisFileIfRequested({ it: true, test: true });

test.todo('this');
