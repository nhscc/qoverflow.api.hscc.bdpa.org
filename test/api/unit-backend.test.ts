/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import { ObjectId } from 'mongodb';
import randomCase from 'random-case';

import * as Backend from 'universe/backend';
import { getEnv } from 'universe/backend/env';
import { ErrorMessage } from 'universe/error';

import {
  selectAnswerFromDb,
  selectCommentFromDb,
  InternalQuestion,
  InternalUser,
  NewAnswer,
  NewComment,
  NewMail,
  NewQuestion,
  PatchAnswer,
  PatchQuestion,
  PointsUpdateOperation,
  PublicAnswer,
  PublicComment,
  PublicMail,
  PublicQuestion,
  toPublicAnswer,
  toPublicComment,
  toPublicMail,
  toPublicQuestion,
  toPublicUser,
  patchAnswerInDb,
  patchCommentInDb,
  questionStatuses,
  InternalMail
} from 'universe/backend/db';

import { useMockDateNow } from 'multiverse/mongo-common';
import { getDb } from 'multiverse/mongo-schema';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { itemToObjectId, itemToStringId } from 'multiverse/mongo-item';

import { dummyAppData } from 'testverse/db';
import { mockEnvFactory } from 'testverse/setup';

import type { PublicUser, NewUser, PatchUser } from 'universe/backend/db';

setupMemoryServerOverride();
useMockDateNow();

const withMockedEnv = mockEnvFactory({ NODE_ENV: 'test' });
const sortedUsers = dummyAppData.users.slice().reverse();

describe('::getAllUsers', () => {
  it('returns all users in order (latest first)', async () => {
    expect.hasAssertions();

    await expect(Backend.getAllUsers({ after_id: undefined })).resolves.toStrictEqual(
      sortedUsers.map(toPublicUser)
    );
  });

  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAllUsers({ after_id: undefined })
    ).resolves.not.toStrictEqual([]);

    await (await getDb({ name: 'hscc-api-qoverflow' }))
      .collection('users')
      .deleteMany({});
    await expect(Backend.getAllUsers({ after_id: undefined })).resolves.toStrictEqual(
      []
    );
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getAllUsers({ after_id: undefined }),
          await Backend.getAllUsers({
            after_id: itemToStringId(sortedUsers[0])
          }),
          await Backend.getAllUsers({
            after_id: itemToStringId(sortedUsers[1])
          }),
          await Backend.getAllUsers({
            after_id: itemToStringId(sortedUsers[2])
          }),
          await Backend.getAllUsers({
            after_id: itemToStringId(sortedUsers[3])
          })
        ]).toStrictEqual([...sortedUsers.map((user) => [toPublicUser(user)]), []]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(Backend.getAllUsers({ after_id: 'fake-oid' })).rejects.toMatchObject(
      { message: ErrorMessage.InvalidObjectId('fake-oid') }
    );
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(Backend.getAllUsers({ after_id })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'user_id')
    });
  });
});

