/* eslint-disable @typescript-eslint/no-explicit-any */
import { testApiHandler } from 'next-test-api-route-handler';

import { api, setupMockBackend } from 'testverse/fixtures';

jest.mock('universe/backend');
jest.mock<typeof import('universe/backend/middleware')>(
  'universe/backend/middleware',
  () => {
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
    } as unknown as typeof import('universe/backend/middleware');
  }
);

const { mockedAuthAppUser } = setupMockBackend();

describe('api/v1/users', () => {
  describe('/ [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.users,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.users).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/ [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.users,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.user).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:username [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsername,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.user).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:username [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsername,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:username [DELETE]', () => {
    it('accepts DELETE requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsername,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'DELETE' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:username/auth [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsernameAuth,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(403);
          expect(json.success).toBeFalse();
          expect(json.error).toBeString();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });

      mockedAuthAppUser.mockReturnValue(Promise.resolve(true));

      await testApiHandler({
        pagesHandler: api.v1.usersUsernameAuth,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:username/questions [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsernameQuestions,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.questions).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:username/answers [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsernameAnswers,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.answers).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:username/points [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.usersUsernamePoints,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });
});
