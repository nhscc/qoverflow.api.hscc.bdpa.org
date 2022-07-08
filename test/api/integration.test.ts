/* eslint-disable jest/require-hook */
import { testApiHandler } from 'next-test-api-route-handler';
import { get as dotPath } from 'dot-prop';
import { toss } from 'toss-expression';
import { GuruMeditationError } from 'universe/error';
import { mockEnvFactory } from 'testverse/setup';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { getFixtures } from 'testverse/fixtures/integration';
import { BANNED_BEARER_TOKEN, DUMMY_BEARER_TOKEN } from 'multiverse/next-auth';
import { api } from 'testverse/fixtures';
import { getDb } from 'multiverse/mongo-schema';

import type { TestResultset, TestResult } from 'testverse/fixtures/integration';

setupMemoryServerOverride({
  // ? Ensure all tests share the same database state
  defer: true
});

const withMockedEnv = mockEnvFactory(
  { OVERRIDE_EXPECT_ENV: 'force-check' },
  { replace: false }
);

// ? Memory of the results of past fixture runs.
const memory: TestResultset = [
  { status: Infinity, json: {} }
] as unknown as TestResultset;

memory.latest = memory[0];
memory.getResultAt = () => memory[0];
memory.idMap = {};

// ? Fail fast and early
let lastRunSuccess = true;

describe('> middleware correctness tests', () => {
  Object.values(api)
    .flatMap((v) => Object.values(v))
    .forEach((endpoint) => {
      it(`${endpoint.uri} fails on bad authentication`, async () => {
        expect.hasAssertions();

        await withMockedEnv(
          async () => {
            await testApiHandler({
              handler: endpoint,
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
              handler: endpoint,
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
    if (countSkippedTests)
      // eslint-disable-next-line no-console
      console.warn(`${countSkippedTests} tests were skipped!`);
  });

  getFixtures(api).forEach(
    ({
      displayIndex,
      subject,
      handler,
      method,
      response,
      body,
      id,
      params,
      invisible
    }) => {
      if (!displayIndex) {
        throw new GuruMeditationError(
          'fixture is missing required property "displayIndex"'
        );
      }

      const shouldSkip =
        !subject ||
        !handler ||
        !method ||
        (!invisible &&
          (!response || !['number', 'function'].includes(typeof response.status)));

      // eslint-disable-next-line jest/prefer-expect-assertions
      (process.env.RUN_ONLY ? it.only : it)(
        `${shouldSkip ? '<SKIPPED> ' : ''}${
          displayIndex <= 0 ? '###' : '#' + displayIndex
        } ${method ? '[' + method + '] ' : ''}${
          handler?.uri ? handler.uri + ' ' : ''
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
            prop?: string
          ): TestResult<T> | T => {
            const result: TestResult<T> =
              typeof index == 'string'
                ? memory.idMap[index]
                : memory[index + (index < 0 ? displayIndex : 1)];

            const retval = prop ? dotPath<T>(result?.json, prop) : result;

            if (!result) {
              throw new GuruMeditationError(`no result at index "${index}"`);
            } else if (retval === undefined) {
              throw new GuruMeditationError(
                `${
                  prop ? 'prop path "' + prop + '" ' : ''
                }return value cannot be undefined`
              );
            }

            return retval;
          };

          const requestParams =
            typeof params == 'function' ? await params(memory) : params;
          const requestBody = typeof body == 'function' ? await body(memory) : body;

          await withMockedEnv(
            async () => {
              await testApiHandler({
                handler: handler || toss(new GuruMeditationError()),
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
                    typeof response?.status == 'function'
                      ? await response.status(res.status, memory)
                      : response?.status;

                  let json: ReturnType<typeof JSON.parse>;

                  try {
                    const jsonText = await res.text();
                    json = `<invalid JSON>${jsonText}`;
                    json = JSON.parse(jsonText);
                  } catch {}

                  if (expectedStatus) {
                    if (res.status != expectedStatus) {
                      // eslint-disable-next-line no-console
                      console.warn('unexpected status for result:', json);
                    }

                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(res.status).toBe(expectedStatus);
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(json.success)[
                      res.status == 200 ? 'toBeTrue' : 'toBeFalsy'
                    ]();
                    delete json.success;
                  }

                  const expectedJson =
                    typeof response?.json == 'function'
                      ? await response.json(json, memory)
                      : response?.json;

                  if (expectedJson) {
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect(json).toStrictEqual(expectedJson);
                  }

                  const memorize = { status: res.status, json } as TestResult;

                  if (id) memory.idMap[id] = memorize;
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
        }
      );
    }
  );
});