describe('::getUser', () => {
  it('returns user by username', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUser({ username: dummyAppData.users[0].username })
    ).resolves.toStrictEqual(toPublicUser(dummyAppData.users[0]));
  });

  it('rejects if username missing or not found', async () => {
    expect.hasAssertions();
    const username = 'does-not-exist';

    await expect(Backend.getUser({ username })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(username, 'user')
    });

    await expect(Backend.getUser({ username: undefined })).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::getUserQuestions', () => {
  it('returns all questions created by the user in order (latest first)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserQuestions({
        username: dummyAppData.users[0].username,
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicQuestion(dummyAppData.questions[1]),
      toPublicQuestion(dummyAppData.questions[0])
    ]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getUserQuestions({
            username: dummyAppData.users[0].username,
            after_id: undefined
          }),
          await Backend.getUserQuestions({
            username: dummyAppData.users[0].username,
            after_id: dummyAppData.users[0].questionIds[1].toString()
          }),
          await Backend.getUserQuestions({
            username: dummyAppData.users[0].username,
            after_id: dummyAppData.users[0].questionIds[0].toString()
          })
        ]).toStrictEqual([
          [toPublicQuestion(dummyAppData.questions[1])],
          [toPublicQuestion(dummyAppData.questions[0])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserQuestions({
        username: dummyAppData.users[0].username,
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.getUserQuestions({ username: dummyAppData.users[0].username, after_id })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'question_id')
    });
  });

  it('rejects if username missing or not found', async () => {
    expect.hasAssertions();
    const username = 'does-not-exist';

    await expect(
      Backend.getUserQuestions({ username, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(username, 'user')
    });

    await expect(
      Backend.getUserQuestions({ username: undefined, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::getUserAnswers', () => {
  it('returns all answers created by the user in order (latest first)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserAnswers({
        username: dummyAppData.users[1].username,
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicAnswer(dummyAppData.questions[4].answerItems[0]),
      toPublicAnswer(dummyAppData.questions[1].answerItems[0]),
      toPublicAnswer(dummyAppData.questions[0].answerItems[0])
    ]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getUserAnswers({
            username: dummyAppData.users[1].username,
            after_id: undefined
          }),
          await Backend.getUserAnswers({
            username: dummyAppData.users[1].username,
            after_id: dummyAppData.users[1].answerIds[2][1].toString()
          }),
          await Backend.getUserAnswers({
            username: dummyAppData.users[1].username,
            after_id: dummyAppData.users[1].answerIds[1][1].toString()
          }),
          await Backend.getUserAnswers({
            username: dummyAppData.users[1].username,
            after_id: dummyAppData.users[1].answerIds[0][1].toString()
          })
        ]).toStrictEqual([
          [toPublicAnswer(dummyAppData.questions[4].answerItems[0])],
          [toPublicAnswer(dummyAppData.questions[1].answerItems[0])],
          [toPublicAnswer(dummyAppData.questions[0].answerItems[0])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserAnswers({
        username: dummyAppData.users[1].username,
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.getUserAnswers({ username: dummyAppData.users[1].username, after_id })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'answer_id')
    });
  });

  it('rejects if username missing or not found', async () => {
    expect.hasAssertions();
    const username = 'does-not-exist';

    await expect(
      Backend.getUserAnswers({ username, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(username, 'user')
    });

    await expect(
      Backend.getUserAnswers({ username: undefined, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::createUser', () => {
  it('creates and returns a new user', async () => {
    expect.hasAssertions();

    const newUser: Required<NewUser> = {
      username: 'new-user',
      email: 'new-user@email.com',
      key: '0'.repeat(getEnv().USER_KEY_LENGTH),
      salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
    };

    await expect(
      Backend.createUser({ data: newUser })
    ).resolves.toStrictEqual<PublicUser>({
      user_id: expect.any(String),
      username: newUser.username,
      email: newUser.email,
      salt: newUser.salt,
      points: 1,
      questions: 0,
      answers: 0
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('users')
        .countDocuments({ username: 'new-user' })
    ).resolves.toBe(1);
  });

  it('rejects when attempting to create a user with a duplicate username or email', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createUser({
        data: {
          username: dummyAppData.users[0].username,
          email: 'new-user@email.com',
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.DuplicateFieldValue('username')
    });

    await expect(
      Backend.createUser({
        data: {
          username: 'new-user',
          email: dummyAppData.users[0].email,
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateFieldValue('email') });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MIN_USER_NAME_LENGTH: minULen,
      MAX_USER_NAME_LENGTH: maxULen,
      MIN_USER_EMAIL_LENGTH: minELen,
      MAX_USER_EMAIL_LENGTH: maxELen,
      USER_SALT_LENGTH: saltLen,
      USER_KEY_LENGTH: keyLen
    } = getEnv();

    const newUsers: [NewUser, string][] = [
      [undefined as unknown as NewUser, ErrorMessage.InvalidJSON()],
      ['string data' as NewUser, ErrorMessage.InvalidJSON()],
      [
        {} as NewUser,
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: null } as unknown as NewUser,
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(minELen - 1) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(maxELen + 1) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(maxELen) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'valid@email.address' },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen - 1)
        },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: null
        } as unknown as NewUser,
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: 'x'.repeat(saltLen)
        },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen)
        },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen - 1)
        },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: 'x'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: null
        } as unknown as NewUser,
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        {
          username: 'must be alphanumeric',
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen, 'alphanumeric')
      ],
      [
        {
          username: '#&*@^(#@(^$&*#',
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen, 'alphanumeric')
      ],
      [
        {
          username: null,
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        } as unknown as NewUser,
        ErrorMessage.InvalidStringLength('username', minULen, maxULen, 'alphanumeric')
      ],
      [
        {
          username: 'x'.repeat(minULen - 1),
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen, 'alphanumeric')
      ],
      [
        {
          username: 'x'.repeat(maxULen + 1),
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen, 'alphanumeric')
      ],
      [
        {
          username: 'x'.repeat(maxULen - 1),
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen),
          user_id: 1
        } as NewUser,
        ErrorMessage.UnknownField('user_id')
      ]
    ];

    await Promise.all(
      newUsers.map(([data, message]) =>
        expect(Backend.createUser({ data })).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::updateUser', () => {
  it('updates an existing user', async () => {
    expect.hasAssertions();

    const usersDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection('users');

    const patchUser: PatchUser = {
      email: 'fake@email.com',
      key: '0'.repeat(getEnv().USER_KEY_LENGTH),
      salt: '0'.repeat(getEnv().USER_SALT_LENGTH),
      points: 50
    };

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        ...patchUser
      })
    ).resolves.toBe(0);

    await expect(
      Backend.updateUser({
        username: dummyAppData.users[0].username,
        data: patchUser
      })
    ).resolves.toBeUndefined();

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        ...patchUser
      })
    ).resolves.toBe(1);
  });

  it('supports PointsUpdateOperation updates alongside normal points updates', async () => {
    expect.hasAssertions();

    const usersDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection('users');

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: dummyAppData.users[0].points + 1000
      })
    ).resolves.toBe(0);

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: dummyAppData.users[0].points + 1000 - 456
      })
    ).resolves.toBe(0);

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: 0
      })
    ).resolves.toBe(0);

    await Backend.updateUser({
      username: dummyAppData.users[0].username,
      data: { points: { op: 'increment', amount: 1000 } }
    });

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: dummyAppData.users[0].points + 1000
      })
    ).resolves.toBe(1);

    await Backend.updateUser({
      username: dummyAppData.users[0].username,
      data: { points: { op: 'decrement', amount: 456 } }
    });

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: dummyAppData.users[0].points + 1000 - 456
      })
    ).resolves.toBe(1);

    await Backend.updateUser({
      username: dummyAppData.users[0].username,
      data: { points: 0 }
    });

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        points: 0
      })
    ).resolves.toBe(1);
  });

  it('does not reject when demonstrating idempotency', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateUser({
        username: dummyAppData.users[0].username,
        data: { salt: dummyAppData.users[0].salt }
      })
    ).resolves.toBeUndefined();
  });

  it('does not reject if no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateUser({
        username: 'does-not-exist',
        data: {}
      })
    ).resolves.toBeUndefined();
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateUser({
        username: 'fake-user',
        data: {
          email: 'fake@email.com',
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('fake-user', 'user')
    });

    await expect(
      Backend.updateUser({
        username: undefined,
        data: {
          email: 'fake@email.com',
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('rejects when attempting to update a user to a duplicate email', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateUser({
        username: dummyAppData.users[1].username,
        data: {
          email: dummyAppData.users[0].email
        }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateFieldValue('email') });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MIN_USER_EMAIL_LENGTH: minELen,
      MAX_USER_EMAIL_LENGTH: maxELen,
      USER_SALT_LENGTH: saltLen,
      USER_KEY_LENGTH: keyLen
    } = getEnv();

    const patchUsers: [PatchUser, string][] = [
      [undefined as unknown as PatchUser, ErrorMessage.InvalidJSON()],
      ['string data' as PatchUser, ErrorMessage.InvalidJSON()],
      [
        { email: '' },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(minELen - 1) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(maxELen + 1) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { email: 'x'.repeat(maxELen) },
        ErrorMessage.InvalidStringLength('email', minELen, maxELen, 'string')
      ],
      [
        { salt: '' },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        { salt: '0'.repeat(saltLen - 1) },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        { salt: 'x'.repeat(saltLen) },
        ErrorMessage.InvalidStringLength('salt', saltLen, null, 'hexadecimal')
      ],
      [
        { key: '' },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        { key: '0'.repeat(keyLen - 1) },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [
        { key: 'x'.repeat(keyLen) },
        ErrorMessage.InvalidStringLength('key', keyLen, null, 'hexadecimal')
      ],
      [{ points: -1 }, ErrorMessage.InvalidNumberValue('points', 0, null, 'integer')],
      [
        { points: null as unknown as number },
        ErrorMessage.InvalidNumberValue('points', 0, null, 'integer')
      ],
      [
        { points: '10' as unknown as number },
        ErrorMessage.InvalidNumberValue('points', 0, null, 'integer')
      ],
      [
        { points: {} as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
      ],
      [
        { points: { amount: 5 } as PointsUpdateOperation },
        ErrorMessage.InvalidFieldValue('points.operation', 'decrement', [
          'increment',
          'decrement'
        ])
      ],
      [
        {
          points: {
            amount: '5',
            op: 'decrement'
          } as unknown as PointsUpdateOperation
        },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
      ],
      [
        { points: { op: 'decrement' } as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
      ],
      [
        { points: { amount: -1, op: 'decrement' } as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
      ],
      [
        {
          points: { amount: 5, op: 'nope' } as unknown as PointsUpdateOperation
        },
        ErrorMessage.InvalidFieldValue('points.operation', 'decrement', [
          'increment',
          'decrement'
        ])
      ],
      [
        {
          points: {
            amount: 'x',
            op: 'nope'
          } as unknown as PointsUpdateOperation
        },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
      ],
      [
        {
          points: {
            amount: 5,
            op: 'increment',
            bad: 'bad not good'
          } as unknown as PointsUpdateOperation
        },
        ErrorMessage.UnknownField('bad')
      ],
      [{ data: 1 } as NewUser, ErrorMessage.UnknownField('data')],
      [{ name: 'username' } as NewUser, ErrorMessage.UnknownField('name')],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen),
          points: 0,
          username: 'new-username'
        } as PatchUser,
        ErrorMessage.UnknownField('username')
      ]
    ];

    await Promise.all(
      patchUsers.map(([data, message]) =>
        expect(
          Backend.updateUser({ username: dummyAppData.users[0].username, data })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteUser', () => {
  it('deletes a user', async () => {
    expect.hasAssertions();

    const usersDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection('users');

    await expect(
      usersDb.countDocuments({ _id: itemToObjectId(dummyAppData.users[0]) })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteUser({ username: dummyAppData.users[0].username })
    ).resolves.toBeUndefined();

    await expect(
      usersDb.countDocuments({ _id: itemToObjectId(dummyAppData.users[0]) })
    ).resolves.toBe(0);
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.deleteUser({ username: 'does-not-exist' })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(Backend.deleteUser({ username: undefined })).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::authAppUser', () => {
  it('returns true iff application-level key matches', async () => {
    expect.hasAssertions();

    await expect(
      Backend.authAppUser({ username: 'User1', key: dummyAppData.users[0].key })
    ).resolves.toBeTrue();

    await expect(
      Backend.authAppUser({ username: 'User1', key: 'bad' })
    ).resolves.toBeFalse();
  });

  it('returns false if application-level key is empty, null, or undefined', async () => {
    expect.hasAssertions();

    await expect(
      Backend.authAppUser({ username: 'User1', key: '' })
    ).resolves.toBeFalse();

    await expect(
      Backend.authAppUser({ username: 'User1', key: null as unknown as string })
    ).resolves.toBeFalse();

    await expect(
      Backend.authAppUser({ username: 'User1', key: undefined as unknown as string })
    ).resolves.toBeFalse();
  });
});

describe('::getUserMessages', () => {
  it('returns all messages received by the user in order (latest first)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserMessages({
        username: dummyAppData.users[0].username,
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicMail(dummyAppData.mail[1]),
      toPublicMail(dummyAppData.mail[0])
    ]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getUserMessages({
            username: dummyAppData.users[0].username,
            after_id: undefined
          }),
          await Backend.getUserMessages({
            username: dummyAppData.users[0].username,
            after_id: itemToStringId(dummyAppData.mail[1])
          }),
          await Backend.getUserMessages({
            username: dummyAppData.users[0].username,
            after_id: itemToStringId(dummyAppData.mail[0])
          })
        ]).toStrictEqual([
          [toPublicMail(dummyAppData.mail[1])],
          [toPublicMail(dummyAppData.mail[0])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getUserMessages({
        username: dummyAppData.users[0].username,
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.getUserMessages({ username: dummyAppData.users[0].username, after_id })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'mail_id')
    });
  });

  it('rejects if username missing or not found', async () => {
    expect.hasAssertions();
    const username = 'does-not-exist';

    await expect(
      Backend.getUserMessages({ username, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(username, 'user')
    });

    await expect(
      Backend.getUserMessages({ username: undefined, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::createMessage', () => {
  it('creates and returns a new message', async () => {
    expect.hasAssertions();

    const newMessage: Required<NewMail> = {
      receiver: dummyAppData.users[2].username,
      sender: dummyAppData.users[1].username,
      subject: 'You have got mail!',
      text: 'World, hello!'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('mail')
        .countDocuments({ subject: 'You have got mail!' })
    ).resolves.toBe(0);

    await expect(
      Backend.createMessage({ data: newMessage })
    ).resolves.toStrictEqual<PublicMail>({
      mail_id: expect.any(String),
      createdAt: Date.now(),
      receiver: newMessage.receiver,
      sender: newMessage.sender,
      subject: newMessage.subject,
      text: newMessage.text
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('mail')
        .countDocuments({ subject: 'You have got mail!' })
    ).resolves.toBe(1);
  });

  it('rejects if the sender or receiver is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createMessage({
        data: {
          receiver: dummyAppData.users[0].username,
          sender: 'does-not-exist',
          subject: 'You have got mail!',
          text: 'World, hello!'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createMessage({
        data: {
          receiver: 'does-not-exist',
          sender: dummyAppData.users[0].username,
          subject: 'You have got mail!',
          text: 'World, hello!'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createMessage({
        data: {
          receiver: undefined,
          sender: dummyAppData.users[0].username,
          subject: 'You have got mail!',
          text: 'World, hello!'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('receiver')
    });

    await expect(
      Backend.createMessage({
        data: {
          receiver: dummyAppData.users[0].username,
          sender: undefined,
          subject: 'You have got mail!',
          text: 'World, hello!'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('sender')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MAX_MAIL_SUBJECT_LENGTH: maxSubjectLen,
      MAX_MAIL_BODY_LENGTH_BYTES: maxBodyLen
    } = getEnv();

    const newMailMessages: [NewMail, string][] = [
      [undefined as unknown as NewMail, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as NewMail, ErrorMessage.InvalidJSON()],
      [{} as NewMail, ErrorMessage.InvalidFieldValue('receiver')],
      [
        { receiver: dummyAppData.users[0].username } as NewMail,
        ErrorMessage.InvalidFieldValue('sender')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', 1, maxSubjectLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: ''
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', 1, maxSubjectLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: 'x'.repeat(maxSubjectLen + 1)
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', 1, maxSubjectLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: 'x'
        } as NewMail,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: 'x',
          text: ''
        } as NewMail,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: 'x',
          text: 'x'.repeat(maxBodyLen + 1)
        } as NewMail,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: 'x',
          text: 'x',
          createdAt: Date.now()
        } as NewMail,
        ErrorMessage.UnknownField('createdAt')
      ],
      [
        {
          receiver: 'does-not-exist',
          sender: 'ignored',
          subject: 'x',
          text: 'x'
        } as NewMail,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: 'does-not-exist',
          subject: 'x',
          text: 'x'
        } as NewMail,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ]
    ];

    await Promise.all(
      newMailMessages.map(([data, message]) =>
        expect(Backend.createMessage({ data })).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteMessage', () => {
  it('deletes a message (mail)', async () => {
    expect.hasAssertions();

    const mailDb = (
      await getDb({
        name: 'hscc-api-qoverflow'
      })
    ).collection<InternalMail>('mail');

    await expect(
      mailDb.countDocuments({ _id: itemToObjectId(dummyAppData.mail[0]) })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteMessage({ mail_id: itemToStringId(dummyAppData.mail[0]) })
    ).resolves.toBeUndefined();

    await expect(
      mailDb.countDocuments({ _id: itemToObjectId(dummyAppData.mail[0]) })
    ).resolves.toBe(0);
  });

  it('rejects if the mail_id is missing or not found', async () => {
    expect.hasAssertions();

    const mail_id = new ObjectId().toString();

    await expect(Backend.deleteMessage({ mail_id })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(mail_id, 'mail message')
    });

    await expect(Backend.deleteMessage({ mail_id: undefined })).rejects.toMatchObject(
      {
        message: ErrorMessage.InvalidItem('mail_id', 'parameter')
      }
    );
  });
});

describe('::searchQuestions', () => {
  const reversedInternalQuestions = dummyAppData.questions.slice().reverse();
  const reversedPublicQuestions = reversedInternalQuestions.map(toPublicQuestion);

  it('returns RESULTS_PER_PAGE questions in default sort order (insertion, latest first) if no query params given', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        await expect(
          Backend.searchQuestions({
            after_id: undefined,
            match: {},
            regexMatch: {},
            sort: undefined
          })
        ).resolves.toStrictEqual(reversedPublicQuestions.slice(0, 3));
      },
      { RESULTS_PER_PAGE: '3' }
    );
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        let prevQuestion: PublicQuestion | null = null;

        for (const question of reversedPublicQuestions) {
          await expect(
            Backend.searchQuestions({
              after_id: prevQuestion ? prevQuestion.question_id : undefined,
              match: {},
              regexMatch: {},
              sort: undefined
            })
          ).resolves.toStrictEqual([question]);
          prevQuestion = question;
        }

        await expect(
          Backend.searchQuestions({
            after_id: prevQuestion ? prevQuestion.question_id : undefined,
            match: {},
            regexMatch: {},
            sort: undefined
          })
        ).resolves.toStrictEqual([]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const questionsDb = db.collection('questions');

    await questionsDb.deleteMany({});

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual([]);
  });

  it('returns expected questions when using match and regexMatch simultaneously', async () => {
    expect.hasAssertions();

    const regex = /(open|closed)/im;

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $lt: Date.now() } },
        regexMatch: { status: 'open|closed' },
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter(
        (q) => q.createdAt < Date.now() && regex.test(q.status)
      )
    );
  });

  it('returns expected questions when matching case-insensitively by title', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { title: randomCase('where is the nhscc github page?') },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .filter((q) => q['title-lowercase'] == 'where is the nhscc github page?')
        .map(toPublicQuestion)
    );
  });

  it('returns expected questions when matching conditioned on createdAt', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $lt: Date.now() - 5000, $gt: Date.now() - 10 ** 5 } },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter(
        (q) => q.createdAt < Date.now() - 5000 && q.createdAt > Date.now() - 10 ** 5
      )
    );
  });

  it('supports special "$gt", "$gte", "$lt", "$lte" sub-matcher', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $lt: Date.now() - 10 ** 4 } },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter((q) => q.createdAt < Date.now() - 10 ** 4)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $lte: Date.now() - 5000 } },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter((q) => q.createdAt <= Date.now() - 5000)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $gt: Date.now() - 10 ** 4 } },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter((q) => q.createdAt > Date.now() - 10 ** 4)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { createdAt: { $gte: Date.now() - 98765 } },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter((q) => q.createdAt >= Date.now() - 98765)
    );
  });

  it('supports special "$or" sub-matcher', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {
          createdAt: {
            $or: [{ $lt: Date.now() - 10 ** 5 }, { $gte: Date.now() - 5000 }]
          }
        },
        regexMatch: {},
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter(
        (q) => q.createdAt < Date.now() - 10 ** 5 || q.createdAt >= Date.now() - 5000
      )
    );
  });

  it('supports multi-line case-insensitive regex matching of text via regexMatch', async () => {
    expect.hasAssertions();

    const regex = /^alsO:.*$/im;

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: { text: '^alsO:.*$' },
        sort: undefined
      })
    ).resolves.toStrictEqual(
      reversedPublicQuestions.filter((q) => regex.test(q.text))
    );
  });

  it('supports sorting results by upvotes, upvotes+views+comments, and upvotes+views+answers+comments (highest first)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: {},
        sort: 'u'
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .slice()
        .sort((a, b) => b.upvotes - a.upvotes)
        .map(toPublicQuestion)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: {},
        sort: 'uvc'
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .slice()
        .sort((a, b) => b.sorter.uvc - a.sorter.uvc)
        .map(toPublicQuestion)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: {},
        sort: 'uvac'
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .slice()
        .sort((a, b) => b.sorter.uvac - a.sorter.uvac)
        .map(toPublicQuestion)
    );
  });

  it('supports sorting matched results', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { answers: 0 },
        regexMatch: {},
        sort: 'uvc'
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .slice()
        .filter((q) => !q.answers)
        .sort((a, b) => b.sorter.uvc - a.sorter.uvc)
        .map(toPublicQuestion)
    );

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: { hasAcceptedAnswer: false },
        regexMatch: {},
        sort: 'uvac'
      })
    ).resolves.toStrictEqual(
      reversedInternalQuestions
        .slice()
        .filter((q) => !q.hasAcceptedAnswer)
        .sort((a, b) => b.sorter.uvac - a.sorter.uvac)
        .map(toPublicQuestion)
    );
  });

  it('rejects if passed an invalid sort parameter', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: undefined,
        match: {},
        regexMatch: {},
        sort: 'nope'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('nope', 'sort parameter')
    });
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchQuestions({
        after_id: 'fake-oid',
        match: {},
        regexMatch: {},
        sort: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.searchQuestions({
        after_id,
        match: {},
        regexMatch: {},
        sort: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'question_id')
    });
  });

  it('rejects when using match/regexMatch with disallowed, unknown, or non-proxied fields', async () => {
    expect.hasAssertions();

    const matchers: [
      match: Parameters<typeof Backend.searchQuestions>[0]['match'],
      regexMatch: Parameters<typeof Backend.searchQuestions>[0]['regexMatch'],
      errorMessage: string
    ][] = [
      [
        { question_id: new ObjectId().toString() },
        {},
        ErrorMessage.UnknownSpecifier('question_id')
      ],
      [
        {},
        { question_id: new ObjectId().toString() },
        ErrorMessage.UnknownSpecifier('question_id')
      ],
      [
        { upvoterUsernames: [] as any },
        {},
        ErrorMessage.UnknownSpecifier('upvoterUsernames')
      ],
      [
        {},
        { upvoterUsernames: [] as any },
        ErrorMessage.UnknownSpecifier('upvoterUsernames')
      ],
      [{ 'sorter.uvc': {} as any }, {}, ErrorMessage.UnknownSpecifier('sorter.uvc')],
      [{}, { sorter: {} as any }, ErrorMessage.UnknownSpecifier('sorter')],
      [{}, { createdAt: '12345' }, ErrorMessage.UnknownSpecifier('createdAt')],
      [{}, { upvotes: '10' }, ErrorMessage.UnknownSpecifier('upvotes')],
      [
        {},
        { hasAcceptedAnswer: 'false' },
        ErrorMessage.UnknownSpecifier('hasAcceptedAnswer')
      ],
      [{ unknown: 'unknown' }, {}, ErrorMessage.UnknownSpecifier('unknown')],
      [{}, { unknown: 'unknown' }, ErrorMessage.UnknownSpecifier('unknown')]
    ];

    await Promise.all(
      matchers.map(([match, regexMatch, message]) =>
        expect(
          Backend.searchQuestions({
            after_id: undefined,
            match,
            regexMatch,
            sort: undefined
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });

  it('rejects when match and regexMatch are given strange or bad inputs', async () => {
    expect.hasAssertions();

    const matchers: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matcher: any,
      errors: [matchError: string, regexMatchError: string]
    ][] = [
      [
        'wtf',
        [
          ErrorMessage.InvalidMatcher('match'),
          ErrorMessage.InvalidMatcher('regexMatch')
        ]
      ],
      [
        null,
        [
          ErrorMessage.InvalidMatcher('match'),
          ErrorMessage.InvalidMatcher('regexMatch')
        ]
      ],
      [
        undefined,
        [
          ErrorMessage.InvalidMatcher('match'),
          ErrorMessage.InvalidMatcher('regexMatch')
        ]
      ],
      [
        { bad: 'super-bad' },
        [ErrorMessage.UnknownSpecifier('bad'), ErrorMessage.UnknownSpecifier('bad')]
      ],
      [
        { createdAt: () => 'wtf' },
        [
          ErrorMessage.InvalidSpecifierValueType(
            'createdAt',
            'a number, string, boolean, or sub-specifier object'
          ),
          ErrorMessage.UnknownSpecifier('createdAt')
        ]
      ],
      [
        { status: /nope/g },
        [
          ErrorMessage.InvalidSpecifierValueType(
            'status',
            'a number, string, boolean, or sub-specifier object'
          ),
          ErrorMessage.InvalidRegexString('status')
        ]
      ],
      [
        { upvotes: {} },
        [
          ErrorMessage.InvalidSpecifierValueType('upvotes', 'a non-empty object'),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $in: [5] } },
        [
          ErrorMessage.UnknownSpecifier('$in', true),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $lt: [5] } },
        [
          ErrorMessage.InvalidSpecifierValueType('$lt', 'a number', true),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: { $gt: 6 } } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('upvotes')]
      ],
      [
        { upvotes: { $or: [{ $gt: 6 }, { $gt: 6 }, { $gt: 6 }] } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('upvotes')]
      ],
      [
        { upvotes: { $or: ['b', { $gt: 6 }] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(0),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ $gt: 6 }, 'b'] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(1),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ $gt: 6 }, { $gt: 6, $lte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierBadLength(1),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ $gt: 7 }, undefined] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(1),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{}] } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('upvotes')]
      ],
      [
        { upvotes: { $or: [{}, {}] } },
        [
          ErrorMessage.InvalidSpecifierValueType('upvotes', 'a non-empty object'),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ bad: 1 }, { $gte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidKey(0, 'bad'),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ $gte: 5 }, { bad: 1 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidKey(1, 'bad'),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ],
      [
        { upvotes: { $or: [{ $gte: 'bad' }, { $gte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidValueType(0, '$gte'),
          ErrorMessage.UnknownSpecifier('upvotes')
        ]
      ]
    ];

    await Promise.all(
      matchers.flatMap(([matcher, [matchMessage, regexMatchMessage]]) => {
        return [
          // eslint-disable-next-line jest/valid-expect
          expect(
            Backend.searchQuestions({
              after_id: undefined,
              match: matcher,
              regexMatch: {},
              sort: undefined
            })
          ).rejects.toMatchObject({ message: matchMessage }),
          // eslint-disable-next-line jest/valid-expect
          expect(
            Backend.searchQuestions({
              after_id: undefined,
              match: {},
              regexMatch: matcher,
              sort: undefined
            })
          ).rejects.toMatchObject({ message: regexMatchMessage })
        ];
      })
    );
  });
});

