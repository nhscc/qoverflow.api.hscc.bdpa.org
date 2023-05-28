import { testApiHandler } from 'next-test-api-route-handler';
import { isolatedImport, wrapHandler, noopHandler } from 'testverse/setup';
import { withMiddleware } from 'multiverse/next-api-glue';
import useCors, { type Options } from 'multiverse/next-adhesive/use-cors';

afterEach(() => {
  jest.dontMock('cors');
});

it('works', async () => {
  expect.hasAssertions();

  await testApiHandler({
    handler: wrapHandler(
      withMiddleware(noopHandler, {
        descriptor: '/fake',
        use: []
      })
    ),
    test: async ({ fetch }) => {
      const res = await fetch({ method: 'OPTIONS' });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeNull();
    }
  });

  await testApiHandler({
    handler: wrapHandler(
      withMiddleware<Options>(noopHandler, {
        descriptor: '/fake',
        use: [useCors],
        options: { allowedMethods: ['GET', 'POST', 'HEAD'] }
      })
    ),
    test: async ({ fetch }) => {
      let res = await fetch({ method: 'OPTIONS' });
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,HEAD');

      res = await fetch({ method: 'GET' });
      expect(res.status).toBe(200);
    }
  });
});

it('handles cors package errors gracefully', async () => {
  expect.hasAssertions();

  jest.doMock(
    'cors',
    (): typeof import('cors') =>
      () =>
      (_req: unknown, _res: unknown, callback: (error: Error) => void) => {
        return callback(new Error('fake error'));
      }
  );

  await testApiHandler({
    handler: wrapHandler(
      withMiddleware(noopHandler, {
        descriptor: '/fake',
        use: [
          isolatedImport<typeof useCors>({
            path: 'multiverse/next-adhesive/use-cors'
          })
        ],
        useOnError: [
          (_req, res, context) => {
            expect(context.runtime.error).toMatchObject({ message: 'fake error' });
            res.status(555).end();
          }
        ]
      })
    ),
    test: async ({ fetch }) => expect((await fetch()).status).toBe(555)
  });
});
