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

const withMockedEnv = mockEnvFactory({
  NODE_ENV: 'test',
  MONGODB_URI: 'fake'
});

const importInitializeData = protectedImportFactory<
  typeof import('externals/initialize-data').default
>({
  path: 'externals/initialize-data',
  useDefault: true
});

setupMemoryServerOverride();
useMockDateNow();

it('verbose when no DEBUG environment variable set and compiled NODE_ENV is not test', async () => {
  expect.hasAssertions();

  await withMockedOutput(async ({ infoSpy }) => {
    await withMockedEnv(() => importInitializeData({ expectedExitCode: 0 }), {
      DEBUG: undefined,
      NODE_ENV: 'something-else',
      OVERRIDE_EXPECT_ENV: 'force-no-check'
    });

    expect(infoSpy).toBeCalledWith(expect.stringContaining('execution complete'));
  });

  await withMockedOutput(async ({ infoSpy }) => {
    await withMockedEnv(() => importInitializeData({ expectedExitCode: 0 }));
    expect(infoSpy).not.toBeCalled();
  });
});

// eslint-disable-next-line jest/no-commented-out-tests
// it('rejects on bad environment', async () => {
//   expect.hasAssertions();
//
//   await withMockedEnv(() => importInitializeData({ expectedExitCode: 2 }), {
//     ???: ''
//   });
// });