describe('::getQuestion', () => {
  it('returns question by question_id', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getQuestion({ question_id: itemToStringId(dummyAppData.questions[1]) })
    ).resolves.toStrictEqual(toPublicQuestion(dummyAppData.questions[1]));
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getQuestion({ question_id: 'does-not-exist' })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('does-not-exist')
    });

    await expect(
      Backend.getQuestion({ question_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();
    await expect(Backend.getQuestion({ question_id })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });
});

describe('::createQuestion', () => {
  it('creates and returns a new question', async () => {
    expect.hasAssertions();

    const newQuestion: Required<NewQuestion> = {
      creator: dummyAppData.users[0].username,
      title: 'Title',
      text: 'Text'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({ text: 'Text' })
    ).resolves.toBe(0);

    await expect(
      Backend.createQuestion({ data: newQuestion })
    ).resolves.toStrictEqual<PublicQuestion>({
      question_id: expect.any(String),
      creator: dummyAppData.users[0].username,
      createdAt: Date.now(),
      hasAcceptedAnswer: false,
      title: 'Title',
      text: 'Text',
      status: 'open',
      answers: 0,
      comments: 0,
      views: 0,
      upvotes: 0,
      downvotes: 0
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({ text: 'Text' })
    ).resolves.toBe(1);
  });

  it("updates user's questions array when they create a new question", async () => {
    expect.hasAssertions();

    const newQuestion = await Backend.createQuestion({
      data: {
        creator: dummyAppData.users[0].username,
        title: 'Title',
        text: 'Text'
      }
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[0].username },
          { projection: { _id: false, questionIds: true } }
        )
    ).resolves.toStrictEqual({
      questionIds: expect.arrayContaining([itemToObjectId(newQuestion.question_id)])
    });
  });

  it('rejects if the creator is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createQuestion({
        data: {
          creator: 'does-not-exist',
          title: 'Title',
          text: 'Text'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createQuestion({
        data: {
          creator: undefined as any,
          title: 'Title',
          text: 'Text'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('creator')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MAX_QUESTION_TITLE_LENGTH: maxTitleLen,
      MAX_QUESTION_BODY_LENGTH_BYTES: maxBodyLen
    } = getEnv();

    const newQuestions: [NewQuestion, string][] = [
      [undefined as unknown as NewQuestion, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as NewQuestion, ErrorMessage.InvalidJSON()],
      [
        {} as NewQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: ''
        } as NewQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: 'x'.repeat(maxTitleLen + 1)
        } as NewQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: 'x'
        } as NewQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: 'x',
          text: ''
        } as NewQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: 'x',
          text: 'x'.repeat(maxBodyLen + 1)
        } as NewQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { creator: 'does-not-exist', title: 'x', text: 'x' } as NewQuestion,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          title: 'x',
          text: 'x',
          hasAcceptedAnswer: true
        } as NewQuestion,
        ErrorMessage.UnknownField('hasAcceptedAnswer')
      ]
    ];

    await Promise.all(
      newQuestions.map(([data, message]) =>
        expect(Backend.createQuestion({ data })).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::updateQuestion', () => {
  it('updates an existing question', async () => {
    expect.hasAssertions();

    const patchQuestion: PatchQuestion = {
      title: 'Title',
      text: 'Text',
      upvotes: 50,
      downvotes: 50,
      status: 'closed',
      views: 5
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({
          _id: itemToObjectId(dummyAppData.questions[0]),
          ...patchQuestion,
          'title-lowercase': patchQuestion.title!.toLowerCase()
        })
    ).resolves.toBe(0);

    await expect(
      Backend.updateQuestion({
        question_id: itemToStringId(dummyAppData.questions[0]),
        data: patchQuestion
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne({
        _id: itemToObjectId(dummyAppData.questions[0])
      })
    ).resolves.toMatchObject({
      ...patchQuestion,
      'title-lowercase': patchQuestion.title!.toLowerCase()
    });
  });

  it('supports ViewsUpdateOperation updates alongside normal views count updates', async () => {
    expect.hasAssertions();

    const questionsDb = (
      await getDb({ name: 'hscc-api-qoverflow' })
    ).collection<InternalQuestion>('questions');

    await expect(
      questionsDb.countDocuments({
        _id: itemToObjectId(dummyAppData.questions[0]),
        views: dummyAppData.questions[0].views + 1
      })
    ).resolves.toBe(0);

    await expect(
      questionsDb.countDocuments({
        _id: itemToObjectId(dummyAppData.questions[0]),
        views: 0
      })
    ).resolves.toBe(0);

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { views: 'increment' }
    });

    await expect(
      questionsDb.findOne({
        _id: itemToObjectId(dummyAppData.questions[0])
      })
    ).resolves.toMatchObject({ views: dummyAppData.questions[0].views + 1 });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { views: 0 }
    });

    await expect(
      questionsDb.findOne({
        _id: itemToObjectId(dummyAppData.questions[0])
      })
    ).resolves.toMatchObject({ views: 0 });
  });

  it('updates sorter uvc/uvac counters when updating views or upvotes counts', async () => {
    expect.hasAssertions();

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac },
      views,
      upvotes
    } = dummyAppData.questions[0];

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { views: 'increment' }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc + 1, uvac: uvac + 1 });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { views: 0 }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc - views, uvac: uvac - views });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { views: 10 }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc - views + 10, uvac: uvac - views + 10 });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { upvotes: upvotes + 1 }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc - views + 11, uvac: uvac - views + 11 });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { upvotes: 0 }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({
      uvc: uvc - views + 11 - (upvotes + 1),
      uvac: uvac - views + 11 - (upvotes + 1)
    });

    await Backend.updateQuestion({
      question_id: itemToStringId(dummyAppData.questions[0]),
      data: { upvotes: 5 }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({
      uvc: uvc - views + 15 - upvotes,
      uvac: uvac - views + 15 - upvotes
    });
  });

  it('does not reject if no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateQuestion({
        question_id: itemToStringId(dummyAppData.questions[0]),
        data: {}
      })
    ).resolves.toBeUndefined();
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const patchQuestion: PatchQuestion = {
      title: 'Title',
      text: 'Text'
    };

    await expect(
      Backend.updateQuestion({ question_id: 'does-not-exist', data: patchQuestion })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('does-not-exist')
    });

    await expect(
      Backend.updateQuestion({ question_id: undefined, data: patchQuestion })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const patchQuestion: PatchQuestion = {
      title: 'Title',
      text: 'Text'
    };

    const question_id = new ObjectId().toString();
    await expect(
      Backend.updateQuestion({ question_id, data: patchQuestion })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MAX_QUESTION_TITLE_LENGTH: maxTitleLen,
      MAX_QUESTION_BODY_LENGTH_BYTES: maxBodyLen
    } = getEnv();

    const patchQuestions: [PatchQuestion, string][] = [
      [undefined as unknown as PatchQuestion, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as PatchQuestion, ErrorMessage.InvalidJSON()],
      [
        { creator: 'does-not-exist' } as PatchQuestion,
        ErrorMessage.UnknownField('creator')
      ],
      [
        { title: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        { title: '' } as PatchQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        { title: 'x'.repeat(maxTitleLen + 1) } as PatchQuestion,
        ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
      ],
      [
        { text: 5 } as unknown as PatchQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { text: '' } as PatchQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { text: 'x'.repeat(maxBodyLen + 1) } as PatchQuestion,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { upvotes: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { upvotes: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { upvotes: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { downvotes: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ],
      [
        { downvotes: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ],
      [
        { downvotes: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ],
      [
        { views: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null, 'integer')
      ],
      [
        { views: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null, 'integer')
      ],
      [
        { views: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null, 'integer')
      ],
      [
        { status: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, questionStatuses)
      ],
      [
        { status: -1 } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, questionStatuses)
      ],
      [
        { status: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, questionStatuses)
      ],
      [
        { status: '' } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, questionStatuses)
      ]
    ];

    await Promise.all(
      patchQuestions.map(([data, message]) =>
        expect(
          Backend.updateQuestion({
            question_id: itemToStringId(dummyAppData.questions[0]),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteQuestion', () => {
  it('deletes the specified question', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({ _id: itemToObjectId(dummyAppData.questions[0]) })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteQuestion({
        question_id: itemToStringId(dummyAppData.questions[0])
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({ _id: itemToObjectId(dummyAppData.questions[0]) })
    ).resolves.toBe(0);
  });

  it("updates user's questions array when they delete a question", async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[0].username },
          { projection: { _id: false, questionIds: true } }
        )
    ).resolves.toStrictEqual({
      questionIds: expect.arrayContaining([itemToObjectId(dummyAppData.questions[0])])
    });

    await Backend.deleteQuestion({
      question_id: itemToStringId(dummyAppData.questions[0])
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[0].username },
          { projection: { _id: false, questionIds: true } }
        )
    ).resolves.toStrictEqual({
      questionIds: expect.not.arrayContaining([
        itemToObjectId(dummyAppData.questions[0])
      ])
    });
  });

  it("updates user's answers array when they delete a question (and hence its answers)", async () => {
    expect.hasAssertions();

    await expect(
      (
        await getDb({ name: 'hscc-api-qoverflow' })
      )
        .collection<InternalUser>('users')
        .find(
          { username: { $in: ['User1', 'User2', 'User3'] } },
          { projection: { _id: false, username: true, answerIds: true } }
        )
        .toArray()
    ).resolves.toStrictEqual([
      { username: 'User1', answerIds: dummyAppData.users[0].answerIds },
      { username: 'User2', answerIds: dummyAppData.users[1].answerIds },
      { username: 'User3', answerIds: dummyAppData.users[2].answerIds }
    ]);

    await Backend.deleteQuestion({
      question_id: itemToStringId(dummyAppData.questions[0])
    });

    await expect(
      (
        await getDb({ name: 'hscc-api-qoverflow' })
      )
        .collection<InternalUser>('users')
        .find(
          { username: { $in: ['User1', 'User2', 'User3'] } },
          { projection: { _id: false, username: true, answerIds: true } }
        )
        .toArray()
    ).resolves.toStrictEqual([
      {
        username: 'User1',
        answerIds: dummyAppData.users[0].answerIds.filter(
          ([qid]) => !qid.equals(itemToObjectId(dummyAppData.questions[0]))
        )
      },
      {
        username: 'User2',
        answerIds: dummyAppData.users[1].answerIds.filter(
          ([qid]) => !qid.equals(itemToObjectId(dummyAppData.questions[0]))
        )
      },
      {
        username: 'User3',
        answerIds: dummyAppData.users[2].answerIds.filter(
          ([qid]) => !qid.equals(itemToObjectId(dummyAppData.questions[0]))
        )
      }
    ]);
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(Backend.deleteQuestion({ question_id })).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.deleteQuestion({ question_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(Backend.deleteQuestion({ question_id })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });
});

describe('::getAnswers', () => {
  it("returns all of the specified question's answers in order (oldest first)", async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({
        question_id: itemToStringId(dummyAppData.questions[0]),
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicAnswer(dummyAppData.questions[0].answerItems[0]),
      toPublicAnswer(dummyAppData.questions[0].answerItems[1]),
      toPublicAnswer(dummyAppData.questions[0].answerItems[2])
    ]);
  });

  it('does not crash on questions with no answers', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({
        question_id: itemToStringId(dummyAppData.questions[2]),
        after_id: undefined
      })
    ).resolves.toStrictEqual([]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getAnswers({
            question_id: itemToStringId(dummyAppData.questions[0]),
            after_id: undefined
          }),
          await Backend.getAnswers({
            question_id: itemToStringId(dummyAppData.questions[0]),
            after_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
          }),
          await Backend.getAnswers({
            question_id: itemToStringId(dummyAppData.questions[0]),
            after_id: itemToStringId(dummyAppData.questions[0].answerItems[1])
          }),
          await Backend.getAnswers({
            question_id: itemToStringId(dummyAppData.questions[0]),
            after_id: itemToStringId(dummyAppData.questions[0].answerItems[2])
          })
        ]).toStrictEqual([
          [toPublicAnswer(dummyAppData.questions[0].answerItems[0])],
          [toPublicAnswer(dummyAppData.questions[0].answerItems[1])],
          [toPublicAnswer(dummyAppData.questions[0].answerItems[2])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({
        question_id: itemToStringId(dummyAppData.questions[0]),
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.getAnswers({
        question_id: itemToStringId(dummyAppData.questions[0]),
        after_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'answer_id')
    });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({ question_id: 'does-not-exist', after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('does-not-exist')
    });

    await expect(
      Backend.getAnswers({ question_id: undefined, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();
    await expect(
      Backend.getAnswers({ question_id, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });
});

describe('::createAnswer', () => {
  it('creates and returns a new answer to a question', async () => {
    expect.hasAssertions();

    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[2]) },
          { projection: { _id: false, size: { $size: '$answerItems' } } }
        )
    ).resolves.toStrictEqual({ size: 0 });

    await expect(
      Backend.createAnswer({
        question_id: itemToStringId(dummyAppData.questions[2]),
        data: newAnswer
      })
    ).resolves.toStrictEqual<PublicAnswer>({
      answer_id: expect.any(String),
      creator: dummyAppData.users[0].username,
      createdAt: Date.now(),
      text: 'Text!',
      accepted: false,
      comments: 0,
      upvotes: 0,
      downvotes: 0
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[2]) },
          { projection: { _id: false, size: { $size: '$answerItems' } } }
        )
    ).resolves.toStrictEqual({ size: 1 });
  });

  it('updates answer count when creating new answer to question', async () => {
    expect.hasAssertions();

    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Comment.'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[1]) },
          { projection: { _id: false, answers: true } }
        )
    ).resolves.toStrictEqual({ answers: 1 });

    await Backend.createAnswer({
      question_id: itemToStringId(dummyAppData.questions[1]),
      data: newAnswer
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: { _id: false, answers: true }
        }
      )
    ).resolves.toStrictEqual({ answers: 2 });
  });

  it("updates user's answers array when they create a new answer", async () => {
    expect.hasAssertions();

    const newAnswer = await Backend.createAnswer({
      question_id: itemToStringId(dummyAppData.questions[1]),
      data: {
        creator: dummyAppData.users[0].username,
        text: 'Text'
      }
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[0].username },
          { projection: { _id: false, answerIds: true } }
        )
    ).resolves.toStrictEqual({
      answerIds: expect.arrayContaining([
        ...dummyAppData.users[0].answerIds,
        [
          itemToObjectId(dummyAppData.questions[1]),
          itemToObjectId(newAnswer.answer_id)
        ]
      ])
    });
  });

  it('updates sorter uvac (and NOT uvc) counters when creating a new answer', async () => {
    expect.hasAssertions();

    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac }
    } = dummyAppData.questions[1];

    await Backend.createAnswer({
      question_id: itemToStringId(dummyAppData.questions[1]),
      data: newAnswer
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc, uvac: uvac + 1 });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';
    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createAnswer({ question_id, data: newAnswer })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.createAnswer({ question_id: undefined, data: newAnswer })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();
    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createAnswer({ question_id, data: newAnswer })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if the creator is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createAnswer({
        question_id: itemToStringId(dummyAppData.questions[2]),
        data: {
          creator: 'does-not-exist',
          text: 'Title'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createAnswer({
        question_id: itemToStringId(dummyAppData.questions[2]),
        data: {
          creator: undefined as any,
          text: 'Title'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('creator')
    });
  });

  it('rejects if the creator has already answered the question', async () => {
    expect.hasAssertions();

    const newAnswer: Required<NewAnswer> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        data: newAnswer
      })
    ).rejects.toMatchObject({ message: ErrorMessage.UserAlreadyAnswered() });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const { MAX_ANSWER_BODY_LENGTH_BYTES: maxBodyLen } = getEnv();

    const newAnswers: [NewAnswer, string][] = [
      [undefined as unknown as NewAnswer, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as NewAnswer, ErrorMessage.InvalidJSON()],
      [
        {} as NewAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: ''
        } as NewAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: 'x'.repeat(maxBodyLen + 1)
        } as NewAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { creator: 'does-not-exist', text: 'x' } as NewAnswer,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: 'x',
          accepted: true
        } as NewAnswer,
        ErrorMessage.UnknownField('accepted')
      ]
    ];

    await Promise.all(
      newAnswers.map(([data, message]) =>
        expect(
          Backend.createAnswer({
            question_id: itemToStringId(dummyAppData.questions[2]),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::updateAnswer', () => {
  it('updates an existing answer to a question', async () => {
    expect.hasAssertions();

    const patchAnswer: PatchAnswer = {
      text: 'Text!',
      upvotes: 50,
      downvotes: 50,
      accepted: true
    };

    await expect(
      selectAnswerFromDb({
        question_id: itemToObjectId(dummyAppData.questions[0]),
        answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
        projection: { _id: false }
      })
    ).resolves.not.toMatchObject(patchAnswer);

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: patchAnswer
      })
    ).resolves.toBeUndefined();

    await expect(
      selectAnswerFromDb({
        question_id: itemToObjectId(dummyAppData.questions[0]),
        answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
        projection: { _id: false }
      })
    ).resolves.toMatchObject(patchAnswer);
  });

  it('does not reject if no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: {}
      })
    ).resolves.toBeUndefined();
  });

  it("setting an answer as accepted updates the parent question's hasAcceptedAnswer to true", async () => {
    expect.hasAssertions();

    const patchAnswer: PatchAnswer = { accepted: true };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalQuestion>('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[0]) },
          { projection: { _id: false, hasAcceptedAnswer: true } }
        )
    ).resolves.toStrictEqual({ hasAcceptedAnswer: false });

    await Backend.updateAnswer({
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
      data: patchAnswer
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalQuestion>('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[0]) },
          { projection: { _id: false, hasAcceptedAnswer: true } }
        )
    ).resolves.toStrictEqual({ hasAcceptedAnswer: true });
  });

  it("rejects attempts to set accepted if the parent question's hasAcceptedAnswer is true", async () => {
    expect.hasAssertions();

    const patchAnswer: PatchAnswer = { accepted: true };

    await (await getDb({ name: 'hscc-api-qoverflow' }))
      .collection<InternalQuestion>('questions')
      .updateOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { $set: { hasAcceptedAnswer: true } }
      );

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.QuestionAlreadyAcceptedAnswer()
    });
  });

  it('rejects attempts to set accepted to false', async () => {
    expect.hasAssertions();

    const patchAnswer: PatchAnswer = { accepted: false };

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('accepted', undefined, ['true'])
    });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';
    const patchAnswer: PatchAnswer = { text: 'Text!' };

    await expect(
      Backend.updateAnswer({
        question_id,
        answer_id: new ObjectId().toString(),
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.updateAnswer({
        question_id: undefined,
        answer_id: new ObjectId().toString(),
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();
    const patchAnswer: PatchAnswer = { text: 'Text!' };

    await expect(
      Backend.updateAnswer({
        question_id,
        answer_id: new ObjectId().toString(),
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';
    const patchAnswer: PatchAnswer = { text: 'Text!' };

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('answer_id', 'parameter')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();
    const patchAnswer: PatchAnswer = { text: 'Text!' };

    await expect(
      Backend.updateAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const { MAX_ANSWER_BODY_LENGTH_BYTES: maxBodyLen } = getEnv();

    const patchAnswers: [PatchAnswer, string][] = [
      [undefined as unknown as PatchAnswer, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as PatchAnswer, ErrorMessage.InvalidJSON()],
      [
        { creator: 'does-not-exist' } as PatchAnswer,
        ErrorMessage.UnknownField('creator')
      ],
      [
        { text: '' } as PatchAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { text: 'x'.repeat(maxBodyLen + 1) } as PatchAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { text: null } as unknown as PatchAnswer,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        { upvotes: null } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { accepted: null } as unknown as PatchAnswer,
        ErrorMessage.InvalidFieldValue('accepted', undefined, ['true'])
      ],
      [
        { upvotes: -1 } as PatchAnswer,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { upvotes: '5' } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
      ],
      [
        { downvotes: null } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ],
      [
        { downvotes: -1 } as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ],
      [
        { downvotes: '5' } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
      ]
    ];

    await Promise.all(
      patchAnswers.map(([data, message]) =>
        expect(
          Backend.updateAnswer({
            question_id: itemToStringId(dummyAppData.questions[2]),
            answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteAnswer', () => {
  it('deletes the specified answer from a question', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[0]) },
          { projection: { _id: false, size: { $size: '$answerItems' } } }
        )
    ).resolves.toStrictEqual({ size: 3 });

    await expect(
      Backend.deleteAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[0]) },
          { projection: { _id: false, size: { $size: '$answerItems' } } }
        )
    ).resolves.toStrictEqual({ size: 2 });
  });

  it('updates answer count when deleting an answer', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[0]) },
          { projection: { _id: false, answers: true } }
        )
    ).resolves.toStrictEqual({ answers: 3 });

    await Backend.deleteAnswer({
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        {
          projection: { _id: false, answers: true }
        }
      )
    ).resolves.toStrictEqual({ answers: 2 });
  });

  it("updates user's answers array when they delete an answer", async () => {
    expect.hasAssertions();

    const question_id = itemToStringId(dummyAppData.questions[0]);
    const answer_id = itemToStringId(dummyAppData.questions[0].answerItems[0]);

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[1].username },
          { projection: { _id: false, answerIds: true } }
        )
    ).resolves.toStrictEqual({
      answerIds: expect.arrayContaining([
        [
          itemToObjectId(dummyAppData.questions[0]),
          itemToObjectId(dummyAppData.questions[0].answerItems[0])
        ]
      ])
    });

    await Backend.deleteAnswer({
      question_id,
      answer_id
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalUser>('users')
        .findOne(
          { username: dummyAppData.users[1].username },
          { projection: { _id: false, answerIds: true } }
        )
    ).resolves.toStrictEqual({
      answerIds: expect.not.arrayContaining([
        [
          itemToObjectId(dummyAppData.questions[0]),
          itemToObjectId(dummyAppData.questions[0].answerItems[0])
        ]
      ])
    });
  });

  it('updates sorter uvac (and NOT uvc) counters when deleting an answer', async () => {
    expect.hasAssertions();

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac }
    } = dummyAppData.questions[0];

    await Backend.deleteAnswer({
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc, uvac: uvac - 1 });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.deleteAnswer({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.deleteAnswer({
        question_id: undefined,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';

    await expect(
      Backend.deleteAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });

    await expect(
      Backend.deleteAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('answer_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(
      Backend.deleteAnswer({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0])
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.deleteAnswer({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });
});

describe('::getComments', () => {
  it("returns all of the specified question's comments in order (oldest first)", async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicComment(dummyAppData.questions[0].commentItems[0]),
      toPublicComment(dummyAppData.questions[0].commentItems[1])
    ]);
  });

  it("returns all of the specified answer's comments in order (oldest first)", async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[0]),
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[1]),
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[2])
    ]);
  });

  it('does not crash on questions or answers with no comments', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[2]),
        answer_id: undefined,
        after_id: undefined
      })
    ).resolves.toStrictEqual([]);

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[1]),
        answer_id: itemToStringId(dummyAppData.questions[1].answerItems[0]),
        after_id: undefined
      })
    ).resolves.toStrictEqual([]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: undefined,
            after_id: undefined
          }),
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: undefined,
            after_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
          }),
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: undefined,
            after_id: itemToStringId(dummyAppData.questions[0].commentItems[1])
          })
        ]).toStrictEqual([
          [toPublicComment(dummyAppData.questions[0].commentItems[0])],
          [toPublicComment(dummyAppData.questions[0].commentItems[1])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
            after_id: undefined
          }),
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
            after_id: itemToStringId(
              dummyAppData.questions[0].answerItems[1].commentItems[0]
            )
          }),
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
            after_id: itemToStringId(
              dummyAppData.questions[0].answerItems[1].commentItems[1]
            )
          }),
          await Backend.getComments({
            question_id: itemToStringId(dummyAppData.questions[0]),
            answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
            after_id: itemToStringId(
              dummyAppData.questions[0].answerItems[1].commentItems[2]
            )
          })
        ]).toStrictEqual([
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[0])],
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[1])],
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[2])],
          []
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after_id = new ObjectId().toString();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        after_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'comment_id')
    });

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        after_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'comment_id')
    });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: 'does-not-exist',
        answer_id: undefined,
        after_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('does-not-exist')
    });

    await expect(
      Backend.getComments({
        question_id: undefined,
        answer_id: undefined,
        after_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: 'does-not-exist',
        after_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('does-not-exist')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(
      Backend.getComments({ question_id, answer_id: undefined, after_id: undefined })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.getComments({
        question_id,
        answer_id: question_id,
        after_id: question_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        after_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });

    await expect(
      Backend.getComments({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        after_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });
});

describe('::createComment', () => {
  it('creates and returns a new comment to a question', async () => {
    expect.hasAssertions();

    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Comment.'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[1]) },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 1 });

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[1]),
        answer_id: undefined,
        data: newComment
      })
    ).resolves.toStrictEqual<PublicComment>({
      comment_id: expect.any(String),
      creator: dummyAppData.users[0].username,
      createdAt: Date.now(),
      text: 'Comment.',
      upvotes: 0,
      downvotes: 0
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[1]) },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 2 });
  });

  it('creates and returns a new comment to an answer', async () => {
    expect.hasAssertions();

    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Comment.'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: {
            _id: false,
            size: { $size: { $first: '$answerItems.commentItems' } }
          }
        }
      )
    ).resolves.toStrictEqual({ size: 0 });

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[1]),
        answer_id: itemToStringId(dummyAppData.questions[1].answerItems[0]),
        data: newComment
      })
    ).resolves.toStrictEqual<PublicComment>({
      comment_id: expect.any(String),
      creator: dummyAppData.users[0].username,
      createdAt: Date.now(),
      text: 'Comment.',
      upvotes: 0,
      downvotes: 0
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: {
            _id: false,
            size: { $size: { $first: '$answerItems.commentItems' } }
          }
        }
      )
    ).resolves.toStrictEqual({ size: 1 });
  });

  it('updates comment count when creating new comment to a question', async () => {
    expect.hasAssertions();

    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Comment.'
    };

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 1 });

    await Backend.createComment({
      question_id: itemToStringId(dummyAppData.questions[1]),
      answer_id: undefined,
      data: newComment
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 2 });
  });

  it('updates sorter uvc/uvac counters when creating a new comment to a question', async () => {
    expect.hasAssertions();

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac }
    } = dummyAppData.questions[1];

    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Comment.'
    };

    await Backend.createComment({
      question_id: itemToStringId(dummyAppData.questions[1]),
      answer_id: undefined,
      data: newComment
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc + 1, uvac: uvac + 1 });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';
    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createComment({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.createComment({
        question_id: undefined,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';
    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();
    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createComment({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.createComment({
        question_id,
        answer_id: undefined,
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();
    const newComment: Required<NewComment> = {
      creator: dummyAppData.users[0].username,
      text: 'Text!'
    };

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });

  it('rejects if the creator is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[2]),
        answer_id: undefined,
        data: {
          creator: 'does-not-exist',
          text: 'Title'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createComment({
        question_id: itemToStringId(dummyAppData.questions[2]),
        answer_id: undefined,
        data: {
          creator: undefined as any,
          text: 'Title'
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidFieldValue('creator')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const { MAX_COMMENT_LENGTH: maxBodyLen } = getEnv();

    const newComments: [NewComment, string][] = [
      [undefined as unknown as NewComment, ErrorMessage.InvalidJSON()],
      ['string data' as unknown as NewComment, ErrorMessage.InvalidJSON()],
      [{} as NewComment, ErrorMessage.InvalidFieldValue('creator')],
      [
        {
          creator: dummyAppData.users[0].username
        } as NewComment,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: ''
        } as NewComment,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: 'x'.repeat(maxBodyLen + 1)
        } as NewComment,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          creator: 'does-not-exist',
          text: 'x'
        } as NewComment,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          creator: dummyAppData.users[0].username,
          text: 'x',
          createdAt: Date.now()
        } as NewComment,
        ErrorMessage.UnknownField('createdAt')
      ]
    ];

    await Promise.all(
      newComments.map(([data, message]) =>
        expect(
          Backend.createComment({
            question_id: itemToStringId(dummyAppData.questions[1]),
            answer_id: undefined,
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteComment', () => {
  it('deletes the specified comment from a question', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[1]) },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 1 });

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[1]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[1].commentItems[0])
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: itemToObjectId(dummyAppData.questions[1]) },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 0 });
  });

  it('deletes the specified comment from an answer', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        {
          projection: {
            _id: false,
            size: { $size: { $first: '$answerItems.commentItems' } }
          }
        }
      )
    ).resolves.toStrictEqual({ size: 1 });

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        {
          projection: {
            _id: false,
            size: { $size: { $first: '$answerItems.commentItems' } }
          }
        }
      )
    ).resolves.toStrictEqual({ size: 0 });
  });

  it('updates comment count when deleting a comment from a question', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 1 });

    await Backend.deleteComment({
      question_id: itemToStringId(dummyAppData.questions[1]),
      answer_id: undefined,
      comment_id: itemToStringId(dummyAppData.questions[1].commentItems[0])
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 0 });
  });

  it('updates sorter uvc/uvac counters when deleting a comment from a question', async () => {
    expect.hasAssertions();

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac }
    } = dummyAppData.questions[1];

    await Backend.deleteComment({
      question_id: itemToStringId(dummyAppData.questions[1]),
      answer_id: undefined,
      comment_id: itemToStringId(dummyAppData.questions[1].commentItems[0])
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[1]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc - 1, uvac: uvac - 1 });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.deleteComment({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.deleteComment({
        question_id: undefined,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });
  });

  it('rejects if comment_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const comment_id = 'does-not-exist';

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(comment_id)
    });

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('comment_id', 'parameter')
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(
      Backend.deleteComment({
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.deleteComment({
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment')
    });
  });
});

