/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AppError,
  GuruMeditationError,
  HttpError,
  InvalidAppEnvironmentError
} from 'named-app-errors';

import jsonFile from 'jsonfile';
import { type AnyBulkWriteOperation, ObjectId } from 'mongodb';
import { toss } from 'toss-expression';
import { setTimeout as wait } from 'node:timers/promises';
import inquirer, { type PromptModule } from 'inquirer';
import { decode as decodeEntities } from 'html-entities';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';

import { itemToObjectId } from 'multiverse/mongo-item';
import { RequestQueue } from 'multiverse/throttled-fetch';
import { debugFactory } from 'multiverse/debug-extended';
import { getDb } from 'multiverse/mongo-schema';
import { hydrateDb } from 'multiverse/mongo-test';

import { dummyAppData } from 'testverse/db';

import { getApi } from 'externals/initialize-data/api';
//import { dummyRequestInspector } from 'externals/initialize-data/api-test';
import { deriveKeyFromPassword } from 'externals/initialize-data/crypto';

import type {
  AnswerId,
  InternalAnswer,
  InternalComment,
  InternalMail,
  InternalQuestion,
  InternalUser,
  QuestionId
} from 'universe/backend/db';

import type {
  StackExchangeAnswer,
  StackExchangeApiResponse,
  StackExchangeComment,
  StackExchangeQuestion
} from 'types/stackexchange-api';

const debugNamespace = `${namespace}:initialize-data`;
const cachePath = `${__dirname}/initialize-data-cache.json`;

const log = debugFactory(debugNamespace);
const debug = debugFactory(`${debugNamespace}:debug`);
const logOrDebug = () => {
  return log.enabled ? log : debug;
};

/**
 * Represents one second in milliseconds.
 */
const oneSecondInMs = 1000;

/**
 * Maximum number of times to retry certain failed requests.
 */
const maxRequestRetries = 10;

/**
 * Delay (in ms) after a rate limit is detected.
 */
const delayAfterRequestRateLimitMs =
  (process.env.NODE_ENV == 'test' ? 0.1 : 180) * oneSecondInMs;

/**
 * Delay (in ms) after a server error is detected.
 */
const delayAfterRequestErrorMs =
  (process.env.NODE_ENV == 'test' ? 0.1 : 60) * oneSecondInMs;

// eslint-disable-next-line no-console
log.log = console.info.bind(console);

// ? Ensure this next line survives Webpack
if (!globalThis.process.env.DEBUG && getEnv().NODE_ENV != 'test') {
  debugFactory.enable(
    `${debugNamespace},${debugNamespace}:*,-${debugNamespace}:debug`
  );
}

/**
 * Returns the `inquirer` instance unless a string `testPrompterParams` is given
 * (passed to URLSearchParams, usually provided by a TEST_PROMPTER_X environment
 * variable), in which case a passthrough promise that resolves to a simulated
 * answer object based on `testPrompterParams` is returned as the resolved
 * result of calling `prompt()` instead.
 */
const getPrompter = (testPrompterParams?: string): { prompt: PromptModule } => {
  return testPrompterParams
    ? {
        prompt: (() => {
          debug(
            `using simulated inquirer prompt based on params: ${testPrompterParams}`
          );

          return Promise.resolve(
            Object.fromEntries(
              Array.from(new URLSearchParams(testPrompterParams).entries())
            )
          );
        }) as unknown as PromptModule
      }
    : inquirer;
};

/**
 * Transforms a positive, negative, or zero net score into upvotes and
 * downvotes.
 */
const getUpvotesDownvotesFromScore = (score: number) => {
  const aVotes = Math.floor(
    Math.random() * score +
      (score == 0 ? Math.random() * 10 ** (Math.random() * 4) : 0)
  );
  const bVotes = score + aVotes;
  return [Math.abs(Math.max(aVotes, bVotes)), Math.abs(Math.min(aVotes, bVotes))] as [
    upvotes: number,
    downvotes: number
  ];
};

/**
 * Writes out cache data to a well-known location on disk.
 */
const cacheDataToDisk = async (data: Data | null) => {
  if (!data) {
    throw new GuruMeditationError('cannot cache null data');
  }

  logOrDebug()(
    `writing out cache keys (${Object.keys(data).join(', ')}) to ${cachePath}`
  );

  await jsonFile.writeFile(cachePath, data, { spaces: 2 });
};

/**
 * Reports statistics about the cached data.
 */
const getDataStats = (data: Data | null) => {
  if (!data) {
    throw new GuruMeditationError('cannot generate stats from null data');
  }

  let questionsDataSizeBytes = 0;
  let userDataSizeBytes = 0;
  let totalAnswers = 0;
  let totalComments = 0;

  data.questions.forEach((question) => {
    questionsDataSizeBytes += Buffer.byteLength(JSON.stringify(question), 'utf8');
    totalComments += question.commentItems.length;
    question.answerItems.forEach((answer) => {
      totalAnswers++;
      totalComments += answer.commentItems.length;
    });
  });

  data.users.forEach((user) => {
    userDataSizeBytes += Buffer.byteLength(JSON.stringify(user), 'utf8');
  });

  return {
    cacheMetadata: data.cache,
    totalQuestions: data.questions.length,
    totalAnswers,
    totalComments,
    totalUsers: data.users.length,
    dataSizesInBytes: {
      questions: questionsDataSizeBytes,
      users: userDataSizeBytes
    }
  };
};

