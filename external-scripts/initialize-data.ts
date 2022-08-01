import { AppError, HttpError, InvalidAppEnvironmentError } from 'named-app-errors';
import jsonFile from 'jsonfile';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';

import { RequestQueue } from 'multiverse/throttled-fetch';
import { debugFactory } from 'multiverse/debug-extended';
import { getDb } from 'multiverse/mongo-schema';

import type { InternalQuestion, InternalUser } from 'universe/backend/db';

const debugNamespace = `${namespace}:initialize-data`;
const cachePath = `${__dirname}/initialize-data-cache.json`;

const log = debugFactory(debugNamespace);
const debug = debugFactory(`${debugNamespace}:debug`);

/**
 * Represents one second in milliseconds.
 */
const oneSecondInMs = 1000;

// eslint-disable-next-line no-console
log.log = console.info.bind(console);

// ? Ensure this next line survives Webpack
if (!globalThis.process.env.DEBUG && getEnv().NODE_ENV != 'test') {
  debugFactory.enable(
    `${debugNamespace},${debugNamespace}:*,-${debugNamespace}:debug`
  );
}

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
      MAX_ANSWER_BODY_LENGTH_BYTES: maxAnswerLen,
      MAX_COMMENT_LENGTH: maxCommentLen,
      MAX_QUESTION_BODY_LENGTH_BYTES: maxQuestionLen,
      STACKAPPS_AUTH_KEY: stackExAuthKey
    } = getEnv();

    if (!maxAnswerLen || !(Number(maxAnswerLen) > 0)) {
      throw new InvalidAppEnvironmentError(
        'MAX_ANSWER_BODY_LENGTH_BYTES must be greater than zero'
      );
    }

    if (!maxCommentLen || !(Number(maxCommentLen) > 0)) {
      throw new InvalidAppEnvironmentError(
        'MAX_COMMENT_LENGTH must be greater than zero'
      );
    }

    if (!maxQuestionLen || !(Number(maxQuestionLen) > 0)) {
      throw new InvalidAppEnvironmentError(
        'MAX_QUESTION_BODY_LENGTH_BYTES must be greater than zero'
      );
    }

    if (!stackExAuthKey) {
      throw new InvalidAppEnvironmentError('STACKAPPS_AUTH_KEY must be provided');
    }

    let data: {
      questions: InternalQuestion[];
      users: InternalUser[];
    } | null = await (async () => {
      try {
        debug(`reading in results from cache at ${cachePath}`);
        return await jsonFile.readFile(cachePath);
      } catch {
        return null;
      }
    })();

    debug(`found cached results: ${data ? 'yes' : 'no'}`);

    if (!data) {
      data = {
        questions: [],
        users: []
      };

      // * max 30req/1000ms https://api.stackexchange.com/docs/throttle
      const queue = new RequestQueue({
        intervalPeriodMs: 1000,
        maxRequestsPerInterval: 25,
        responseInspector: async (res, q, wasARetry, requestInfo, requestInit) => {
          const json = await res.json();

          if (json.backoff) {
            debug.warn(
              `saw backoff demand in response, delaying for ${json.backoff}s`
            );
            q.requestDelayMs = Number.parseInt(json.backoff) * oneSecondInMs;
          }

          if (json.error_message) {
            throw new HttpError(res, json.error_message);
          } else if (res.ok) {
            return json;
          } else {
            if (wasARetry || res.status < 500) {
              wasARetry && debug.warn('a retried request failed');
              throw new HttpError(res);
            } else {
              if (json.backoff) {
                debug('request will be retried after delay');
              } else {
                if (res.status == 502) {
                  debug.warn(
                    "seems we've been rate limited, delaying for 120 seconds"
                  );
                  // ? Seems like we've been rate limited, wait for 2 minutes
                  q.requestDelayMs = 120 * oneSecondInMs;
                } else {
                  debug.warn('a server error occurred, retrying in 2 seconds');
                  // ? A server error happened, chill for a sec then try again
                  q.requestDelayMs = 2 * oneSecondInMs;
                }
              }

              // ? Retry the request and throw on failure or return the data
              return q.addRequestToQueue(requestInfo, requestInit, true);
            }
          }
        }
      });

      queue.beginProcessingRequestQueue();

      // TODO: get questions with the most votes (skip questions with text > 3000 characters)
      //    TODO: create a new "collect all" question
      // TODO: get comments from questions on both pages (skip comments with text > 150 characters)
      // TODO: get answers from questions on both pages (skip answers with text > 3000 characters)
      // TODO: get comments from answers on both pages (skip comments with text > 150 characters)
      // TODO: get 150 answers and 400 comments and add them (150a/250c) to the "collect all" question; add the remaining (150c) comments to the first answer
      // TODO: add comments to answer objects; add comments and answer objects to question objects
      // TODO: parlay each username into a user

      queue.gracefullyStopProcessingRequestQueue();

      // TODO: add other dummy data, including auth keys and the like

      // TODO: cache (commit to disk) crunched results
    }

    // TODO: report stats (skipped and total questions, answers, comments, total byte sizes), user chooses: re-crunch data, commit data, or to quit

    const db = await getDb({ name: 'root' });

    // TODO: add questions and users to database

    await Promise.all([
      db.collection<InternalUser>('users').insertMany(data.users),
      db.collection<InternalQuestion>('questions').insertMany(data.questions)
    ]);

    log('execution complete');
    process.exit(0);
  } catch (e) {
    throw new AppError(`${e}`);
  }
};

export default invoked().catch((e: Error) => {
  log.error(e.message);
  process.exit(2);
});
