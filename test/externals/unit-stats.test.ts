import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { useMockDateNow } from 'multiverse/mongo-common';

import {
  mockEnvFactory,
  protectedImportFactory,
  withMockedOutput
} from 'testverse/setup';

// ? Ensure the isolated external picks up the memory server override
jest.mock('multiverse/mongo-schema', () => {
  return jest.requireActual('multiverse/mongo-schema');
});

jest.mock('jsonfile', () => ({
  readFile: jest.fn().mockReturnValue({}),
  writeFile: jest.fn()
}));

const withMockedEnv = mockEnvFactory({
  NODE_ENV: 'test',
  MONGODB_URI: 'fake'
});

const importLogStats = protectedImportFactory<
  typeof import('externals/log-stats').default
>({
  path: 'externals/log-stats',
  useDefault: true
});

setupMemoryServerOverride();
useMockDateNow();

it('verbose when no DEBUG environment variable set and compiled NODE_ENV is not test', async () => {
  expect.hasAssertions();

  await withMockedOutput(async ({ infoSpy }) => {
    await withMockedEnv(() => importLogStats({ expectedExitCode: 0 }), {
      DEBUG: undefined,
      NODE_ENV: 'something-else',
      OVERRIDE_EXPECT_ENV: 'force-no-check'
    });

    expect(infoSpy).toBeCalledWith(expect.stringContaining('execution complete'));
  });

  await withMockedOutput(async ({ infoSpy }) => {
    await withMockedEnv(() => importLogStats({ expectedExitCode: 0 }));
    expect(infoSpy).not.toBeCalled();
  });
});

it('rejects on bad environment', async () => {
  expect.hasAssertions();

  await withMockedEnv(() => importLogStats({ expectedExitCode: 2 }), {
    MONGODB_URI: ''
  });
});
