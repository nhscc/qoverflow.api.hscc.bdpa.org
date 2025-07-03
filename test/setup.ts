import { toPath } from '@-xun/fs';
import { config as loadEnv } from 'dotenv';

import '@testing-library/jest-dom';
// ? See: https://github.com/jest-community/jest-extended#setup
import 'jest-extended';
import 'jest-extended/all';

loadEnv({ path: toPath(__dirname, '..', '.env'), quiet: true });
