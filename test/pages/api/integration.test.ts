/* eslint-disable jest/no-standalone-expect */
/* eslint-disable jest/require-hook */
import assert from 'node:assert';

import { BANNED_BEARER_TOKEN, DUMMY_BEARER_TOKEN } from '@-xun/api-strategy/auth';
import { getDb } from '@-xun/mongo-schema';
import { setupMemoryServerOverride } from '@-xun/mongo-test';
import { get as dotPath } from 'dot-prop';
import { testApiHandler } from 'next-test-api-route-handler';

import { ErrorMessage } from 'multiverse+shared:error.ts';

import { getDummyData } from 'testverse:db.ts';
import { api } from 'testverse:fixtures/index.ts';
import { getFixtures } from 'testverse:fixtures/integration.ts';
import { mockEnvFactory, withMockedOutput } from 'testverse:util.ts';

import { getSchemaConfig } from '@nhscc/backend-qoverflow/db';

import type { TestResult, TestResultset } from 'testverse:fixtures/integration.ts';

setupMemoryServerOverride({
  // ? Ensure all tests share the same database state
  defer: true,
  schema: getSchemaConfig(),
  data: getDummyData()
});

const withMockedEnv = mockEnvFactory({
  NODE_ENV: 'production',
  MONGODB_URI: 'fake'
});

// ? Memory of the results of past fixture runs.
const memory: TestResultset = [
  { status: Infinity, json: {} }
] as unknown as TestResultset;

memory.latest = memory[0]!;
memory.getResultAt = () => memory[0]!;
memory.idMap = {};

// ? Fail fast and early
let lastRunSuccess = true;

describe('> middleware correctness tests', () => {
  Object.values(api)
    .flatMap((v) => (typeof v === 'function' ? [] : Object.values(v)))
    .forEach((endpoint) => {
      assert(endpoint.uri, ErrorMessage.GuruMeditation());

      it(`${endpoint.uri} fails on bad authentication`, async () => {
        expect.hasAssertions();

        await withMockedEnv(
          async () => {
            await testApiHandler({
              pagesHandler: endpoint,
              test: async ({ fetch }) => {
                await expect(fetch().then((r) => r.status)).resolves.toBe(401);
              }
            });
          },
          {
            REQUESTS_PER_CONTRIVED_ERROR: '0',
            IGNORE_RATE_LIMITS: 'true'
          }
        );
      });

      it(`${endpoint.uri} fails if rate limited`, async () => {
        expect.hasAssertions();

        await withMockedEnv(
          async () => {
            await testApiHandler({
              pagesHandler: endpoint,
              test: async ({ fetch }) => {
                await expect(
                  fetch({
                    headers: { Authorization: `bearer ${BANNED_BEARER_TOKEN}` }
                  }).then((r) => r.status)
                ).resolves.toBe(429);
              }
            });
          },
          {
            REQUESTS_PER_CONTRIVED_ERROR: '0',
            IGNORE_RATE_LIMITS: 'false'
          }
        );
      });
    });
});

describe('> fable integration tests', () => {
  // ? Clear the request-log so contrived errors are counted properly
  beforeAll(async () => {
    await (await getDb({ name: 'root' })).collection('request-log').deleteMany({});
  });

  let countSkippedTests = 0;

  afterAll(() => {
    if (countSkippedTests) {
      // eslint-disable-next-line no-console
      console.warn(`${countSkippedTests} tests were skipped!`);
    }
  });

  getFixtures(api).forEach(
    ({
      displayIndex,
      subject,
      pagesHandler: handler,
      method,
      response,
      body,
      id,
      params,
      invisible
    }) => {
      assert(displayIndex, 'fixture is missing required property "displayIndex"');

      const shouldSkip =
        !subject ||
        !handler ||
        !method ||
        (!invisible &&
          (!response || !['number', 'function'].includes(typeof response.status)));

      (process.env.RUN_ONLY ? it.only : it)(
        `${shouldSkip ? '<SKIPPED> ' : ''}${
          displayIndex <= 0 ? '###' : `#${displayIndex}`
        } ${method ? '[' + method + '] ' : ''}${
          handler?.uri ? `${handler.uri} ` : ''
        }${subject || ''}`,
        async () => {
          if (shouldSkip || (!lastRunSuccess && process.env.FAIL_FAST)) {
            countSkippedTests++;
            return;
          }

          expect.hasAssertions();
          lastRunSuccess = false;

          memory.getResultAt = <T = unknown>(
            index: number | string,
            property?: string
          ): TestResult<T> | T => {
            const result =
              typeof index === 'string'
                ? memory.idMap[index]
                : memory[index + (index < 0 ? displayIndex : 1)];

            const returnValue = property ? dotPath<T>(result?.json, property) : result;

            assert(result, `no result at index "${index}"`);
            assert(
              returnValue !== undefined,
              `${
                property ? 'prop path "' + property + '" ' : ''
              }return value cannot be undefined`
            );

            return returnValue;
          };

          const requestParams =
            typeof params === 'function' ? await params(memory) : params;
          const requestBody = typeof body === 'function' ? await body(memory) : body;

          await withMockedOutput(async ({ errorSpy, warnSpy }) => {
            await withMockedEnv(
              async () => {
                assert(handler, ErrorMessage.GuruMeditation());

                await testApiHandler({
                  pagesHandler: handler,
                  params: requestParams,
                  requestPatcher: (req) => {
                    req.headers.authorization = `bearer ${DUMMY_BEARER_TOKEN}`;
                    req.headers['content-type'] = 'application/json';
                  },
                  test: async ({ fetch }) => {
                    const res = await fetch({
                      method: method,
                      ...(requestBody ? { body: JSON.stringify(requestBody) } : {})
                    });

                    const expectedStatus =
                      typeof response?.status === 'function'
                        ? await response.status(res.status, memory)
                        : response?.status;

                    let json: ReturnType<typeof JSON.parse>;

                    try {
                      const jsonText = await res.text();
                      json = `<invalid JSON>${jsonText}`;
                      json = JSON.parse(jsonText);
                    } catch {}

                    if (expectedStatus) {
                      if (res.status !== expectedStatus) {
                        // eslint-disable-next-line no-console
                        console.warn('unexpected status for result:', json);
                      }

                      expect(res.status).toBe(expectedStatus);

                      expect(json.success)[
                        res.status === 200 ? 'toBeTrue' : 'toBeFalsy'
                      ]();
                      delete json.success;
                    }

                    const expectedJson =
                      typeof response?.json === 'function'
                        ? await response.json(json, memory)
                        : response?.json;

                    if (expectedJson) {
                      expect(json).toStrictEqual(expectedJson);
                    }

                    const memorize = { status: res.status, json } as TestResult;

                    if (id) {
                      memory.idMap[id] = memorize;
                    }

                    memory[displayIndex] = memorize;
                    memory.latest = memorize;
                    lastRunSuccess = true;
                  }
                });
              },
              {
                REQUESTS_PER_CONTRIVED_ERROR: '10',
                IGNORE_RATE_LIMITS: 'true'
              }
            );

            // ? Ignore logged errors and warnings by accessing any prop
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            (void errorSpy.mock, warnSpy.mock);
          });
        }
      );
    }
  );
});
