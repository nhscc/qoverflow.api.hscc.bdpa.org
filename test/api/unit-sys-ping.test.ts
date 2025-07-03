/* eslint-disable no-global-assign */
import { BANNED_BEARER_TOKEN, DUMMY_BEARER_TOKEN } from '@-xun/api-strategy/auth';
import { getCommonSchemaConfig } from '@-xun/api-strategy/mongo';
import { getCommonDummyData } from '@-xun/api-strategy/mongo/dummy';
import { getDb } from '@-xun/mongo-schema';
import { setupMemoryServerOverride } from '@-xun/mongo-test';
import { testApiHandler } from 'next-test-api-route-handler';

import Endpoint, { config as Config } from 'universe/pages/api/sys/ping';

import { useMockDateNow } from 'testverse/util';

import type { InternalAuthEntry } from '@-xun/api-strategy/auth';

const pagesHandler = Endpoint as typeof Endpoint & { config?: typeof Config };
pagesHandler.config = Config;

// ! Note how these tests only rely on commonly available schema and data

useMockDateNow();
setupMemoryServerOverride({
  schema: getCommonSchemaConfig(),
  data: getCommonDummyData()
});

// * This suite blurs the line between unit and integration tests for
// * portability reasons.

// TODO: replace with next-fable (formerly / in addition to: @xunnamius/fable)

describe('middleware correctness tests', () => {
  it('endpoints is not authenticated', async () => {
    expect.hasAssertions();

    await testApiHandler({
      pagesHandler,
      test: async ({ fetch }) => {
        await expect(fetch().then((r) => r.status)).resolves.toBe(200);
      }
    });
  });

  it('endpoints ignores authentication and authorization header', async () => {
    expect.hasAssertions();

    await testApiHandler({
      pagesHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${DUMMY_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(200);
      }
    });
  });

  it('endpoint fails if req is rate limited', async () => {
    expect.hasAssertions();

    await (await getDb({ name: 'root' }))
      .collection<InternalAuthEntry>('auth')
      .updateOne(
        { token: { bearer: BANNED_BEARER_TOKEN } },
        { $set: { 'attributes.isGlobalAdmin': true } }
      );

    await testApiHandler({
      pagesHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${BANNED_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(429);
      }
    });
  });
});

describe('api/sys/ping', () => {
  it('pongs when we ping', async () => {
    expect.hasAssertions();

    const oldDate = Date;

    try {
      // @ts-expect-error: overriding Date is tough stuff
      Date = class extends Date {
        constructor(...args: Parameters<typeof Date>) {
          super(...args);
        }

        override toLocaleString(): string;
        override toLocaleString(
          locales?: string | string[],
          options?: Intl.DateTimeFormatOptions
        ): string;
        override toLocaleString(_locales?: unknown, _options?: unknown): string {
          return 'fake date, fake time';
        }
      };

      await testApiHandler({
        pagesHandler,
        test: async ({ fetch }) => {
          const res = await fetch();
          expect(res.status).toBe(200);
          await expect(res.json()).resolves.toStrictEqual({
            success: true,
            message: 'Hello to Mr. World at fake date, fake time'
          });
        }
      });

      await testApiHandler({
        pagesHandler,
        params: { name: 'Ms. Universe' },
        test: async ({ fetch }) => {
          const res = await fetch();
          expect(res.status).toBe(200);
          await expect(res.json()).resolves.toStrictEqual({
            success: true,
            message: 'Hello to Ms. Universe at fake date, fake time'
          });
        }
      });
    } finally {
      Date = oldDate;
    }
  });
});