describe('::getHowUserVoted', () => {
  it('returns how the user voted on a question or null if there is no vote', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined
      })
    ).resolves.toBeNull();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined
      })
    ).resolves.toBe('upvoted');

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined
      })
    ).resolves.toBe('downvoted');
  });

  it('returns how the user voted on an answer or null if there is no vote', async () => {
    expect.hasAssertions();

    await patchAnswerInDb({
      question_id: itemToObjectId(dummyAppData.questions[0]),
      answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
      updateOps: {
        $inc: { downvotes: 1 },
        $push: { downvoterUsernames: dummyAppData.users[2].username }
      }
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined
      })
    ).resolves.toBeNull();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined
      })
    ).resolves.toBe('upvoted');

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined
      })
    ).resolves.toBe('downvoted');
  });

  it('returns how the user voted on a question comment or null if there is no vote', async () => {
    expect.hasAssertions();

    await patchCommentInDb({
      question_id: itemToObjectId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: itemToObjectId(dummyAppData.questions[0].commentItems[0]),
      updateOps: {
        $inc: { upvotes: 1 },
        $push: { upvoterUsernames: dummyAppData.users[1].username }
      }
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
      })
    ).resolves.toBeNull();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
      })
    ).resolves.toBe('upvoted');

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[0].commentItems[0])
      })
    ).resolves.toBe('downvoted');
  });

  it('returns how the user voted on an answer comment or null if there is no vote', async () => {
    expect.hasAssertions();

    await patchCommentInDb({
      question_id: itemToObjectId(dummyAppData.questions[0]),
      answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
      comment_id: itemToObjectId(
        dummyAppData.questions[0].answerItems[0].commentItems[0]
      ),
      updateOps: {
        $inc: { upvotes: 1, downvotes: 1 },
        $push: {
          upvoterUsernames: dummyAppData.users[1].username,
          downvoterUsernames: dummyAppData.users[2].username
        }
      }
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).resolves.toBeNull();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).resolves.toBe('upvoted');

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).resolves.toBe('downvoted');
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: new ObjectId().toString(),
        comment_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: undefined,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });
  });

  it('rejects if comment_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const comment_id = 'does-not-exist';

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(comment_id)
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment')
    });
  });

  it('rejects if username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getHowUserVoted({
        username: 'does-not-exist',
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.getHowUserVoted({
        username: undefined,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        )
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::applyVotesUpdateOperation', () => {
  it('applies increment/decrement operation to question and updates usernames', async () => {
    expect.hasAssertions();

    const questionsDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection(
      'questions'
    );

    const { upvotes, downvotes, upvoterUsernames, downvoterUsernames } =
      dummyAppData.questions[2];

    const username = dummyAppData.users[0].username;
    const question_id = itemToStringId(dummyAppData.questions[2]);
    const answer_id = undefined;
    const comment_id = undefined;

    const projection = {
      _id: false,
      upvotes: true,
      downvotes: true,
      upvoterUsernames: true,
      downvoterUsernames: true
    };

    await expect(
      questionsDb.findOne(
        { _id: itemToObjectId(dummyAppData.questions[2]) },
        { projection }
      )
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id,
        answer_id,
        comment_id,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      questionsDb.findOne(
        { _id: itemToObjectId(dummyAppData.questions[2]) },
        { projection }
      )
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes,
      upvoterUsernames: [...upvoterUsernames, dummyAppData.users[0].username],
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id,
        answer_id,
        comment_id,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      questionsDb.findOne(
        { _id: itemToObjectId(dummyAppData.questions[2]) },
        { projection }
      )
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id,
        answer_id,
        comment_id,
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      questionsDb.findOne(
        { _id: itemToObjectId(dummyAppData.questions[2]) },
        { projection }
      )
    ).resolves.toStrictEqual({
      upvotes,
      downvotes: downvotes + 1,
      upvoterUsernames,
      downvoterUsernames: [...downvoterUsernames, dummyAppData.users[0].username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id,
        answer_id,
        comment_id,
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      questionsDb.findOne(
        { _id: itemToObjectId(dummyAppData.questions[2]) },
        { projection }
      )
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });
  });

  it('applies increment/decrement operation to answer and updates usernames', async () => {
    expect.hasAssertions();

    const { upvotes, downvotes, upvoterUsernames, downvoterUsernames } =
      dummyAppData.questions[0].answerItems[0];

    const question_id = itemToObjectId(dummyAppData.questions[0]);
    const answer_id = itemToObjectId(dummyAppData.questions[0].answerItems[0]);
    const comment_id = undefined;

    const projection = {
      _id: false,
      upvotes: true,
      downvotes: true,
      upvoterUsernames: true,
      downvoterUsernames: true
    };

    await expect(
      selectAnswerFromDb({ question_id, answer_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[3].username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectAnswerFromDb({ question_id, answer_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes,
      upvoterUsernames: [...upvoterUsernames, dummyAppData.users[3].username],
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id,
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectAnswerFromDb({ question_id, answer_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes: downvotes + 1,
      upvoterUsernames: [...upvoterUsernames, dummyAppData.users[3].username],
      downvoterUsernames: [...downvoterUsernames, dummyAppData.users[2].username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[3].username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectAnswerFromDb({ question_id, answer_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes,
      downvotes: downvotes + 1,
      upvoterUsernames,
      downvoterUsernames: [...downvoterUsernames, dummyAppData.users[2].username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id,
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectAnswerFromDb({ question_id, answer_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });
  });

  it('applies increment/decrement operation to question comment and updates usernames', async () => {
    expect.hasAssertions();

    const { upvotes, downvotes, upvoterUsernames, downvoterUsernames } =
      dummyAppData.questions[0].commentItems[0];

    const question_id = itemToObjectId(dummyAppData.questions[0]);
    const answer_id = undefined;
    const comment_id = itemToObjectId(dummyAppData.questions[0].commentItems[0]);

    const projection = {
      _id: false,
      upvotes: true,
      downvotes: true,
      upvoterUsernames: true,
      downvoterUsernames: true
    };

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(question_id),
        answer_id,
        comment_id: itemToStringId(comment_id),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes,
      upvoterUsernames: [...upvoterUsernames, dummyAppData.users[1].username],
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[3].username,
        question_id: itemToStringId(question_id),
        answer_id,
        comment_id: itemToStringId(comment_id),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes: downvotes + 1,
      upvoterUsernames: [...upvoterUsernames, dummyAppData.users[1].username],
      downvoterUsernames: [...downvoterUsernames, dummyAppData.users[3].username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(question_id),
        answer_id,
        comment_id: itemToStringId(comment_id),
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes: downvotes + 1,
      upvoterUsernames,
      downvoterUsernames: [...downvoterUsernames, dummyAppData.users[3].username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[3].username,
        question_id: itemToStringId(question_id),
        answer_id,
        comment_id: itemToStringId(comment_id),
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });
  });

  it('applies increment/decrement operation to answer comment and updates usernames', async () => {
    expect.hasAssertions();

    const { upvotes, downvotes, upvoterUsernames, downvoterUsernames } =
      dummyAppData.questions[0].answerItems[0].commentItems[0];

    const username = dummyAppData.users[3].username;
    const question_id = itemToObjectId(dummyAppData.questions[0]);
    const answer_id = itemToObjectId(dummyAppData.questions[0].answerItems[0]);
    const comment_id = itemToObjectId(
      dummyAppData.questions[0].answerItems[0].commentItems[0]
    );

    const projection = {
      _id: false,
      upvotes: true,
      downvotes: true,
      upvoterUsernames: true,
      downvoterUsernames: true
    };

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id: itemToStringId(comment_id),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes: upvotes + 1,
      downvotes,
      upvoterUsernames: [...upvoterUsernames, username],
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id: itemToStringId(comment_id),
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id: itemToStringId(comment_id),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes: downvotes + 1,
      upvoterUsernames,
      downvoterUsernames: [...downvoterUsernames, username]
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username,
        question_id: itemToStringId(question_id),
        answer_id: itemToStringId(answer_id),
        comment_id: itemToStringId(comment_id),
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      selectCommentFromDb({ question_id, answer_id, comment_id, projection })
    ).resolves.toStrictEqual({
      upvotes,
      downvotes,
      upvoterUsernames,
      downvoterUsernames
    });
  });

  it('updates sorter uvc/uvac counters ONLY when updating question upvotes', async () => {
    expect.hasAssertions();

    const db = (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions');

    const {
      sorter: { uvc, uvac }
    } = dummyAppData.questions[0];

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: undefined,
      operation: { op: 'increment', target: 'upvotes' }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc: uvc + 1, uvac: uvac + 1 });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: undefined,
      operation: { op: 'decrement', target: 'upvotes' }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc, uvac });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: undefined,
      operation: { op: 'increment', target: 'downvotes' }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc, uvac });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: undefined,
      operation: { op: 'decrement', target: 'downvotes' }
    });

    await expect(
      db.findOne(
        { _id: itemToObjectId(dummyAppData.questions[0]) },
        { projection: { _id: false, uvc: '$sorter.uvc', uvac: '$sorter.uvac' } }
      )
    ).resolves.toStrictEqual({ uvc, uvac });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
      comment_id: undefined,
      operation: { op: 'increment', target: 'upvotes' }
    });

    await expect(
      selectAnswerFromDb({
        question_id: itemToObjectId(dummyAppData.questions[0]),
        answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
        projection: { _id: false, upvotes: true, sorter: true }
      })
    ).resolves.toStrictEqual({
      upvotes: dummyAppData.questions[0].answerItems[0].upvotes + 1
      // * No "sorter"!
    });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
      comment_id: itemToStringId(
        dummyAppData.questions[0].answerItems[0].commentItems[0]
      ),
      operation: { op: 'increment', target: 'upvotes' }
    });

    await expect(
      selectCommentFromDb({
        question_id: itemToObjectId(dummyAppData.questions[0]),
        answer_id: itemToObjectId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToObjectId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        ),
        projection: { _id: false, upvotes: true, sorter: true }
      })
    ).resolves.toStrictEqual({
      upvotes: dummyAppData.questions[0].answerItems[0].commentItems[0].upvotes + 1
      // * No "sorter"!
    });

    await Backend.applyVotesUpdateOperation({
      username: dummyAppData.users[3].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: undefined,
      comment_id: itemToStringId(dummyAppData.questions[0].commentItems[0]),
      operation: { op: 'increment', target: 'upvotes' }
    });

    await expect(
      selectCommentFromDb({
        question_id: itemToObjectId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: itemToObjectId(dummyAppData.questions[0].commentItems[0]),
        projection: { _id: false, upvotes: true, sorter: true }
      })
    ).resolves.toStrictEqual({
      upvotes: dummyAppData.questions[0].commentItems[0].upvotes + 1
      // * No "sorter"!
    });
  });

  it('does not reject when duplicating an increment after first undoing it', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[1].commentItems[1]
        ),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[1].commentItems[1]
        ),
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[1].commentItems[1]
        ),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).resolves.toBeUndefined();
  });

  it('rejects when duplicating increment operation', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[1].commentItems[1]
        ),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[1]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[1].commentItems[0]),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.DuplicateIncrementOperation() });
  });

  it('rejects decrement operations without preceding increment', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidDecrementOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        ),
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidDecrementOperation() });
  });

  it('rejects multi-target decrement operations', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.MultitargetDecrement() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[1].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.MultitargetDecrement() });
  });

  it('rejects when attempting operations on multiple targets', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[2].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.MultipleIncrementTargets() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined,
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.MultipleIncrementTargets() });
  });

  it('rejects when attempting to vote on an entry created by the voter', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.IllegalOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[2]),
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.IllegalOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[1]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[1].commentItems[0]
        ),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.IllegalOperation() });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: undefined,
        comment_id: itemToStringId(dummyAppData.questions[0].commentItems[1]),
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.IllegalOperation() });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: undefined,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'downvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('question_id', 'parameter')
    });
  });

  it('rejects if answer_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString(),
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });
  });

  it('rejects if comment_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    const comment_id = 'does-not-exist';

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id,
        operation: { op: 'decrement', target: 'downvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(comment_id)
    });
  });

  it('rejects if question_id not found', async () => {
    expect.hasAssertions();

    const question_id = new ObjectId().toString();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: undefined,
        comment_id: undefined,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id,
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment')
    });
  });

  it('rejects if username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: 'does-not-exist',
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        ),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: undefined,
        question_id: itemToStringId(dummyAppData.questions[0]),
        answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
        comment_id: itemToStringId(
          dummyAppData.questions[0].answerItems[0].commentItems[0]
        ),
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('rejects if operation is invalid or missing', async () => {
    expect.hasAssertions();

    const params = {
      username: dummyAppData.users[0].username,
      question_id: itemToStringId(dummyAppData.questions[0]),
      answer_id: itemToStringId(dummyAppData.questions[0].answerItems[0]),
      comment_id: itemToStringId(
        dummyAppData.questions[0].answerItems[0].commentItems[0]
      )
    };

    type Op = Parameters<typeof Backend.applyVotesUpdateOperation>[0]['operation'];
    const badOps: [op: Op, error: string][] = [
      [undefined, ErrorMessage.InvalidItem('operation', 'parameter')],
      [
        {},
        ErrorMessage.InvalidFieldValue('op', undefined, ['increment', 'decrement'])
      ],
      [
        { target: 'downvotes' },
        ErrorMessage.InvalidFieldValue('op', undefined, ['increment', 'decrement'])
      ],
      [
        { op: undefined },
        ErrorMessage.InvalidFieldValue('op', undefined, ['increment', 'decrement'])
      ],
      [
        { op: null } as unknown as Op,
        ErrorMessage.InvalidFieldValue('op', undefined, ['increment', 'decrement'])
      ],
      [
        { op: 'fake' } as unknown as Op,
        ErrorMessage.InvalidFieldValue('op', 'fake', ['increment', 'decrement'])
      ],
      [
        { op: 'increment' } as unknown as Op,
        ErrorMessage.InvalidFieldValue('target', undefined, ['upvotes', 'downvotes'])
      ],
      [
        { op: 'increment', target: undefined } as unknown as Op,
        ErrorMessage.InvalidFieldValue('target', undefined, ['upvotes', 'downvotes'])
      ],
      [
        { op: 'increment', target: null } as unknown as Op,
        ErrorMessage.InvalidFieldValue('target', null as any, [
          'upvotes',
          'downvotes'
        ])
      ],
      [
        { op: 'increment', target: 'nope' } as unknown as Op,
        ErrorMessage.InvalidFieldValue('target', 'nope', ['upvotes', 'downvotes'])
      ]
    ];

    await Promise.all(
      badOps.map(async ([op, error]) => {
        await expect(
          Backend.applyVotesUpdateOperation({
            ...params,
            operation: op
          })
        ).rejects.toMatchObject({
          message: error
        });
      })
    );
  });
});