const commitApiDataToDb = async (data: Data | null) => {
  if (!data) {
    throw new GuruMeditationError('cannot commit null data');
  }

  logOrDebug()('committing StackExchange API data to database');

  const appDb = await getDb({ name: 'app' });

  const [mailResult, questionsResult, usersResult] = await Promise.all([
    data.users.length && dummyAppData.mail.length
      ? appDb.collection<InternalMail>('mail').insertMany(
          data.users
            .slice(0, Math.min(data.users.length, dummyAppData.mail.length * 2))
            .map((user, ndx, users) => {
              return ndx % 2 == 0
                ? {
                    _id: new ObjectId(),
                    createdAt: Date.now(),
                    sender: user.username,
                    receiver: users[ndx + 1]?.username || user.username,
                    subject: dummyAppData.mail[ndx / 2]?.subject || 'no subject',
                    text:
                      dummyAppData.mail[ndx / 2]?.text ||
                      'I could not think of a message...'
                  }
                : null;
            })
            .filter<InternalMail>((value): value is InternalMail => Boolean(value))
        )
      : { insertedCount: '0 (empty)' },
    data.questions.length
      ? appDb.collection<InternalQuestion>('questions').insertMany(
          data.questions.map((question) => {
            const decodedTitle = decodeEntities(question.title);

            return {
              ...question,
              commentItems: question.commentItems.map((comment) => {
                return {
                  ...comment,
                  text: decodeEntities(comment.text)
                };
              }),
              answerItems: question.answerItems.map((answer) => {
                return {
                  ...answer,
                  commentItems: answer.commentItems.map((comment) => {
                    return {
                      ...comment,
                      text: decodeEntities(comment.text)
                    };
                  })
                };
              }),
              title: decodeEntities(question.title),
              'title-lowercase': decodedTitle.toLowerCase()
            };
          })
        )
      : { insertedCount: '0 (empty)' },
    data.users.length
      ? appDb.collection<InternalUser>('users').bulkWrite(
          data.users.map<AnyBulkWriteOperation<InternalUser>>((user) => {
            return {
              updateOne: {
                filter: { username: user.username },
                update: {
                  $addToSet: {
                    questionIds: { $each: user.questionIds },
                    answerIds: { $each: user.answerIds }
                  },
                  $setOnInsert: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    key: user.key,
                    salt: user.salt,
                    points: user.points
                  }
                },
                upsert: true
              }
            };
          })
        )
      : { nUpserted: '0 (empty)', nModified: '0 (empty)' }
  ]);

  logOrDebug()(`inserted ${mailResult.insertedCount} mail documents`);
  logOrDebug()(`inserted ${questionsResult.insertedCount} question documents`);
  logOrDebug()(
    `upserted ${usersResult.nUpserted}, updated ${usersResult.nModified} user documents`
  );
};

const commitRootDataToDb = async (data: Data | null) => {
  if (!data) {
    throw new GuruMeditationError('cannot commit null data');
  }

  logOrDebug()('committing dummy root data to database via hydration');

  await hydrateDb({ name: 'root' });
};

/**
 * Setups up a database from scratch by creating collections (only if they do
 * not already exist) and populating them with a large amount of data. Suitable
 * for initializing local machines or production instances alike.
 *
 * This function is idempotent (can be called multiple times without changing
 * anything) and data-preserving (all actions are non-destructive: data is never
 * overwritten or deleted)
 */
