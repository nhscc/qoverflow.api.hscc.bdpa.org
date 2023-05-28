import { rest, type ResponseTransformer, type RestContext } from 'msw';
import { setupServer } from 'msw/node';

import { debugNamespace as namespace } from 'universe/constants';

import { setupMemoryServerOverride } from 'multiverse/mongo-test';

import {
  getDummyQuestions,
  getDummyQuestionAnswers,
  getDummyAnswers,
  getDummyAnswerComments,
  getDummyComments,
  getDummyQuestionComments
} from 'externals/initialize-data/api-test';

import { mockEnvFactory, protectedImportFactory } from 'testverse/setup';

import type {
  SecondsFromNow,
  StackExchangeApiResponse
} from 'types/stackexchange-api';

void namespace;

// ? Ensure the isolated external picks up the memory server override
jest.mock('multiverse/mongo-schema', (): typeof import('multiverse/mongo-schema') => {
  return jest.requireActual('multiverse/mongo-schema');
});

const totalGeneratedQuestions = 100;
const intervalPeriodMs = 1;

const withMockedEnv = mockEnvFactory({
  // ! For max test perf, ensure this next line is commented out unless needed
  //DEBUG: `throttled-fetch:*,${namespace}:initialize-data,${namespace}:initialize-data:*`,
  //DEBUG: `${namespace}:initialize-data,${namespace}:initialize-data:*`,

  // ? Use these to control the options auto-selected for inquirer. Note that
  // ? these values must either be empty/undefined or a valid URL query string.
  TEST_PROMPTER_INITIALIZER: 'action=hit-ignore',
  TEST_PROMPTER_ERRORHANDLER: 'action=exit',
  TEST_PROMPTER_FINALIZER: 'action=commit',

  NODE_ENV: 'test',
  MONGODB_URI: 'fake',
  MAX_ANSWER_BODY_LENGTH_BYTES: '100',
  MAX_COMMENT_LENGTH: '100',
  MAX_QUESTION_BODY_LENGTH_BYTES: '100',
  STACKAPPS_INTERVAL_PERIOD_MS: intervalPeriodMs.toString(),
  STACKAPPS_MAX_REQUESTS_PER_INTERVAL: '25',
  STACKAPPS_TOTAL_API_GENERATED_QUESTIONS: totalGeneratedQuestions.toString(),
  STACKAPPS_COLLECTALL_QUESTION_ANSWERS: '4',
  STACKAPPS_COLLECTALL_QUESTION_COMMENTS: '3',
  STACKAPPS_COLLECTALL_FIRST_ANSWER_COMMENTS: '2',
  STACKAPPS_MAX_PAGE_SIZE: '2', // * Should be <= half of the above constants
  STACKAPPS_AUTH_KEY: 'special-stack-exchange-key'
});

const importInitializeData = protectedImportFactory<
  typeof import('externals/initialize-data').default
>({
  path: 'externals/initialize-data',
  useDefault: true
});

let counter = 0;
const mockedResponseJson: Partial<StackExchangeApiResponse<unknown>> = {};

const calcBackoffModulo = Math.ceil(5.49 * totalGeneratedQuestions);
const calcError500Modulo =
  totalGeneratedQuestions + Math.max(2, Math.ceil(0.1 * totalGeneratedQuestions));
const calcError502Modulo = calcError500Modulo + 1;
const calcError503Modulo = calcError500Modulo * 2;
const calcError429Modulo = calcError500Modulo * 2 + 1;

const maybeErrorResponse = (
  context: RestContext,
  { okTransformers }: { okTransformers: ResponseTransformer[] }
) => {
  delete mockedResponseJson.backoff;

  if (counter) {
    if (counter % calcBackoffModulo == 0) {
      mockedResponseJson.backoff = Math.max(
        0.1,
        intervalPeriodMs / 200
      ) as SecondsFromNow;
    }

    const results =
      counter % calcError500Modulo == 0
        ? [
            context.status(500),
            context.json({
              error_id: 123,
              error_message: 'fake 500 error',
              error_name: 'fake_500'
            })
          ]
        : counter % calcError503Modulo == 0
        ? [
            context.status(503),
            context.json({
              error_id: 123,
              error_message: 'fake 503 error',
              error_name: 'fake_503'
            })
          ]
        : counter % calcError502Modulo == 0
        ? [
            context.status(502),
            context.json({
              error_id: 123,
              error_message: 'fake 502 error',
              error_name: 'fake_502'
            })
          ]
        : counter % calcError429Modulo == 0
        ? [context.status(429)]
        : okTransformers;

    counter++;
    return results;
  } else {
    counter++;
    return okTransformers;
  }
};

const server = setupServer(
  rest.get('*/questions/:question_id/answers', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyQuestionAnswers(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  }),
  rest.get('*/questions/:question_id/comments', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyQuestionComments(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  }),
  rest.get('*/answers/:answer_id/comments', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyAnswerComments(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  }),
  rest.get('*/questions', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyQuestions(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  }),
  rest.get('*/answers', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyAnswers(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  }),
  rest.get('*/comments', async (req, res, context) => {
    return res(
      ...maybeErrorResponse(context, {
        okTransformers: [
          context.status(200),
          context.json({
            ...getDummyComments(req),
            ...mockedResponseJson
          })
        ]
      })
    );
  })
);

setupMemoryServerOverride();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('works as expected', async () => {
  expect.hasAssertions();
  await withMockedEnv(() => importInitializeData({ expectedExitCode: 0 }));
  // TODO: more testing
});
