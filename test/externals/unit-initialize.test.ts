import { rest } from 'msw';
import { setupServer } from 'msw/node';

import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { useMockDateNow } from 'multiverse/mongo-common';
import { RequestQueue } from 'multiverse/throttled-fetch';

import {
  mockEnvFactory,
  protectedImportFactory,
  withMockedOutput
} from 'testverse/setup';

// ? Ensure the isolated external picks up the memory server override
jest.mock('multiverse/mongo-schema', () => {
  return jest.requireActual('multiverse/mongo-schema');
});

jest.mock('multiverse/throttled-fetch');

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

const server = setupServer(
  rest.all('*', async (req, res, ctx) => {
    const { method, headers, params } = req;
    const body = await req.text();

    return res(
      ctx.status(
        body.startsWith('status=')
          ? Number.parseInt(body.split('status=').at(-1) || '200')
          : 200
      ),
      ctx.json({ method, headers: headers.raw(), params, body })
    );
  })
);

setupMemoryServerOverride();
useMockDateNow();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

it('rejects on bad environment', async () => {
  expect.hasAssertions();

  await withMockedEnv(() => importInitializeData({ expectedExitCode: 2 }), {
    // TODO
  });
});
