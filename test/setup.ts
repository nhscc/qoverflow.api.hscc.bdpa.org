/**
 ** This file is automatically imported by Jest, and is responsible for
 **  bootstrapping the runtime for every test file.
 */

import { toPath } from '@-xun/fs';
import { config as loadEnv } from 'dotenv';

import '@testing-library/jest-dom';

// ? jest-extended will always come from @-xun/symbiote (i.e. transitively)
// {@symbiote/notInvalid jest-extended}

// ? https://github.com/jest-community/jest-extended#typescript
import 'jest-extended';
import 'jest-extended/all';

loadEnv({ path: toPath(__dirname, '..', '.env'), quiet: true });

jest.mock('@nhscc/backend-qoverflow~npm', () => require('@nhscc/backend-qoverflow'));
