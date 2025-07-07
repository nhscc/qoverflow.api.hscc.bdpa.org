/* eslint-disable unicorn/no-array-callback-reference */
import createDebugLogger from 'debug';
import { ObjectId } from 'mongodb';
import { toss } from 'toss-expression';

import { toPublicUser } from 'universe/backend/db';
import { getEnv } from 'universe/backend/env';
import { SanityError } from 'universe/error';

import { dummyAppData } from 'testverse/db';

import { name as packageName } from 'package';

import type { Promisable } from 'type-fest';
import type { NewUser, PatchUser, PublicUser } from 'universe/backend/db';
import type { NextApiHandlerMixin } from 'testverse/fixtures';

// TODO: XXX: turn a lot of this into some kind of package; needs to be generic
// TODO: XXX: enough to handle various use cases though :) Maybe
// TODO: XXX: @xunnamius/fable for the generic version, along with
// TODO: XXX: @xunnamius/fable-next, @xunnamius/fable-next-api (below),
// TODO: XXX: @xunnamius/fable-X plugins. Initial version of @xunnamius/fable
// TODO: XXX: would just be the next API version.

// TODO: XXX: add an `id` param that allows getResultAt using that `id` (along
// TODO: XXX:  with index)

// TODO: XXX: document functionality: RUN_ONLY='#, ##,###,...'
// TODO: XXX: "fail fast" should be optional

const debug = createDebugLogger(`${packageName}:integration-fixtures`);

/**
 * A single test result stored in `memory`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TestResult<T = any> = {
  status: number;
  json: T | undefined;
};

/**
 * Stored results from past fixtures runs made available for future fixtures
 * runs via `memory`.
 */
export type TestResultset = TestResult[] & {
  /**
   * A property containing a mapping between optional test ids and their
   * results.
   */
  idMap: Record<string, TestResult>;
  /**
   * A property containing the most previous resultset.
   */
  latest: TestResult;
  /**
   * Get the HTTP response status and json result from previously run tests by
   * index. You can pass a negative index to begin counting backwards from the
   * current test. Tests are zero-indexed, i.e. use `getResultAt(0)` to refer to
   * the very first resultset. `getResultAt(1)` will return the second
   * resultset. `getResultAt(-1)` will return the immediately previous resultset
   * (same as what the `latest` property returns).
   *
   * @param index Specify a previous test result index starting at 1 (not zero!)
   */
  getResultAt<T = unknown>(this: void, index: number): TestResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getResultAt<T = unknown>(this: void, index: number, property: string): T;
  getResultAt<T = unknown>(this: void, index: string): TestResult<T>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getResultAt<T = unknown>(this: void, index: string, property: string): T;
};

/**
 * Represents a test that executes an HTTP request and evaluate the response
 * for correctness.
 */
export type TestFixture = {
  /**
   * An optional id that can be used to reference the result from this fixture
   * directly as opposed to by index.
   *
   * @example getResultAt('my-id') === getResultAt(22)
   */
  id?: string;
  /**
   * If `invisible === true`, the test is not counted when generating positional
   * fixtures.
   *
   * @default false
   */
  invisible?: boolean;
  /**
   * The test index X (as in "#X") that is reported to the user when a test
   * fails.
   */
  displayIndex: number;
  /**
   * A very brief couple of words added to the end of the test title.
   */
  subject?: string;
  /**
   * The handler under test.
   */
  pagesHandler?: NextApiHandlerMixin;
  /**
   * The method of the mock request.
   */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /**
   * Represents mock "processed" dynamic route components and query params.
   */
  params?:
    | Record<string, string | string[]>
    | ((
        previousResults: TestResultset
      ) => Promisable<Record<string, string | string[]>>);
  /**
   * The body of the mock request. Automatically stringified.
   */
  body?:
    | Record<string, unknown>
    | ((previousResults: TestResultset) => Promisable<Record<string, unknown>>);
  /**
   * The expected shape of the HTTP response.
   */
  response?: {
    /**
     * The expected response status. If status !== 200, we expect `json.success`
     * to be `false`. Otherwise, we expect it to be `true`. All status-related
     * checks are skipped if a callback is provided that returns `undefined`.
     */
    status?:
      | number
      | ((
          status: number,
          previousResults: TestResultset
        ) => Promisable<number | undefined>);
    /**
     * The expected JSON response body. No need to test for `success` as that is
     * handled automatically (unless a status callback was used and it returned
     * `undefined`). Jest async matchers are also supported. All json-related
     * checks are skipped if a callback is provided that returns `undefined` or
     * `json` itself is `undefined`.
     */
    json?:
      | Record<string, unknown>
      | jest.AsymmetricMatcher
      | ((
          json: Record<string, unknown> | undefined,
          previousResults: TestResultset
        ) => Promisable<Record<string, unknown> | jest.AsymmetricMatcher | undefined>);
  };
};