const invoked = async () => {
  try {
    const {
      MAX_ANSWER_BODY_LENGTH_BYTES: maxAnswerLength,
      MAX_COMMENT_LENGTH: maxCommentLength,
      MAX_QUESTION_BODY_LENGTH_BYTES: maxQuestionBodyLength,
      MAX_QUESTION_TITLE_LENGTH: maxQuestionTitleLength,
      STACKAPPS_INTERVAL_PERIOD_MS: intervalPeriodMs,
      STACKAPPS_MAX_REQUESTS_PER_INTERVAL: maxRequestsPerInterval,
      STACKAPPS_TOTAL_API_GENERATED_QUESTIONS: desiredApiGeneratedQuestionsCount,
      STACKAPPS_COLLECTALL_QUESTION_ANSWERS: collectAllQuestionAnswersCount,
      STACKAPPS_COLLECTALL_QUESTION_COMMENTS: collectAllQuestionCommentsCount,
      STACKAPPS_COLLECTALL_FIRST_ANSWER_COMMENTS: collectAllFirstAnswerCommentsCount,
      STACKAPPS_MAX_PAGE_SIZE: maxPageSize,
      STACKAPPS_AUTH_KEY: stackExAuthKey
    } = getEnv();

    if (typeof intervalPeriodMs != 'number' || !(intervalPeriodMs >= 0)) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_INTERVAL_PERIOD_MS must be greater than or equal to 0'
      );
    }

    if (!maxRequestsPerInterval || !(maxRequestsPerInterval > 0)) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_MAX_REQUESTS_PER_INTERVAL must be greater than zero'
      );
    }

    if (
      !desiredApiGeneratedQuestionsCount ||
      !(desiredApiGeneratedQuestionsCount > 0)
    ) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_TOTAL_API_GENERATED_QUESTIONS must be greater than zero'
      );
    }

    if (!collectAllQuestionAnswersCount || !(collectAllQuestionAnswersCount > 0)) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_COLLECTALL_QUESTION_ANSWERS must be greater than zero'
      );
    }

    if (!collectAllQuestionCommentsCount || !(collectAllQuestionCommentsCount > 0)) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_COLLECTALL_QUESTION_COMMENTS must be greater than zero'
      );
    }

    if (
      !collectAllFirstAnswerCommentsCount ||
      !(collectAllFirstAnswerCommentsCount > 0)
    ) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_COLLECTALL_FIRST_ANSWER_COMMENTS must be greater than zero'
      );
    }

    if (!maxPageSize || !(maxPageSize > 0) || !(maxPageSize <= 100)) {
      throw new InvalidAppEnvironmentError(
        'STACKAPPS_MAX_PAGE_SIZE must be greater than zero and less than or equal to 100'
      );
    }

    if (!stackExAuthKey) {
      throw new InvalidAppEnvironmentError('STACKAPPS_AUTH_KEY must be provided');
    }

    let interrogateApi = true;
    let usedStackExAuthKey = stackExAuthKey;
    let data: Data | null = null;

    try {
      debug(
        process.env.TEST_SKIP_REQUESTS
          ? 'saw debug env var TEST_SKIP_REQUESTS. No cache read performed'
          : `reading in results from cache at ${cachePath}`
      );

      data = process.env.TEST_SKIP_REQUESTS
        ? null
        : await jsonFile.readFile(cachePath, {
            reviver(key, value) {
              return key == '_id' ? itemToObjectId(value) : value;
            }
          });
    } catch {
      data = null;
    }

    debug(`found cached results: ${data ? 'yes' : 'no'}`);

    debug(
      `cached data is: ${
        typeof data?.cache.complete != 'boolean'
          ? 'non-existent'
          : data?.cache.complete
          ? 'complete'
          : 'incomplete'
      }`
    );

    await getPrompter(process.env.TEST_PROMPTER_INITIALIZER)
      .prompt<{ action: string; token: string }>([
        {
          name: 'action',
          message: 'select an initializer action',
          type: 'list',
          choices: [
            ...(typeof data?.cache.complete == 'boolean'
              ? [
                  {
                    name: 'reinterrogate API using cache',
                    value: 'hit'
                  },
                  {
                    name: 'reinterrogate API using cache and a custom token',
                    value: 'hit-custom'
                  },
                  {
                    name: 'ignore cache and reinterrogate API',
                    value: 'hit-ignore'
                  },
                  {
                    name: 'ignore cache and reinterrogate API using a custom token',
                    value: 'hit-ignore-custom'
                  },
                  {
                    name: data?.cache.complete
                      ? 'commit completed cache data to database'
                      : 'commit incomplete cache data to database',
                    value: 'commit'
                  }
                ]
              : [
                  {
                    name: 'interrogate API',
                    value: 'hit'
                  },
                  {
                    name: 'interrogate API using a custom token',
                    value: 'hit-custom'
                  }
                ]),
            { name: 'exit', value: 'exit' }
          ]
        },
        {
          name: 'token',
          message: 'enter new token',
          type: 'input',
          when: (answers) => answers.action.includes('custom')
        }
      ])
      .then(async (answers) => {
        if (answers.action == 'exit') {
          logOrDebug()('execution complete');
          process.exit(0);
        }

        if (answers.action.startsWith('commit')) {
          await commitApiDataToDb(data);

          logOrDebug()('execution complete');
          process.exit(0);
        }

        interrogateApi = answers.action.startsWith('hit');
        usedStackExAuthKey = answers.token ?? usedStackExAuthKey;

        if (answers.action.startsWith('hit-ignore')) {
          logOrDebug()('cache ignored');
          data = null;
        }
      });

    if (interrogateApi) {
      logOrDebug()('interrogating StackExchange API...');

      data =
        data?.cache?.complete === false
          ? data
          : {
              questions: [],
              users: [],
              cache: {
                complete: false
              }
            };

      const { keyString, saltString } = await deriveKeyFromPassword('password');

      const addOrUpdateUser = async (
        username: string,
        {
          points,
          newQuestionId: newQuestionId,
          newAnswerId: newAnswerId
        }: { points: number; newQuestionId?: QuestionId; newAnswerId?: AnswerId }
      ) => {
        let user = data!.users.find((u) => u.username == username);

        if (!user) {
          user = {
            _id: new ObjectId(),
            username,
            email: `${username}@fake-email.com`,
            salt: saltString,
            key: keyString,
            points,
            questionIds: [],
            answerIds: []
          };

          data!.users.push(user);
        }

        if (newAnswerId) {
          if (!newQuestionId) {
            throw new GuruMeditationError(
              'localUpsertUser cannot use answerId without corresponding questionId'
            );
          }

          user.answerIds.push([newQuestionId, newAnswerId]);
        } else if (newQuestionId) {
          user.questionIds.push(newQuestionId);
        }

        return user;
      };

      const endpointBackoffs: Record<string, number> = {};

      // * max 30req/1000ms https://api.stackexchange.com/docs/throttle
      const queue = new RequestQueue({
        intervalPeriodMs,
        maxRequestsPerInterval,
        // requestInspector: dummyRequestInspector
        fetchErrorInspector: ({
          error: error_,
          queue: q,
          requestInfo,
          requestInit,
          state
        }) => {
          const subDebug = logOrDebug().extend('err');

          const apiEndpoint =
            (state.apiEndpoint as string) ||
            toss(new GuruMeditationError('missing apiEndpoint metadata'));

          const tries = (state.tries as number) ?? 1;
          const retriedTooManyTimes = tries >= maxRequestRetries;

          subDebug(
            `handling fetch error for [${apiEndpoint}] (try #${tries}): ${requestInfo}`
          );

          if (retriedTooManyTimes) {
            subDebug.warn('request retried too many times');
            throw new HttpError(`${error_}`);
          }

          subDebug(`requeuing errored request: ${requestInfo}`);
          return q.addRequestToQueue(requestInfo, requestInit, {
            ...state,
            rescheduled: true,
            tries: tries + 1
          });
        },
        requestInspector: ({ queue: q, requestInfo, requestInit, state }) => {
          const subDebug = logOrDebug().extend('req');

          const apiEndpoint =
            (state.apiEndpoint as string) ||
            toss(new GuruMeditationError('missing apiEndpoint metadata'));
          const tries = (state.tries as number) ?? 1;

          subDebug(`saw [${apiEndpoint}] (try #${tries}): ${requestInfo}`);

          if (
            typeof endpointBackoffs[apiEndpoint] == 'number' &&
            Date.now() <= endpointBackoffs[apiEndpoint]
          ) {
            subDebug.warn(
              `request will be delayed until ${new Date(
                endpointBackoffs[apiEndpoint]
              ).toLocaleString()}`
            );

            return wait(
              Math.max(0, endpointBackoffs[apiEndpoint] - Date.now()),
              undefined,
              {
                signal: requestInit.signal as AbortSignal
              }
            ).then(() => {
              subDebug(`requeuing delayed request: ${requestInfo}`);
              return q.addRequestToQueue(requestInfo, requestInit, {
                ...state,
                rescheduled: true
              });
            });
          }
        },
        responseInspector: async ({
          response,
          queue: q,
          requestInfo,
          requestInit,
          state
        }) => {
          const subDebug = logOrDebug().extend('res');
          const res = response as Response;

          if (state.rescheduled as boolean) {
            subDebug(`passing through rescheduled request to ${requestInfo}`);
            return res;
          } else {
            const apiEndpoint =
              (state.apiEndpoint as string) ||
              toss(new GuruMeditationError('missing apiEndpoint metadata'));
            const tries = (state.tries as number) ?? 1;
            const retriedTooManyTimes = tries >= maxRequestRetries;

            const json: Partial<StackExchangeApiResponse<unknown>> = await res
              .json()
              .catch(() => ({}));

            subDebug(`saw [${apiEndpoint}] (try #${tries}): ${requestInfo}`);

            if (retriedTooManyTimes) {
              subDebug.warn('request retried too many times');
            }

            if (json.backoff) {
              endpointBackoffs[apiEndpoint] =
                Date.now() + json.backoff * oneSecondInMs;

              subDebug.warn(
                `saw backoff demand in response, delaying further requests to endpoint "${apiEndpoint}" until ${new Date(
                  endpointBackoffs[apiEndpoint]
                ).toLocaleString()}`
              );
            }

            if (retriedTooManyTimes && json.error_message) {
              throw new HttpError(res, json.error_message);
            } else if (res.ok) {
              return json;
            } else {
              if (retriedTooManyTimes || (res.status < 500 && res.status != 429)) {
                throw new HttpError(res);
              } else {
                if (res.status == 502 || res.status == 429) {
                  subDebug.warn(
                    `rate limited detected (${res.status}), delaying next interval request processing for ${delayAfterRequestRateLimitMs}ms before requeuing`
                  );
                  q.delayRequestProcessingByMs(delayAfterRequestRateLimitMs);
                } else {
                  subDebug.warn(
                    `a server error occurred (${res.status}), delaying next interval request processing for ${delayAfterRequestErrorMs}ms before requeuing`
                  );
                  q.delayRequestProcessingByMs(delayAfterRequestErrorMs);
                }

                return q.addRequestToQueue(requestInfo, requestInit, {
                  ...state,
                  tries: tries + 1
                });
              }
            }
          }
        }
      });

      queue.beginProcessingRequestQueue();

      try {
        while (interrogateApi) {
          interrogateApi = false;
          const api = getApi(usedStackExAuthKey);

          try {
            if (process.env.TEST_SKIP_REQUESTS) {
              debug.warn(
                'saw debug env var TEST_SKIP_REQUESTS. No requests will be made'
              );
              debug('queue stats: %O', queue.getStats());
            } else {
              await Promise.all([
                (async () => {
                  for (
                    let questionPage = 1;
                    data.questions.length < desiredApiGeneratedQuestionsCount;
                    ++questionPage
                  ) {
                    const questions = await queue.addRequestToQueue<
                      StackExchangeApiResponse<StackExchangeQuestion>
                    >(
                      api.questions({
                        page: questionPage,
                        pageSize: maxPageSize
                      }),
                      undefined,
                      { apiEndpoint: 'questions' }
                    );

                    logOrDebug()(
                      `remaining questions wanted: ${
                        desiredApiGeneratedQuestionsCount - data.questions.length
                      }`
                    );

                    await Promise.all(
                      questions.items.map(async (question, questionIndex) => {
                        const dataQuestionsLength = data!.questions.length;
                        const questionAlreadyCached =
                          data!.cache.complete === false &&
                          data!.questions.find((q) => question.title == q.title);

                        if (questionAlreadyCached) {
                          logOrDebug()(
                            `retrieved question #${
                              dataQuestionsLength + questionIndex + 1
                            } directly from local cache: ${question.title}`
                          );
                        } else if (
                          question.body.length > maxQuestionBodyLength ||
                          question.title.length > maxQuestionTitleLength
                        ) {
                          logOrDebug()(
                            `skipped question #${
                              dataQuestionsLength + questionIndex + 1
                            } for violating length constraints: ${question.title}`
                          );
                        } else {
                          const newQuestionId = new ObjectId();
                          const [questionUpvotes, questionDownvotes] =
                            getUpvotesDownvotesFromScore(question.score);

                          const answerItems: InternalAnswer[] = [];
                          const questionCommentItems: InternalComment[] = [];

                          logOrDebug()(
                            `received question #${
                              dataQuestionsLength + questionIndex + 1
                            } from API: ${question.title}`
                          );

                          await Promise.all([
                            (async () => {
                              for (
                                let answerPage = 1, shouldContinue = true;
                                shouldContinue;
                                ++answerPage
                              ) {
                                const answers = await queue.addRequestToQueue<
                                  StackExchangeApiResponse<StackExchangeAnswer>
                                >(
                                  api.questions.answers({
                                    question_id: question.question_id,
                                    page: answerPage,
                                    pageSize: maxPageSize
                                  }),
                                  undefined,
                                  { apiEndpoint: 'questions.answers' }
                                );

                                const answerItemsLength = answerItems.length;

                                logOrDebug()(
                                  `received ${answers.items.length} of (estimated) ${
                                    question.answer_count
                                  } answers for question #${
                                    dataQuestionsLength + questionIndex + 1
                                  } from API`
                                );

                                await Promise.all(
                                  answers.items.map(async (answer, answerIndex) => {
                                    if (answer.body.length <= maxAnswerLength) {
                                      const newAnswerId = new ObjectId();
                                      const [answerUpvotes, answerDownvotes] =
                                        getUpvotesDownvotesFromScore(answer.score);
                                      const answerCommentItems: InternalComment[] =
                                        [];

                                      for (
                                        let answerCommentPage = 1,
                                          subShouldContinue = true;
                                        subShouldContinue;
                                        ++answerCommentPage
                                      ) {
                                        const comments =
                                          await queue.addRequestToQueue<
                                            StackExchangeApiResponse<StackExchangeComment>
                                          >(
                                            api.answers.comments({
                                              answer_id: answer.answer_id,
                                              page: answerCommentPage,
                                              pageSize: maxPageSize
                                            }),
                                            undefined,
                                            { apiEndpoint: 'answers.comments' }
                                          );

                                        const answerCommentItemsLength =
                                          answerCommentItems.length;

                                        logOrDebug()(
                                          `received ${
                                            comments.items.length
                                          } comments for answer #${
                                            answerItemsLength + answerIndex + 1
                                          } of question #${
                                            dataQuestionsLength + questionIndex + 1
                                          } from API`
                                        );

                                        await Promise.all(
                                          comments.items.map(async (comment) => {
                                            if (
                                              comment.body.length <= maxCommentLength
                                            ) {
                                              const [
                                                commentUpvotes,
                                                commentDownvotes
                                              ] = getUpvotesDownvotesFromScore(
                                                comment.score
                                              );

                                              answerCommentItems.push({
                                                _id: new ObjectId(),
                                                creator: comment.owner.display_name,
                                                createdAt:
                                                  comment.creation_date *
                                                  oneSecondInMs,
                                                text: comment.body,
                                                upvotes: commentUpvotes,
                                                upvoterUsernames: [],
                                                downvotes: commentDownvotes,
                                                downvoterUsernames: []
                                              });

                                              await addOrUpdateUser(
                                                comment.owner.display_name,
                                                { points: comment.owner.reputation }
                                              );
                                            }
                                          })
                                        );

                                        logOrDebug()(
                                          `added ${
                                            answerCommentItems.length -
                                            answerCommentItemsLength
                                          } of ${
                                            comments.items.length
                                          } received comments to answer #${
                                            answerItemsLength + answerIndex + 1
                                          } of question #${
                                            dataQuestionsLength + questionIndex + 1
                                          }`
                                        );

                                        logOrDebug()(
                                          `---\nthere are now ${
                                            answerCommentItems.length
                                          } total comments added to answer #${
                                            answerItemsLength + answerIndex + 1
                                          } of question #${
                                            dataQuestionsLength + questionIndex + 1
                                          }\n---`
                                        );

                                        subShouldContinue = comments.has_more;
                                      }

                                      answerItems.push({
                                        _id: newAnswerId,
                                        creator: answer.owner.display_name,
                                        createdAt:
                                          answer.creation_date * oneSecondInMs,
                                        text: answer.body,
                                        upvotes: answerUpvotes,
                                        upvoterUsernames: [],
                                        downvotes: answerDownvotes,
                                        downvoterUsernames: [],
                                        accepted: answer.is_accepted,
                                        commentItems: answerCommentItems
                                      });

                                      logOrDebug()(
                                        `added answer ${
                                          answerItemsLength + answerIndex + 1
                                        } to question #${
                                          dataQuestionsLength + questionIndex + 1
                                        }`
                                      );

                                      logOrDebug()(
                                        `---\nthere are now ${
                                          answerItems.length
                                        } total answers added to question #${
                                          dataQuestionsLength + questionIndex + 1
                                        }\n---`
                                      );

                                      await addOrUpdateUser(
                                        answer.owner.display_name,
                                        {
                                          points: answer.owner.reputation,
                                          newQuestionId,
                                          newAnswerId
                                        }
                                      );
                                    } else {
                                      logOrDebug()(
                                        `skipped answer #${
                                          answerItemsLength + answerIndex + 1
                                        } of question #${
                                          dataQuestionsLength + questionIndex + 1
                                        } for violating length constraints`
                                      );
                                    }
                                  })
                                );

                                shouldContinue = answers.has_more;
                              }
                            })(),
                            (async () => {
                              for (
                                let commentPage = 1, shouldContinue = true;
                                shouldContinue;
                                ++commentPage
                              ) {
                                const comments = await queue.addRequestToQueue<
                                  StackExchangeApiResponse<StackExchangeComment>
                                >(
                                  api.questions.comments({
                                    question_id: question.question_id,
                                    page: commentPage,
                                    pageSize: maxPageSize
                                  }),
                                  undefined,
                                  { apiEndpoint: 'questions.comments' }
                                );

                                const questionCommentItemsLength =
                                  questionCommentItems.length;

                                logOrDebug()(
                                  `received ${
                                    comments.items.length
                                  } comments for question #${
                                    dataQuestionsLength + questionIndex + 1
                                  } from API`
                                );

                                await Promise.all(
                                  comments.items.map(async (comment) => {
                                    if (comment.body.length <= maxCommentLength) {
                                      const [commentUpvotes, commentDownvotes] =
                                        getUpvotesDownvotesFromScore(comment.score);

                                      questionCommentItems.push({
                                        _id: new ObjectId(),
                                        creator: comment.owner.display_name,
                                        createdAt:
                                          comment.creation_date * oneSecondInMs,
                                        text: comment.body,
                                        upvotes: commentUpvotes,
                                        upvoterUsernames: [],
                                        downvotes: commentDownvotes,
                                        downvoterUsernames: []
                                      });

                                      await addOrUpdateUser(
                                        comment.owner.display_name,
                                        { points: comment.owner.reputation }
                                      );
                                    }
                                  })
                                );

                                logOrDebug()(
                                  `added ${
                                    questionCommentItems.length -
                                    questionCommentItemsLength
                                  } of ${
                                    comments.items.length
                                  } received comments to question #${
                                    dataQuestionsLength + questionIndex + 1
                                  }`
                                );

                                logOrDebug()(
                                  `---\nthere are now ${
                                    questionCommentItems.length
                                  } total comments added to question #${
                                    dataQuestionsLength + questionIndex + 1
                                  }\n---`
                                );

                                shouldContinue = comments.has_more;
                              }
                            })()
                          ]);

                          data!.questions.push({
                            _id: newQuestionId,
                            title: question.title,
                            'title-lowercase': question.title.toLowerCase(),
                            creator: question.owner.display_name,
                            createdAt: question.creation_date * oneSecondInMs,
                            status: 'open',
                            text: question.body,
                            upvotes: questionUpvotes,
                            upvoterUsernames: [],
                            downvotes: questionDownvotes,
                            downvoterUsernames: [],
                            hasAcceptedAnswer: answerItems.some(
                              (answer) => answer.accepted
                            ),
                            views: question.view_count,
                            answers: answerItems.length,
                            answerItems,
                            comments: questionCommentItems.length,
                            commentItems: questionCommentItems,
                            sorter: {
                              uvc:
                                questionUpvotes +
                                question.view_count +
                                questionCommentItems.length,
                              uvac:
                                questionUpvotes +
                                question.view_count +
                                answerItems.length +
                                questionCommentItems.length
                            }
                          });

                          logOrDebug()(
                            `added question #${
                              dataQuestionsLength + questionIndex + 1
                            } to cache`
                          );

                          logOrDebug().extend('cached')(
                            `\n>>> there are now ${
                              data!.questions.length
                            } total of ${desiredApiGeneratedQuestionsCount} wanted questions the cache <<<\n\n`
                          );

                          await addOrUpdateUser(question.owner.display_name, {
                            points: question.owner.reputation,
                            newQuestionId
                          });

                          await cacheDataToDisk(data);
                        }
                      })
                    );

                    if (!questions.has_more) {
                      logOrDebug().warn(
                        'somehow exhausted all questions in the StackExchange API?!'
                      );
                      break;
                    }
                  }
                })(),
                (async () => {
                  const newQuestionId = new ObjectId();
                  let questionCreatedAt = Date.now();
                  const randomAnswers: InternalAnswer[] = [];
                  const randomComments: InternalComment[] = [];
                  const totalDesiredComments =
                    collectAllQuestionCommentsCount +
                    collectAllFirstAnswerCommentsCount;

                  const questionAlreadyCached =
                    data.cache.complete === false && !!data.catchallQuestion;

                  if (questionAlreadyCached) {
                    logOrDebug()(
                      'retrieved catch-all question directly from local cache'
                    );
                  } else {
                    await Promise.all([
                      (async () => {
                        for (
                          let answerPage = 1;
                          randomAnswers.length < collectAllQuestionAnswersCount;
                          ++answerPage
                        ) {
                          const answers = await queue.addRequestToQueue<
                            StackExchangeApiResponse<StackExchangeAnswer>
                          >(
                            api.answers({
                              page: answerPage,
                              pageSize: maxPageSize
                            }),
                            undefined,
                            { apiEndpoint: 'answers' }
                          );

                          const randomAnswersLength = randomAnswers.length;

                          logOrDebug()(
                            `received ${answers.items.length} random answers for catch-all question from API`
                          );

                          await Promise.all(
                            answers.items.map(async (answer) => {
                              if (answer.body.length <= maxAnswerLength) {
                                const createdAt =
                                  answer.creation_date * oneSecondInMs;

                                questionCreatedAt =
                                  createdAt < questionCreatedAt
                                    ? createdAt
                                    : questionCreatedAt;

                                const newAnswerId = new ObjectId();
                                const [answerUpvotes, answerDownvotes] =
                                  getUpvotesDownvotesFromScore(answer.score);

                                randomAnswers.push({
                                  _id: newAnswerId,
                                  creator: answer.owner.display_name,
                                  createdAt,
                                  text: answer.body,
                                  upvotes: answerUpvotes,
                                  upvoterUsernames: [],
                                  downvotes: answerDownvotes,
                                  downvoterUsernames: [],
                                  commentItems: [],
                                  accepted: false
                                });

                                await addOrUpdateUser(answer.owner.display_name, {
                                  points: answer.owner.reputation,
                                  newQuestionId,
                                  newAnswerId
                                });
                              }
                            })
                          );

                          logOrDebug()(
                            `added ${randomAnswers.length - randomAnswersLength} of ${
                              answers.items.length
                            } received answers to catch-all question`
                          );

                          logOrDebug()(
                            `there are now ${randomAnswers.length} total of ${collectAllQuestionAnswersCount} wanted random answers added to catch-all question`
                          );

                          if (!answers.has_more) {
                            logOrDebug().warn(
                              'somehow exhausted all answers in the StackExchange API?!'
                            );
                            break;
                          }
                        }
                      })(),
                      (async () => {
                        for (
                          let commentPage = 1;
                          randomComments.length < totalDesiredComments;
                          ++commentPage
                        ) {
                          const comments = await queue.addRequestToQueue<
                            StackExchangeApiResponse<StackExchangeComment>
                          >(
                            api.comments({
                              page: commentPage,
                              pageSize: maxPageSize
                            }),
                            undefined,
                            { apiEndpoint: 'comments' }
                          );

                          const randomCommentsLength = randomComments.length;

                          logOrDebug()(
                            `received ${comments.items.length} random comments for catch-all question and its first answer from API`
                          );

                          await Promise.all(
                            comments.items.map(async (comment) => {
                              if (comment.body.length <= maxCommentLength) {
                                const createdAt =
                                  comment.creation_date * oneSecondInMs;

                                questionCreatedAt =
                                  createdAt < questionCreatedAt
                                    ? createdAt
                                    : questionCreatedAt;

                                const [commentUpvotes, commentDownvotes] =
                                  getUpvotesDownvotesFromScore(comment.score);

                                randomComments.push({
                                  _id: new ObjectId(),
                                  creator: comment.owner.display_name,
                                  createdAt,
                                  text: comment.body,
                                  upvotes: commentUpvotes,
                                  upvoterUsernames: [],
                                  downvotes: commentDownvotes,
                                  downvoterUsernames: []
                                });

                                await addOrUpdateUser(comment.owner.display_name, {
                                  points: comment.owner.reputation
                                });
                              }
                            })
                          );

                          logOrDebug()(
                            `added ${
                              randomComments.length - randomCommentsLength
                            } of ${
                              comments.items.length
                            } received comments to local storage for catch-all question`
                          );

                          logOrDebug()(
                            `---\nthere are now ${randomComments.length} total of ${totalDesiredComments} wanted random comments stored\n---`
                          );

                          if (!comments.has_more) {
                            logOrDebug().warn(
                              'somehow exhausted all comments in the StackExchange API?!'
                            );
                            break;
                          }
                        }
                      })()
                    ]);

                    // ? Ensure answers and comments are in insertion order (oldest first)
                    randomAnswers.sort((a, b) => a.createdAt - b.createdAt);
                    randomComments.sort((a, b) => a.createdAt - b.createdAt);

                    data.catchallQuestion = {
                      _id: newQuestionId,
                      title:
                        'What are the best answers and comments you can come up with?',
                      'title-lowercase':
                        'what are the best answers and comments you can come up with?',
                      creator: 'Hordak',
                      createdAt: questionCreatedAt - 10 ** 6,
                      status: 'protected',
                      text: '**Hello, world!** What are some of the best random answers, question comments, and answer comments you can come up with? Post below.',
                      upvotes: 15,
                      upvoterUsernames: [],
                      downvotes: 2,
                      downvoterUsernames: [],
                      hasAcceptedAnswer: false,
                      views: 1024,
                      answers: collectAllQuestionAnswersCount,
                      answerItems: randomAnswers.slice(
                        0,
                        collectAllQuestionAnswersCount
                      ),
                      comments: collectAllQuestionCommentsCount,
                      commentItems: randomComments.slice(
                        0,
                        collectAllQuestionCommentsCount
                      ),
                      sorter: {
                        uvc: 15 + 1024 + collectAllQuestionCommentsCount,
                        uvac:
                          15 +
                          1024 +
                          collectAllQuestionAnswersCount +
                          collectAllQuestionCommentsCount
                      }
                    };

                    logOrDebug()(
                      `added ${collectAllQuestionCommentsCount} random comments to catch-all question`
                    );

                    if (randomAnswers[0]) {
                      randomAnswers[0].commentItems = randomComments.slice(
                        collectAllQuestionCommentsCount,
                        totalDesiredComments
                      );

                      logOrDebug()(
                        `added ${
                          totalDesiredComments - collectAllQuestionCommentsCount
                        } random comments to catch-all question's first answer`
                      );
                    } else {
                      logOrDebug().warn('catch-all question has no answers?!');
                    }

                    logOrDebug().extend('cached')(
                      '\n>>> added catch-all question to cache <<<\n\n'
                    );

                    await addOrUpdateUser('Hordak', {
                      points: 1_234_567,
                      newQuestionId
                    });
                  }
                })()
              ]);

              if (data.catchallQuestion) {
                data.questions.push(data.catchallQuestion);
                delete data.catchallQuestion;
              } else {
                throw new GuruMeditationError('missing catchall question');
              }

              // ? Ensure questions are in insertion order (oldest first)
              data.questions.sort((a, b) => a.createdAt - b.createdAt);

              data.cache.complete = true;
            }
          } catch (error) {
            logOrDebug().error(error);

            queue.immediatelyStopProcessingRequestQueue();

            logOrDebug()('interrupted queue stats: %O', queue.getStats());
            logOrDebug()('incomplete cache stats: %O', getDataStats(data));

            await getPrompter(process.env.TEST_PROMPTER_ERRORHANDLER)
              .prompt<{ action: string; token: string }>([
                {
                  name: 'action',
                  message: 'what now?',
                  type: 'list',
                  choices: [
                    {
                      name: 'attempt to continue using a custom token',
                      value: 'hit-custom'
                    },
                    {
                      name: 'commit incomplete cache data to database',
                      value: 'commit'
                    },
                    {
                      name: 'save incomplete cache data to disk and exit',
                      value: 'exit-save'
                    },
                    { name: 'exit without saving any data', value: 'exit' }
                  ]
                },
                {
                  name: 'token',
                  message: 'enter new token',
                  type: 'input',
                  when: (answers) => answers.action.includes('custom')
                }
              ])
              .then(async (answers) => {
                if (answers.action.startsWith('exit')) {
                  if (answers.action == 'exit-save') {
                    await cacheDataToDisk(data);
                  }

                  logOrDebug()('execution interrupted');
                  process.exit(1);
                }

                if (answers.action.startsWith('commit')) {
                  await commitApiDataToDb(data);

                  logOrDebug()('execution interrupted');
                  process.exit(1);
                }

                interrogateApi = answers.action.startsWith('hit');
                usedStackExAuthKey = answers.token ?? usedStackExAuthKey;
                queue.beginProcessingRequestQueue();
              });
          }
        }
      } finally {
        if (queue.isProcessingRequestQueue) {
          queue.gracefullyStopProcessingRequestQueue();
        }

        logOrDebug()('waiting for request queue to terminate...');
        await queue.waitForQueueProcessingToStop();
        logOrDebug()('request queue terminated');
      }

      logOrDebug()('interrogation complete');
      logOrDebug()('final queue stats: %O', queue.getStats());
    }

    if (process.env.TEST_SKIP_REQUESTS) {
      debug.warn(
        'saw debug env var TEST_SKIP_REQUESTS. Post-request tasks will be skipped'
      );
    } else {
      logOrDebug()('final cache stats: %O', getDataStats(data));
      await cacheDataToDisk(data);

      await getPrompter(process.env.TEST_PROMPTER_FINALIZER)
        .prompt<{ action: string; token: string }>([
          {
            name: 'action',
            message: 'what now?',
            type: 'list',
            choices: [
              {
                name: 'commit results to database',
                value: 'commit'
              },
              {
                name: 'commit results to database (include dummy root data)',
                value: 'commit-root'
              },
              { name: 'exit', value: 'exit' }
            ]
          },
          {
            name: 'token',
            message: 'enter new token',
            type: 'input',
            when: (answers) => answers.action.includes('custom')
          }
        ])
        .then(async (answers) => {
          if (!data) {
            throw new GuruMeditationError('data cannot be null');
          }

          if (answers.action == 'exit-save') {
            await cacheDataToDisk(data);
          }

          if (answers.action.startsWith('commit')) {
            if (answers.action == 'commit-root') {
              await commitRootDataToDb(data);
            }

            await commitApiDataToDb(data);
          }
        });
    }

    logOrDebug()('execution complete');
    process.exit(0);
  } catch (error) {
    throw new AppError(`${error}`);
  }
};

export type Data = {
  questions: InternalQuestion[];
  catchallQuestion?: InternalQuestion;
  users: InternalUser[];
  cache: {
    complete: boolean;
  };
};

export default invoked().catch((error: Error) => {
  log.error(error.message);
  process.exit(2);
});
