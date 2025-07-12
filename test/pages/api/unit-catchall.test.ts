/* eslint-disable jest/require-hook */

import { testApiHandler } from 'next-test-api-route-handler';

import { api, setupMockBackend } from 'testverse:fixtures/index.ts';

jest.mock('@nhscc/backend-qoverflow');
jest.mock(
  '@nhscc/backend-qoverflow/api',
  (): typeof import('@nhscc/backend-qoverflow/api') => {
    return {
      ...jest.requireActual('@nhscc/backend-qoverflow/api')
      //authorizationHeaderToOwnerAttribute: jest.fn(() => Promise.resolve('mock-owner'))
    };
  }
);

jest.mock(
  'universe:route-wrapper.ts',
  (): typeof import('universe:route-wrapper.ts') => {
    const { middlewareFactory } = require('@-xun/api') as typeof import('@-xun/api');
    const { makeMiddleware: makeErrorHandlingMiddleware } =
      require('@-xun/api/middleware/handle-error') as typeof import('@-xun/api/middleware/handle-error');

    return {
      withMiddleware: jest.fn().mockImplementation(
        middlewareFactory({
          use: [],
          useOnError: [makeErrorHandlingMiddleware()],
          options: { legacyMode: true }
        })
      )
    } as unknown as typeof import('universe:route-wrapper.ts');
  }
);

setupMockBackend();

it('sends 404 regardless of method', async () => {
  expect.hasAssertions();

  await testApiHandler({
    pagesHandler: api.catchAllForNotFound,
    test: async ({ fetch }) => {
      await Promise.all(
        ['DELETE', 'GET', 'PATCH', 'POST', 'PUT'].map((method) => {
          return fetch({ method }).then(async (r) => {
            const status = r.status;
            const json = await r.json().catch(() => ({}));

            expect([method, status]).toStrictEqual([method, 404]);
            expect([method, json.success]).toStrictEqual([method, false]);
            expect([method, json.error]).toStrictEqual([method, expect.any(String)]);
            expect([method, Object.keys(json).length]).toStrictEqual([method, 2]);
          });
        })
      );

      await Promise.all(
        ['HEAD', 'OPTIONS' /* , 'TRACE' */].map((method) => {
          return fetch({ method }).then(async ({ status }) => {
            expect([method, status]).toStrictEqual([method, 404]);
          });
        })
      );
    }
  });
});