export function getFixtures(
  api: typeof import('testverse/fixtures').api
): TestFixture[] {
  const runOnly = process.env.RUN_ONLY?.split(',')
    .flatMap((n) => {
      const range = n
        .split('-')
        .map((m) => Number.parseInt(m))
        .filter((m) => !Number.isNaN(m));

      const min = Math.min(...range);
      const max = Math.max(...range);

      debug('min: %O', min);
      debug('max: %O', max);
      debug('range: %O', range);

      if (!(0 < min && min <= max && max < Infinity)) {
        throw new SanityError(`invalid RUN_ONLY range "${min}-${max}"`);
      } else {
        const finalRange = Array.from({ length: max - min + 1 }).map(
          (_, ndx) => min + ndx
        );
        debug('final range: %O', finalRange);
        return finalRange;
      }
    })
    .sort((a, b) => a - b);

  // * Note: user passwords are their usernames
  const fixtures: Omit<TestFixture, 'displayIndex'>[] = [
    // * Creating, retrieving, authenticating, and updating users
    {
      id: 'user-hillary',
      subject: 'create new user "the-hill"',
      pagesHandler: api.v1.users,
      method: 'POST',
      body: {
        username: 'the-hill',
        email: 'h@hillaryclinton.com',
        key: '3ffd270e595ef1e485437d90e788d2965acb602a7412f50760140304f4b1f039998ee471de8ddb7c3115f3dee86ba487a213be9604db0ef23ccb99414e47d452',
        salt: 'd63a897a76ece8b9a503913db68c95af'
      } as NewUser,
      response: {
        status: 200,
        json: {
          user: {
            user_id: expect.any(String),
            username: 'the-hill',
            email: 'h@hillaryclinton.com',
            salt: 'd63a897a76ece8b9a503913db68c95af',
            questions: 0,
            answers: 0,
            points: 1
          } as PublicUser
        }
      }
    },
    {
      subject: 'verify user the-hill can be fetched',
      pagesHandler: api.v1.usersUsername,
      params: { username: 'the-hill' },
      method: 'GET',
      response: {
        status: 200,
        json: (_json, { getResultAt }) => {
          return { user: getResultAt('user-hillary', 'user') };
        }
      }
    },
    {
      subject: 'verify the-hill appears in LIFO list of all users',
      pagesHandler: api.v1.users,
      method: 'GET',
      response: {
        status: 200,
        json: (_json, { getResultAt }) => {
          return {
            users: [
              getResultAt('user-hillary', 'user'),
              ...dummyAppData.users.slice().reverse().map(toPublicUser)
            ]
          };
        }
      }
    },
    {
      subject: 'update the-hill',
      pagesHandler: api.v1.usersUsername,
      method: 'PATCH',
      params: { username: 'the-hill' },
      body: {
        salt: '2a9e8128c6641c2fe7642abd14b09e14',
        key: '8df1042284e5cc64ff722e473bba9deebb7ef06927c96a004faa1f4dc60f3b1c01fc42612f495cd91ac7041060860b4626e6a5af04b6e31104e6f896b4e3d153',
        points: 1000
      } as PatchUser,
      response: { status: 200 }
    },
    {
      id: 'updated-user-hillary',
      subject: 'verify the-hill was updated',
      pagesHandler: api.v1.usersUsername,
      params: { username: 'the-hill' },
      method: 'GET',
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: 1000 }) }
      }
    },
    {
      subject: 'authenticate the-hill',
      pagesHandler: api.v1.usersUsernameAuth,
      method: 'POST',
      params: { username: 'the-hill' },
      body: {
        key: '8df1042284e5cc64ff722e473bba9deebb7ef06927c96a004faa1f4dc60f3b1c01fc42612f495cd91ac7041060860b4626e6a5af04b6e31104e6f896b4e3d153'
      },
      response: { status: 200 }
    },
    {
      subject: 'authenticate the-hill case-insensitively',
      pagesHandler: api.v1.usersUsernameAuth,
      method: 'POST',
      params: { username: 'the-hill' },
      body: {
        key: '8DF1042284E5CC64FF722E473BBA9DEEBB7EF06927C96A004FAA1F4DC60F3B1C01FC42612F495CD91AC7041060860B4626E6A5AF04B6E31104E6F896B4E3D153'
      },
      response: { status: 200 }
    },
    {
      subject: 'attempt to authenticate the-hill with bad key',
      pagesHandler: api.v1.usersUsernameAuth,
      method: 'POST',
      params: { username: 'the-hill' },
      body: { key: 'x' },
      response: { status: 403 }
    },
    {
      subject: 'attempt to delete a non-existent user',
      pagesHandler: api.v1.usersUsername,
      method: 'DELETE',
      params: { username: 'does-not-exist' },
      response: { status: 404 }
    },
    { // * 10
      subject: `delete ${dummyAppData.users[0]!.username}`,
      pagesHandler: api.v1.usersUsername,
      method: 'DELETE',
      params: { username: dummyAppData.users[0]!.username },
      response: { status: 200 }
    },
    {
      subject: `verify ${dummyAppData.users[0]!.username} is not present in LIFO list of all users`,
      pagesHandler: api.v1.users,
      method: 'GET',
      response: {
        status: 200,
        json: (_json, { getResultAt }) => {
          return {
            users: [
              getResultAt<PublicUser>('updated-user-hillary', 'user'),
              ...dummyAppData.users.slice(1).reverse().map(toPublicUser)
            ]
          };
        }
      }
    },
    {
      subject: `verify ${dummyAppData.users[0]!.username} cannot be fetched`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[0]!.username },
      method: 'GET',
      response: { status: 404 }
    },
    {
      id: 'user-obama',
      subject: 'create new user "baracko"',
      pagesHandler: api.v1.users,
      method: 'POST',
      body: {
        username: 'baracko',
        email: 'o@barackobama.com',
        key: 'ac4ab7f9f19fb198a0e1ec3c3970d8b8a2a47e19127a988c02299807210927dfb915d66af69f4a8b53c7610b31604eed6ebe0273a9dc73831892a86250082ebf',
        salt: 'e1a3593dbf0ff964292398251f3b47ad'
      } as NewUser,
      response: {
        status: 200,
        json: {
          user: {
            user_id: expect.any(String),
            username: 'baracko',
            email: 'o@barackobama.com',
            salt: 'e1a3593dbf0ff964292398251f3b47ad',
            questions: 0,
            answers: 0,
            points: 1
          } as PublicUser
        }
      }
    },
    {
      subject: 'attempt to create another user named "baracko"',
      pagesHandler: api.v1.users,
      method: 'POST',
      body: {
        username: 'baracko',
        email: 'xyz@abc.def',
        key: 'ac4ab7f9f19fb198a0e1ec3c3970d8b8a2a47e19127a988c02299807210927dfb915d66af69f4a8b53c7610b31604eed6ebe0273a9dc73831892a86250082ebf',
        salt: 'e1a3593dbf0ff964292398251f3b47ad'
      } as NewUser,
      response: { status: 400 }
    },
    {
      subject: 'attempt to create a user with a duplicate email',
      pagesHandler: api.v1.users,
      method: 'POST',
      body: {
        username: 'xyz-abc',
        email: 'o@barackobama.com',
        key: 'ac4ab7f9f19fb198a0e1ec3c3970d8b8a2a47e19127a988c02299807210927dfb915d66af69f4a8b53c7610b31604eed6ebe0273a9dc73831892a86250082ebf',
        salt: 'e1a3593dbf0ff964292398251f3b47ad'
      } as NewUser,
      response: { status: 400 }
    },
    {
      subject: 'verify baracko can be fetched',
      pagesHandler: api.v1.usersUsername,
      params: { username: 'baracko' },
      method: 'GET',
      response: {
        status: 200,
        json: (_json, { getResultAt }) => {
          return { user: getResultAt('user-obama', 'user') };
        }
      }
    },
    {
      subject: 'verify baracko appears in LIFO list of all users',
      pagesHandler: api.v1.users,
      method: 'GET',
      response: {
        status: 200,
        json: (_json, { getResultAt }) => {
          return {
            users: [
              getResultAt('user-obama', 'user'),
              getResultAt<PublicUser>('updated-user-hillary', 'user'),
              ...dummyAppData.users.slice(1).reverse().map(toPublicUser)
            ]
          };
        }
      }
    },
    {
      subject: 'attempt to update baracko with bad salt',
      pagesHandler: api.v1.usersUsername,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        salt: '2',
        key: 'ac4ab7f9f19fb198a0e1ec3c3970d8b8a2a47e19127a988c02299807210927dfb915d66af69f4a8b53c7610b31604eed6ebe0273a9dc73831892a86250082ebf'
      } as PatchUser,
      response: { status: 400 }
    },
    {
      subject: 'attempt to update baracko with bad key',
      pagesHandler: api.v1.usersUsername,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        salt: '2a9e8128c6641c2fe7642abd14b09e14',
        key: 'a'
      } as PatchUser,
      response: { status: 400 }
    },
    { // * 20
      subject: 'attempt to update baracko with no key',
      pagesHandler: api.v1.usersUsername,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        salt: '2a9e8128c6641c2fe7642abd14b09e14',
        key: undefined
      } as PatchUser,
      response: { status: 400 }
    },
    {
      id: 'updated-user-obama',
      subject: 'verify baracko was updated',
      pagesHandler: api.v1.usersUsername,
      params: { username: 'baracko' },
      method: 'GET',
      response: { status: 200 }
    },
    {
      subject: 'authenticate baracko',
      pagesHandler: api.v1.usersUsernameAuth,
      method: 'POST',
      params: { username: 'baracko' },
      body: {
        key: 'ac4ab7f9f19fb198a0e1ec3c3970d8b8a2a47e19127a988c02299807210927dfb915d66af69f4a8b53c7610b31604eed6ebe0273a9dc73831892a86250082ebf'
      },
      response: { status: 200 }
    },
    {
      subject: 'attempt to authenticate baracko with no key',
      pagesHandler: api.v1.usersUsernameAuth,
      method: 'POST',
      params: { username: 'baracko' },
      body: { key: undefined },
      response: { status: 403 }
    },
    {
      subject: 'attempt to fetch all users in LIFO order using bad after_id',
      pagesHandler: api.v1.users,
      method: 'GET',
      params: { after: 'bad-id' },
      response: { status: 400 }
    },
    {// * 25
      subject: 'attempt to fetch all users in LIFO order using non-existent after_id',
      pagesHandler: api.v1.users,
      method: 'GET',
      params: { after: new ObjectId().toString() },
      response: { status: 404 }
    },
    {
      subject: `attempt to update deleted ${dummyAppData.users[0]!.username}`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[0]!.username },
      method: 'PATCH',
      body: { email: 'some@new.email' },
      response: { status: 404 }
    },
    {
      subject: `attempt to update ${dummyAppData.users[2]!.username} using a bad email`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[2]!.username },
      method: 'PATCH',
      body: { email: 'bad email address' },
      response: { status: 400 }
    },
    {
      subject: `attempt to update ${dummyAppData.users[2]!.username} using a too-long email`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[2]!.username },
      method: 'PATCH',
      body: { email: 'x'.repeat(getEnv().MAX_USER_EMAIL_LENGTH) + '@aol.com' },
      response: { status: 400 }
    },
    {
      subject: `attempt to update ${dummyAppData.users[2]!.username} using a short non-hex salt`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[2]!.username },
      method: 'PATCH',
      body: { salt: 'xyz' },
      response: { status: 400 }
    },
    { // * 30
      subject: `attempt to update ${dummyAppData.users[2]!.username} using a short non-hex key`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[2]!.username },
      method: 'PATCH',
      body: { key: 'xyz' },
      response: { status: 400 }
    },
    {
      subject: `"update" ${dummyAppData.users[2]!.username} with a no-op`,
      pagesHandler: api.v1.usersUsername,
      params: { username: dummyAppData.users[2]!.username },
      method: 'PATCH',
      body: {},
      response: { status: 200 }
    },
    {
      subject: 'fetch all users in LIFO order using pagination',
      pagesHandler: api.v1.users,
      method: 'GET',
      params: ({ getResultAt }) => {
        return { after: getResultAt<string>('updated-user-hillary', 'user.user_id') };
      },
      response: {
        status: 200,
        json: { users: dummyAppData.users.slice(1).reverse().map(toPublicUser) }
      }
    },
    {
      subject: "fetch all of baracko's answers",
      pagesHandler: api.v1.usersUsernameAnswers,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { answers: [] }
      }
    },
    {
      subject: "fetch all of baracko's questions",
      pagesHandler: api.v1.usersUsernameQuestions,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { questions: [] }
      }
    },

    // * Incrementing/updating user points
    {
      subject: "increment baracko's points",
      pagesHandler: api.v1.usersUsernamePoints,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        operation: 'increment',
        amount: 1000
      },
      response: { status: 200 }
    },
    {
      subject: "verify baracko's points #1",
      pagesHandler: api.v1.usersUsername,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: 1001 }) }
      }
    },
    {
      subject: "increment baracko's points again",
      pagesHandler: api.v1.usersUsernamePoints,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        operation: 'increment',
        amount: 1000
      },
      response: { status: 200 }
    },
    {
      subject: "verify baracko's points #2",
      pagesHandler: api.v1.usersUsername,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: 2001 }) }
      }
    },
    {
      subject: "decrement baracko's points",
      pagesHandler: api.v1.usersUsernamePoints,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        operation: 'decrement',
        amount: 100
      },
      response: { status: 200 }
    },
    {
      subject: "verify baracko's points #3",
      pagesHandler: api.v1.usersUsername,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: 1901 }) }
      }
    },
    {
      subject: "decrement baracko's points greatly",
      pagesHandler: api.v1.usersUsernamePoints,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        operation: 'decrement',
        amount: 10_000
      },
      response: { status: 200 }
    },
    {
      subject: "verify baracko's points #4",
      pagesHandler: api.v1.usersUsername,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: -8099 }) }
      }
    },
    {
      subject: "set baracko's points",
      pagesHandler: api.v1.usersUsername,
      method: 'PATCH',
      params: { username: 'baracko' },
      body: {
        points: 0
      },
      response: { status: 200 }
    },
    {
      subject: "verify baracko's points #5",
      pagesHandler: api.v1.usersUsername,
      method: 'GET',
      params: { username: 'baracko' },
      response: {
        status: 200,
        json: { user: expect.objectContaining({ points: 0 }) }
      }
    },

    // * Creating new questions, answers, and comments
    {
      subject: 'create question as baracko'
    },
    {
      subject: "verify new question is in baracko's questions"
    },
    {
      subject: 'create answer to own question as baracko'
    },
    {
      subject: "verify new answer is in baracko's answers"
    },
    {
      subject: "verify new answer is in question's answers"
    },
    {
      subject: 'create comment to own question as baracko'
    },
    {
      subject: "verify new comment is in question's comments"
    },
    {
      subject: 'create comment to own answer as baracko'
    },
    {
      subject: 'create second comment to own answer as baracko'
    },
    {
      subject: "verify new comments are in answer's comments"
    },

    // * Voting on own questions, answers, and comments
    {
      subject: 'attempt to upvote new question as baracko'
    },
    {
      subject: 'attempt to upvote new answer as baracko'
    },
    {
      subject: 'attempt to downvote new question as baracko'
    },
    {
      subject: 'attempt to downvote new answer as baracko'
    },
    {
      subject: 'attempt to upvote new question comment as baracko'
    },
    {
      subject: 'attempt to upvote new answer comment as baracko'
    },
    {
      subject: 'attempt to downvote new question comment as baracko'
    },
    {
      subject: 'attempt to downvote new answer comment as baracko'
    },

    // * Deleting comments
    {
      subject: 'delete new question comment'
    },
    {
      subject: "verify new question's comments no longer include deleted comment"
    },
    {
      subject: 'delete new answer comment'
    },
    {
      subject: "verify new answer's comments no longer include deleted comment"
    },
    {
      subject: 'attempt to delete already-deleted comment'
    },

    // * Upvoting/downvoting on questions
    {
      subject: "upvote baracko's question as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question #1"
    },
    {
      subject: "verify the-hill's vote on baracko's question #1"
    },
    {
      subject: "attempt to upvote baracko's question as the-hill again"
    },
    {
      subject: "attempt to downvote baracko's question as the-hill"
    },
    {
      subject: "undo upvote on baracko's question as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question #2"
    },
    {
      subject: "verify the-hill's vote on baracko's question #2"
    },
    {
      subject: "attempt to undo upvote on baracko's question as the-hill again"
    },
    {
      subject: "downvote baracko's question as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question #3"
    },
    {
      subject: "verify the-hill's vote on baracko's question #3"
    },
    {
      subject: "attempt to downvote baracko's question as the-hill again"
    },
    {
      subject: "attempt to upvote baracko's question as the-hill"
    },
    {
      subject: "undo downvote on baracko's question as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question #4"
    },
    {
      subject: "verify the-hill's vote on baracko's question #4"
    },
    {
      subject: "attempt to undo downvote on baracko's question as the-hill again"
    },
    {
      subject: "re-upvote baracko's question as the-hill"
    },

    // * Upvoting/downvoting on answers
    {
      subject: "upvote baracko's answer as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer #1"
    },
    {
      subject: "verify the-hill's vote on baracko's answer #1"
    },
    {
      subject: "attempt to upvote baracko's answer as the-hill again"
    },
    {
      subject: "attempt to downvote baracko's answer as the-hill"
    },
    {
      subject: "undo upvote on baracko's answer as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer #2"
    },
    {
      subject: "verify the-hill's vote on baracko's answer #2"
    },
    {
      subject: "attempt to undo upvote on baracko's answer as the-hill again"
    },
    {
      subject: "downvote baracko's answer as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer #3"
    },
    {
      subject: "verify the-hill's vote on baracko's answer #3"
    },
    {
      subject: "attempt to downvote baracko's answer as the-hill again"
    },
    {
      subject: "attempt to upvote baracko's answer as the-hill"
    },
    {
      subject: "undo downvote on baracko's answer as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer #4"
    },
    {
      subject: "verify the-hill's vote on baracko's answer #4"
    },
    {
      subject: "attempt to undo downvote on baracko's answer as the-hill again"
    },
    {
      subject: "re-upvote baracko's answer as the-hill"
    },

    // * Upvoting/downvoting on question comments
    {
      subject: "upvote baracko's question comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question comment #1"
    },
    {
      subject: "verify the-hill's vote on baracko's question comment #1"
    },
    {
      subject: "attempt to upvote baracko's question comment as the-hill again"
    },
    {
      subject: "attempt to downvote baracko's question comment as the-hill"
    },
    {
      subject: "undo upvote on baracko's question comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question comment #2"
    },
    {
      subject: "verify the-hill's vote on baracko's question comment #2"
    },
    {
      subject: "attempt to undo upvote on baracko's question comment as the-hill again"
    },
    {
      subject: "downvote baracko's question comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question comment #3"
    },
    {
      subject: "verify the-hill's vote on baracko's question comment #3"
    },
    {
      subject: "attempt to downvote baracko's question comment as the-hill again"
    },
    {
      subject: "attempt to upvote baracko's question comment as the-hill"
    },
    {
      subject: "undo downvote on baracko's question comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's question comment #4"
    },
    {
      subject: "verify the-hill's vote on baracko's question comment #4"
    },
    {
      subject: "attempt to undo downvote on baracko's question comment as the-hill again"
    },
    {
      subject: "re-upvote baracko's question comment as the-hill"
    },

    // * Upvoting/downvoting on answer comments
    {
      subject: "upvote baracko's answer comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer comment #1"
    },
    {
      subject: "verify the-hill's vote on baracko's answer comment #1"
    },
    {
      subject: "attempt to upvote baracko's answer comment as the-hill again"
    },
    {
      subject: "attempt to downvote baracko's answer comment as the-hill"
    },
    {
      subject: "undo upvote on baracko's answer comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer comment #2"
    },
    {
      subject: "verify the-hill's vote on baracko's answer comment #2"
    },
    {
      subject: "attempt to undo upvote on baracko's answer comment as the-hill again"
    },
    {
      subject: "downvote baracko's answer comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer comment #3"
    },
    {
      subject: "verify the-hill's vote on baracko's answer comment #3"
    },
    {
      subject: "attempt to downvote baracko's answer comment as the-hill again"
    },
    {
      subject: "attempt to upvote baracko's answer comment as the-hill"
    },
    {
      subject: "undo downvote on baracko's answer comment as the-hill"
    },
    {
      subject: "verify the metadata of baracko's answer comment #4"
    },
    {
      subject: "verify the-hill's vote on baracko's answer comment #4"
    },
    {
      subject: "attempt to undo downvote on baracko's answer comment as the-hill again"
    },
    {
      subject: "re-upvote baracko's answer comment as the-hill"
    },

    // * Answer duplication
    {
      subject: "create answer to baracko's question as the-hill"
    },
    {
      subject: 'attempt to upvote new answer as the-hill'
    },
    {
      subject: 'upvote new answer as baracko'
    },
    {
      subject: "verify new answer is in baracko's question's answers"
    },
    {
      subject: "attempt to create another answer to baracko's question as the-hill"
    },

    // * View manipulation
    {
      subject: "increment the views of baracko's question"
    },
    {
      subject: "verify baracko's question has 1 views"
    },
    {
      subject: "set views of baracko's question to 0"
    },
    {
      subject: "verify baracko's question has 0 views"
    },

    // * Searching
    {
      subject: 'verify parameter-less search returns latest questions in LIFO order'
    },
    {
      subject: 'search for questions sorted by the highest upvotes'
    },
    {
      subject: 'search for unanswered questions sorted by uvc'
    },
    {
      subject: 'search for questions without an accepted answer sorted by uvac'
    },
    {
      subject: 'search for questions matching a title case-insensitively'
    },
    {
      subject: 'search for questions regex-matching a text fragment case-insensitively'
    },
    {
      subject: 'search for questions matching a specific creator'
    },
    {
      subject: 'search for questions created after a specific point in time'
    },
    {
      subject: 'search for questions created between two specific points in time'
    },
    {
      subject:
        'search for questions that regex-match, match, and complex match simultaneously'
      // TODO: search for questions that regex-match a text and a title
      // TODO: fragment, match a specific creator, and were created between two
      // TODO: specific points in time
    },
    {
      subject:
        'verify "after" parameter returns expected questions given previous result'
      // TODO: search for questions that regex-match a text and a title
      // TODO: fragment, match a specific creator, and were created between two
      // TODO: specific points in time
    },

    // * Limits and checks
    {
      subject: 'attempt to create a question with an empty title'
    },
    {
      subject: 'attempt to create a question with a title that is too large'
    },
    {
      subject: 'attempt to create a question with an empty body'
    },
    {
      subject: 'attempt to create a question with a body that is too large'
    },
    {
      subject: 'attempt to create an answer with an empty body'
    },
    {
      subject: 'attempt to create an answer with a body that is too large'
    },
    {
      subject: 'attempt to create an empty comment on a question'
    },
    {
      subject: 'attempt to create a comment on a question that is too large'
    },
    {
      subject: 'attempt to create an empty comment on an answer'
    },
    {
      subject: 'attempt to create a comment on an answer that is too large'
    },
    {
      subject: 'attempt to create a message with an empty body'
    },
    {
      subject: 'attempt to create a message with a body that is too large'
    },
    {
      subject: 'attempt to create a message with an empty subject'
    },
    {
      subject: 'attempt to create a message with a subject that is too large'
    },
    {
      subject: 'attempt to create a message with a non-existent sender'
    },
    {
      subject: 'attempt to create a message with a non-existent receiver'
    },

    // * Accepting an answer
    {
      subject: "verify baracko's question does not have an accepted answer"
    },
    {
      subject: "accept an answer on baracko's question"
    },
    {
      subject: "verify baracko's question has an accepted answer"
    },
    {
      subject: "verify accepted answer's metadata"
    },
    {
      subject: "attempt to accept another answer on baracko's question"
    },

    // * Update question status
    {
      subject: `set baracko's question's status to "protected"`
    },
    {
      subject: `verify baracko's question is protected`
    },

    // * Transacting mail
    {
      subject: 'verify the-hill has an empty mailbox'
    },
    {
      subject: 'send a message from baracko to the-hill'
    },
    {
      subject: 'send another message from baracko to the-hill'
    },
    {
      subject: 'send a message from the-hill to baracko'
    },
    {
      subject: 'verify baracko sees expected messages in LIFO order'
    },
    {
      subject: 'verify the-hill sees expected messages in LIFO order'
    },

    // * Updating question and answer title/body
    {
      subject: "update baracko's question's title and body"
    },
    {
      subject: "verify baracko's question's has updated title and body"
    },
    {
      subject: "update baracko's answer's body"
    },
    {
      subject: "verify baracko's answer's has updated body"
    }
  ];

  // TODO: XXX: ability to specify "depends" via index or name/id, and then
  // TODO: XXX: always enable tests in RUN_ONLY that are depended upon

  const willSkipFixture = (fixture: (typeof fixtures)[number]) => {
    const shouldSkip =
      !fixture.subject ||
      !fixture.pagesHandler ||
      !fixture.method ||
      (!fixture.invisible &&
        (!fixture.response ||
          !['number', 'function'].includes(typeof fixture.response.status)));

    return shouldSkip;
  };

  const filteredFixtures = fixtures.filter<TestFixture>(
    (fixture, ndx): fixture is TestFixture => {
      const displayIndex = ndx + 1;

      if (runOnly && !runOnly.includes(displayIndex)) {
        return false;
      }

      (fixture as TestFixture).displayIndex = !runOnly
        ? displayIndex
        : (runOnly.shift() ??
          toss(new SanityError('ran out of RUN_ONLY indices')));

      return true;
    }
  );

  // TODO: XXX: add ability to capture/suppress output via fixture option (even better: selectively use mock plugins like withMockEnv and withMockOutput via config options)

  // TODO: XXX: with @xunnamius/fable, have an "every X" type construct (the below is "every reqPerContrived")
  // TODO: XXX: also allow middleware
  // TODO: XXX: also custom props for fixtures

  const reqPerContrived = getEnv().REQUESTS_PER_CONTRIVED_ERROR;

  if (reqPerContrived) {
    for (let index = 0, noSkipCount = 0; index < filteredFixtures.length; index++) {
      if (
        !willSkipFixture(filteredFixtures[index]!) &&
        noSkipCount++ % reqPerContrived === 0
      ) {
        filteredFixtures.splice(index, 0, {
          displayIndex: -1,
          subject: 'handle contrived',
          pagesHandler: api.v1.users,
          method: 'POST',
          body: {},
          response: {
            status: 555,
            json: { error: expect.stringContaining('contrived') }
          }
        });
      }
    }
  }

  return filteredFixtures;
}
