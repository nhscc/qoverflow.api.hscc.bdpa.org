/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
import { ObjectId } from 'mongodb';

import * as Backend from 'universe/backend';
import {
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
  toPublicUser
} from 'universe/backend/db';
import { getEnv } from 'universe/backend/env';
import { ErrorMessage } from 'universe/error';

import { useMockDateNow } from 'multiverse/mongo-common';
import { getDb } from 'multiverse/mongo-schema';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';

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
            after_id: sortedUsers[0]._id.toString()
          }),
          await Backend.getAllUsers({
            after_id: sortedUsers[1]._id.toString()
          })
        ]).toStrictEqual(sortedUsers.slice(-3).map((user) => [toPublicUser(user)]));
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
            after_id: dummyAppData.users[1].questionIds[1].toString()
          }),
          await Backend.getUserQuestions({
            username: dummyAppData.users[0].username,
            after_id: dummyAppData.users[1].questionIds[0].toString()
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
            after_id: dummyAppData.users[1].answerIds[1].toString()
          }),
          await Backend.getUserAnswers({
            username: dummyAppData.users[1].username,
            after_id: dummyAppData.users[1].answerIds[0].toString()
          })
        ]).toStrictEqual([
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
        ErrorMessage.InvalidStringLength('username', minULen, maxULen)
      ],
      [
        {
          username: '#&*@^(#@(^$&*#',
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen)
      ],
      [
        {
          username: null,
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        } as unknown as NewUser,
        ErrorMessage.InvalidStringLength('username', minULen, maxULen)
      ],
      [
        {
          username: 'x'.repeat(minULen - 1),
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen)
      ],
      [
        {
          username: 'x'.repeat(maxULen + 1),
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen)
        },
        ErrorMessage.InvalidStringLength('username', minULen, maxULen)
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
        username: undefined,
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
      [{ points: -1 }, ErrorMessage.InvalidNumberValue('points', 0, null)],
      [
        { points: null as unknown as number },
        ErrorMessage.InvalidNumberValue('points', 0, null)
      ],
      [
        { points: '10' as unknown as number },
        ErrorMessage.InvalidNumberValue('points', 0, null)
      ],
      [
        { points: {} as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null)
      ],
      [
        { points: { amount: 5 } as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null)
      ],
      [
        {
          points: {
            amount: '5',
            op: 'decrement'
          } as unknown as PointsUpdateOperation
        },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null)
      ],
      [
        { points: { op: 'decrement' } as PointsUpdateOperation },
        ErrorMessage.InvalidNumberValue('points.amount', 0, null)
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
        ErrorMessage.InvalidNumberValue('points.amount', 0, null)
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
      usersDb.countDocuments({ _id: dummyAppData.users[0]._id })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteUser({ username: dummyAppData.users[0].username })
    ).resolves.toBeUndefined();

    await expect(
      usersDb.countDocuments({ _id: dummyAppData.users[0]._id })
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
            after_id: dummyAppData.questions[1]._id.toString()
          }),
          await Backend.getUserMessages({
            username: dummyAppData.users[0].username,
            after_id: dummyAppData.questions[0]._id.toString()
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
          receiver: 'does-not-exist',
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
          receiver: 'does-not-exist',
          sender: dummyAppData.users[0].username,
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
        { receiver: 'does-not-exist' } as NewMail,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        { receiver: dummyAppData.users[0].username } as NewMail,
        ErrorMessage.InvalidFieldValue('sender')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: 'does-not-exist'
        } as NewMail,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', maxSubjectLen, null, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: dummyAppData.users[0].username,
          subject: ''
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', maxSubjectLen, null, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: 'does-not-exist',
          subject: 'x'.repeat(maxSubjectLen + 1)
        } as NewMail,
        ErrorMessage.InvalidStringLength('subject', maxSubjectLen, null, 'string')
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
          sender: 'does-not-exist',
          subject: 'x',
          text: 'x'.repeat(maxBodyLen + 1)
        } as NewMail,
        ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
      ],
      [
        {
          receiver: dummyAppData.users[0].username,
          sender: 'does-not-exist',
          subject: 'x',
          text: 'x',
          createdAt: Date.now()
        } as NewMail,
        ErrorMessage.UnknownField('createdAt')
      ]
    ];

    await Promise.all(
      newMailMessages.map(([data, message]) =>
        expect(Backend.createMessage({ data })).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::searchQuestions', () => {
  it('returns all questions if no query params given', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        await expect(
          Backend.searchNodes({
            username: dummyAppData.users[2].username,
            after: undefined,
            match: {},
            regexMatch: {}
          })
        ).resolves.toStrictEqual(
          getOwnedAndSharedNodes(dummyAppData.users[2].username)
            .slice(0, 4)
            .map(toPublicNode)
        );
      },
      { RESULTS_PER_PAGE: '4' }
    );
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        let prevNode: PublicNode | null = null;
        const nodes = getOwnedAndSharedNodes(dummyAppData.users[2].username).map(
          toPublicNode
        );

        for (const node of nodes) {
          await expect(
            Backend.searchNodes({
              username: dummyAppData.users[2].username,
              after: prevNode ? prevNode.node_id : undefined,
              match: {},
              regexMatch: {}
            })
          ).resolves.toStrictEqual([node]);
          prevNode = node;
        }

        await expect(
          Backend.searchNodes({
            username: dummyAppData.users[2].username,
            after: prevNode ? prevNode.node_id : undefined,
            match: {},
            regexMatch: {}
          })
        ).resolves.toStrictEqual([]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-drive' });
    const fileNodeDb = db.collection('file-nodes');
    const metaNodeDb = db.collection('meta-nodes');

    await fileNodeDb.deleteMany({});
    await metaNodeDb.deleteMany({});

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: {},
        regexMatch: {}
      })
    ).resolves.toStrictEqual([]);
  });

  it('returns expected questions when matching using proxied fields', async () => {
    expect.hasAssertions();
  });

  it('returns expected questions when using match and regexMatch simultaneously', async () => {
    expect.hasAssertions();

    const regex = /(view|edit)/im;

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: { createdAt: { $lt: Date.now() } },
        regexMatch: { 'permissions.User2': 'view|edit' }
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => n.createdAt < Date.now() && regex.test(n.permissions?.User2))
        .map(toPublicNode)
    );
  });

  it('returns expected questions when matching case-insensitively by title', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: { name: 'USER1-FILE1' },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter((n) => n['name-lowercase'] == 'user1-file1')
        .map(toPublicNode)
    );
  });

  it('returns expected questions when matching conditioned on createdAt', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: { createdAt: { $lt: Date.now() - 5000, $gt: Date.now() - 10000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter(
          (n) => n.createdAt < Date.now() - 5000 && n.createdAt > Date.now() - 10000
        )
        .map(toPublicNode)
    );

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: { modifiedAt: { $lt: Date.now() - 500, $gt: Date.now() - 1000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter(
          (n) =>
            n.type == 'file' &&
            n.modifiedAt < Date.now() - 500 &&
            n.modifiedAt > Date.now() - 1000
        )
        .map(toPublicNode)
    );
  });

  it('supports special "$gt", "$gte", "$lt", "$lte" sub-matcher', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: { createdAt: { $lt: Date.now() - 10000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => n.createdAt < Date.now() - 10000)
        .map(toPublicNode)
    );

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: { createdAt: { $lte: Date.now() - 10000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => n.createdAt <= Date.now() - 10000)
        .map(toPublicNode)
    );

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: { createdAt: { $gt: Date.now() - 10000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => n.createdAt > Date.now() - 10000)
        .map(toPublicNode)
    );

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: { createdAt: { $gte: Date.now() - 10000 } },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => n.createdAt >= Date.now() - 10000)
        .map(toPublicNode)
    );
  });

  it('supports special "$or" sub-matcher', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: {
          createdAt: {
            $or: [{ $lt: Date.now() - 10000 }, { $gt: Date.now() - 5000 }]
          }
        },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter(
          (n) => n.createdAt < Date.now() - 10000 || n.createdAt > Date.now() - 5000
        )
        .map(toPublicNode)
    );
  });

  it('supports multi-line case-insensitive regular expression matching of text via regexMatch', async () => {
    expect.hasAssertions();

    const regex = /^cause look.*$/im;

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: {},
        regexMatch: { text: '^cause look.*$' }
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter((n) => n.type == 'file' && regex.test(n.text))
        .map(toPublicNode)
    );
  });

  it('returns results sorted by insertion order (question_id, latest first) by default', async () => {
    expect.hasAssertions();
  });

  it('supports sorting results by upvotes, upvotes+views+comments, and upvotes+views+answers+comments (highest first)', async () => {
    expect.hasAssertions();
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: 'fake-user',
        after: 'fake-oid',
        match: {},
        regexMatch: {}
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after_id not found', async () => {
    expect.hasAssertions();

    const after = new ObjectId().toString();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after,
        match: {},
        regexMatch: {}
      })
    ).rejects.toMatchObject({ message: ErrorMessage.ItemNotFound(after, 'node_id') });
  });

  it('rejects when using match/regexMatch with disallowed, unknown, or non-proxied fields', async () => {
    expect.hasAssertions();

    const matchers: [
      match: Parameters<typeof Backend.searchNodes>[0]['match'],
      regexMatch: Parameters<typeof Backend.searchNodes>[0]['regexMatch'],
      errorMessage: string
    ][] = [
      [
        { node_id: new ObjectId().toString() },
        {},
        ErrorMessage.UnknownSpecifier('node_id')
      ],
      [
        {},
        { node_id: new ObjectId().toString() },
        ErrorMessage.UnknownSpecifier('node_id')
      ],
      [{ lock: {} }, {}, ErrorMessage.UnknownSpecifier('lock')],
      [{}, { lock: '' }, ErrorMessage.UnknownSpecifier('lock')],
      [{ contents: '' }, {}, ErrorMessage.UnknownSpecifier('contents')],
      [{}, { contents: '' }, ErrorMessage.UnknownSpecifier('contents')],
      [{ permissions: '' }, {}, ErrorMessage.UnknownPermissionsSpecifier()],
      [{}, { permissions: '' }, ErrorMessage.UnknownPermissionsSpecifier()],
      [{}, { createdAt: 'User1' }, ErrorMessage.UnknownSpecifier('createdAt')],
      [{}, { modifiedAt: 'User1' }, ErrorMessage.UnknownSpecifier('modifiedAt')],
      [{}, { size: 'User1' }, ErrorMessage.UnknownSpecifier('size')]
    ];

    await Promise.all(
      matchers.map(([match, regexMatch, message]) =>
        expect(
          Backend.searchNodes({
            username: dummyAppData.users[0].username,
            after: undefined,
            match,
            regexMatch
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
        { tags: 1 },
        [
          ErrorMessage.InvalidSpecifierValueType('tags', 'an array'),
          ErrorMessage.UnknownSpecifier('tags')
        ]
      ],
      [
        {
          tags: Array.from({ length: getEnv().MAX_SEARCHABLE_TAGS + 1 }).map(
            (_, ndx) => ndx.toString()
          )
        },
        [
          ErrorMessage.TooManyItemsRequested('searchable tags'),
          ErrorMessage.UnknownSpecifier('tags')
        ]
      ],
      [
        { permissions: {} },
        [
          ErrorMessage.UnknownPermissionsSpecifier(),
          ErrorMessage.UnknownPermissionsSpecifier()
        ]
      ],
      [
        { 'permissions.User1': 'view', 'permissions.User2': 'edit' },
        [
          ErrorMessage.TooManyItemsRequested('permissions specifiers'),
          ErrorMessage.TooManyItemsRequested('permissions specifiers')
        ]
      ],
      [
        { type: /nope/g },
        [
          ErrorMessage.InvalidSpecifierValueType(
            'type',
            'a number, string, boolean, or sub-specifier object'
          ),
          ErrorMessage.InvalidRegexString('type')
        ]
      ],
      [
        { size: {} },
        [
          ErrorMessage.InvalidSpecifierValueType('size', 'a non-empty object'),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $in: [5] } },
        [
          ErrorMessage.UnknownSpecifier('$in', true),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $lt: [5] } },
        [
          ErrorMessage.InvalidSpecifierValueType('$lt', 'a number', true),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: { $gt: 6 } } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('size')]
      ],
      [
        { size: { $or: [{ $gt: 6 }, { $gt: 6 }, { $gt: 6 }] } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('size')]
      ],
      [
        { size: { $or: ['b', { $gt: 6 }] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(0),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ $gt: 6 }, 'b'] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(1),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ $gt: 6 }, { $gt: 6, $lte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierBadLength(1),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ $gt: 7 }, undefined] } },
        [
          ErrorMessage.InvalidOrSpecifierNonObject(1),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{}] } },
        [ErrorMessage.InvalidOrSpecifier(), ErrorMessage.UnknownSpecifier('size')]
      ],
      [
        { size: { $or: [{}, {}] } },
        [
          ErrorMessage.InvalidSpecifierValueType('size', 'a non-empty object'),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ bad: 1 }, { $gte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidKey(0, 'bad'),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ $gte: 5 }, { bad: 1 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidKey(1, 'bad'),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ],
      [
        { size: { $or: [{ $gte: 'bad' }, { $gte: 5 }] } },
        [
          ErrorMessage.InvalidOrSpecifierInvalidValueType(0, '$gte'),
          ErrorMessage.UnknownSpecifier('size')
        ]
      ]
    ];

    await Promise.all(
      matchers.flatMap(([matcher, [matchMessage, regexMatchMessage]]) => {
        return [
          // eslint-disable-next-line jest/valid-expect
          expect(
            Backend.searchNodes({
              username: dummyAppData.users[0].username,
              after: undefined,
              match: matcher,
              regexMatch: {}
            })
          ).rejects.toMatchObject({ message: matchMessage }),
          // eslint-disable-next-line jest/valid-expect
          expect(
            Backend.searchNodes({
              username: dummyAppData.users[0].username,
              after: undefined,
              match: {},
              regexMatch: matcher
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
      Backend.getQuestion({ question_id: dummyAppData.questions[1]._id.toString() })
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
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
      questionIds: expect.arrayContaining([new ObjectId(newQuestion.question_id)])
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
      [{} as NewQuestion, ErrorMessage.InvalidFieldValue('creator')],
      [
        { creator: 'does-not-exist' } as NewQuestion,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          creator: dummyAppData.users[0].username
        } as NewQuestion,
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
        .countDocuments({ _id: dummyAppData.questions[0]._id, ...patchQuestion })
    ).resolves.toBe(0);

    await expect(
      Backend.updateQuestion({
        question_id: dummyAppData.questions[0]._id.toString(),
        data: patchQuestion
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .countDocuments({ _id: dummyAppData.questions[0]._id, ...patchQuestion })
    ).resolves.toBe(1);
  });

  it('supports ViewsUpdateOperation updates alongside normal views updates', async () => {
    expect.hasAssertions();

    const questionsDb = (
      await getDb({ name: 'hscc-api-qoverflow' })
    ).collection<InternalQuestion>('questions');

    await expect(
      questionsDb.countDocuments({
        _id: dummyAppData.questions[0]._id,
        views: dummyAppData.questions[0].views + 1
      })
    ).resolves.toBe(0);

    await expect(
      questionsDb.countDocuments({
        _id: dummyAppData.questions[0]._id,
        views: 0
      })
    ).resolves.toBe(0);

    await Backend.updateQuestion({
      question_id: dummyAppData.questions[0]._id.toString(),
      data: { views: 'increment' }
    });

    await expect(
      questionsDb.countDocuments({
        _id: dummyAppData.questions[0]._id,
        views: dummyAppData.questions[0].views + 1
      })
    ).resolves.toBe(1);

    await Backend.updateQuestion({
      question_id: dummyAppData.questions[0]._id.toString(),
      data: { views: 0 }
    });

    await expect(
      questionsDb.countDocuments({
        _id: dummyAppData.questions[0]._id,
        views: 0
      })
    ).resolves.toBe(1);
  });

  it('does not reject if no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateQuestion({
        question_id: dummyAppData.questions[0]._id.toString(),
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
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
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { upvotes: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { upvotes: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { downvotes: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ],
      [
        { downvotes: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ],
      [
        { downvotes: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ],
      [
        { views: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null)
      ],
      [
        { views: -1 } as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null)
      ],
      [
        { views: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidNumberValue('views', 0, null)
      ],
      [
        { status: null } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, [
          'closed',
          'open',
          'protected'
        ])
      ],
      [
        { status: -1 } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, [
          'closed',
          'open',
          'protected'
        ])
      ],
      [
        { status: '5' } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, [
          'closed',
          'open',
          'protected'
        ])
      ],
      [
        { status: '' } as unknown as PatchQuestion,
        ErrorMessage.InvalidFieldValue('status', undefined, [
          'closed',
          'open',
          'protected'
        ])
      ]
    ];

    await Promise.all(
      patchQuestions.map(([data, message]) =>
        expect(
          Backend.updateQuestion({
            question_id: dummyAppData.questions[0]._id.toString(),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::getAnswers', () => {
  it("returns all of the specified question's answers in order (oldest first)", async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({
        question_id: dummyAppData.questions[0]._id.toString(),
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicAnswer(dummyAppData.questions[0].answerItems[0]),
      toPublicAnswer(dummyAppData.questions[0].answerItems[1]),
      toPublicAnswer(dummyAppData.questions[0].answerItems[2])
    ]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getAnswers({
            question_id: dummyAppData.questions[0]._id.toString(),
            after_id: undefined
          }),
          await Backend.getAnswers({
            question_id: dummyAppData.questions[0]._id.toString(),
            after_id: dummyAppData.questions[0]._id.toString()
          }),
          await Backend.getAnswers({
            question_id: dummyAppData.questions[0]._id.toString(),
            after_id: dummyAppData.questions[1]._id.toString()
          })
        ]).toStrictEqual([
          [toPublicAnswer(dummyAppData.questions[0].answerItems[0])],
          [toPublicAnswer(dummyAppData.questions[0].answerItems[1])],
          [toPublicAnswer(dummyAppData.questions[0].answerItems[2])]
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAnswers({
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
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
          { _id: dummyAppData.questions[2]._id },
          { projection: { _id: false, size: { $size: '$answerItems' } } }
        )
    ).resolves.toStrictEqual({ size: 0 });

    await expect(
      Backend.createAnswer({
        question_id: dummyAppData.questions[2]._id.toString(),
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
          { _id: dummyAppData.questions[2]._id },
          { projection: { size: { $size: '$answerItems' } } }
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
          { _id: dummyAppData.questions[1]._id },
          { projection: { _id: false, answers: true } }
        )
    ).resolves.toStrictEqual({ answers: 1 });

    await Backend.createAnswer({
      question_id: dummyAppData.questions[1]._id.toString(),
      data: newAnswer
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: dummyAppData.questions[1]._id },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 2 });
  });

  it("updates user's answers array when they create a new answer", async () => {
    expect.hasAssertions();

    const newAnswer = await Backend.createAnswer({
      question_id: dummyAppData.questions[1]._id.toString(),
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
      answerIds: expect.arrayContaining([new ObjectId(newAnswer.answer_id)])
    });
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if the creator is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createAnswer({
        question_id: dummyAppData.questions[2]._id.toString(),
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
        question_id: dummyAppData.questions[2]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
      [{} as NewAnswer, ErrorMessage.InvalidFieldValue('creator')],
      [
        { creator: 'does-not-exist' } as NewAnswer,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
      [
        {
          creator: dummyAppData.users[0].username
        } as NewAnswer,
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
            question_id: dummyAppData.questions[2]._id.toString(),
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
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalQuestion>('questions')
        .findOne(
          {
            _id: dummyAppData.questions[0]._id,
            'answerItems._id': dummyAppData.questions[0].answerItems[0]._id
          },
          { projection: { _id: false, 'answerItems.$': true } }
        )
    ).resolves.not.toStrictEqual({
      answerItems: [expect.objectContaining(patchAnswer)]
    });

    await expect(
      Backend.updateAnswer({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        data: patchAnswer
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalQuestion>('questions')
        .findOne(
          {
            _id: dummyAppData.questions[0]._id,
            'answerItems._id': dummyAppData.questions[0].answerItems[0]._id
          },
          { projection: { _id: false, 'answerItems.$': true } }
        )
    ).resolves.toStrictEqual({ answerItems: [expect.objectContaining(patchAnswer)] });
  });

  it('does not reject if no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateAnswer({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
          { _id: dummyAppData.questions[0]._id },
          { projection: { _id: false, hasAcceptedAnswer: true } }
        )
    ).resolves.toStrictEqual({ hasAcceptedAnswer: false });

    await Backend.updateAnswer({
      question_id: dummyAppData.questions[0]._id.toString(),
      answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
      data: patchAnswer
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection<InternalQuestion>('questions')
        .findOne(
          { _id: dummyAppData.questions[0]._id },
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
        { _id: dummyAppData.questions[0]._id },
        { $set: { hasAcceptedAnswer: true } }
      );

    await expect(
      Backend.updateAnswer({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if answer_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const answer_id = 'does-not-exist';
    const patchAnswer: PatchAnswer = { text: 'Text!' };

    await expect(
      Backend.updateAnswer({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(answer_id)
    });

    await expect(
      Backend.updateAnswer({
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        data: patchAnswer
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer_id')
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
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { upvotes: -1 } as PatchAnswer,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { upvotes: '5' } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('upvotes', 0, null)
      ],
      [
        { downvotes: null } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ],
      [
        { downvotes: -1 } as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ],
      [
        { downvotes: '5' } as unknown as PatchAnswer,
        ErrorMessage.InvalidNumberValue('downvotes', 0, null)
      ]
    ];

    await Promise.all(
      patchAnswers.map(([data, message]) =>
        expect(
          Backend.updateAnswer({
            question_id: dummyAppData.questions[2]._id.toString(),
            answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::getComments', () => {
  it("returns all of the specified question's comments in order (oldest first)", async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
        after_id: undefined
      })
    ).resolves.toStrictEqual([
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[0]),
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[1]),
      toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[2])
    ]);
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getComments({
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: undefined,
            after_id: undefined
          }),
          await Backend.getComments({
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: undefined,
            after_id: dummyAppData.questions[0]._id.toString()
          }),
          await Backend.getComments({
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: undefined,
            after_id: dummyAppData.questions[1]._id.toString()
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
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
            after_id: undefined
          }),
          await Backend.getComments({
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
            after_id: dummyAppData.questions[0]._id.toString()
          }),
          await Backend.getComments({
            question_id: dummyAppData.questions[0]._id.toString(),
            answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
            after_id: dummyAppData.questions[1]._id.toString()
          })
        ]).toStrictEqual([
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[0])],
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[1])],
          [toPublicComment(dummyAppData.questions[0].answerItems[1].commentItems[2])]
        ]);
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after_id is not a valid ObjectId (undefined is okay)', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getComments({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: undefined,
        after_id: 'fake-oid'
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });

    await expect(
      Backend.getComments({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: undefined,
        after_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after_id, 'comment_id')
    });

    await expect(
      Backend.getComments({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[1]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.getComments({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        after_id: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'question_id')
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
          { _id: dummyAppData.questions[1]._id },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 1 });

    await expect(
      Backend.createComment({
        question_id: dummyAppData.questions[1]._id.toString(),
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
          { _id: dummyAppData.questions[1]._id },
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
        { _id: dummyAppData.questions[1]._id },
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
        question_id: dummyAppData.questions[1]._id.toString(),
        answer_id: dummyAppData.questions[1].answerItems[0]._id.toString(),
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
        { _id: dummyAppData.questions[1]._id },
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
        { _id: dummyAppData.questions[1]._id },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 1 });

    await Backend.createComment({
      question_id: dummyAppData.questions[1]._id.toString(),
      answer_id: undefined,
      data: newComment
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: dummyAppData.questions[1]._id },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 2 });
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.createComment({
        question_id: undefined,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        data: newComment
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer_id')
    });
  });

  it('rejects if the creator is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createComment({
        question_id: dummyAppData.questions[2]._id.toString(),
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
        question_id: dummyAppData.questions[2]._id.toString(),
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
        { creator: 'does-not-exist' } as NewComment,
        ErrorMessage.ItemNotFound('does-not-exist', 'user')
      ],
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
            question_id: dummyAppData.questions[1]._id.toString(),
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
          { _id: dummyAppData.questions[1]._id },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 1 });

    await expect(
      Backend.deleteComment({
        question_id: dummyAppData.questions[1]._id.toString(),
        answer_id: undefined,
        comment_id: dummyAppData.questions[1].commentItems[0]._id.toString()
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('questions')
        .findOne(
          { _id: dummyAppData.questions[1]._id },
          { projection: { _id: false, size: { $size: '$commentItems' } } }
        )
    ).resolves.toStrictEqual({ size: 0 });
  });

  it('deletes the specified comment from an answer', async () => {
    expect.hasAssertions();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: dummyAppData.questions[0]._id },
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id:
          dummyAppData.questions[0].answerItems[0].commentItems[0]._id.toString()
      })
    ).resolves.toBeUndefined();

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: dummyAppData.questions[0]._id },
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
        { _id: dummyAppData.questions[1]._id },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 1 });

    await Backend.deleteComment({
      question_id: dummyAppData.questions[1]._id.toString(),
      answer_id: undefined,
      comment_id: dummyAppData.questions[1].commentItems[0]._id.toString()
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' })).collection('questions').findOne(
        { _id: dummyAppData.questions[1]._id },
        {
          projection: { _id: false, comments: true }
        }
      )
    ).resolves.toStrictEqual({ comments: 0 });
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.deleteComment({
        question_id,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.deleteComment({
        question_id: undefined,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(comment_id)
    });

    await expect(
      Backend.deleteComment({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.deleteComment({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer_id')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.deleteComment({
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment_id')
    });
  });
});

describe('::getHowUserVoted', () => {
  it('returns how the user voted on a question or null if there is no vote', async () => {
    expect.hasAssertions();
  });

  it('returns how the user voted on an answer or null if there is no vote', async () => {
    expect.hasAssertions();
  });

  it('returns how the user voted on a comment or null if there is no vote', async () => {
    expect.hasAssertions();
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId(question_id)
    });

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: undefined,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        comment_id: new ObjectId().toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer_id')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.getHowUserVoted({
        username: dummyAppData.users[0].username,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment_id')
    });
  });

  it('rejects if username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getHowUserVoted({
        username: 'does-not-exist',
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id:
          dummyAppData.questions[0].answerItems[0].commentItems[0]._id.toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.getHowUserVoted({
        username: undefined,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id:
          dummyAppData.questions[0].answerItems[0].commentItems[0]._id.toString()
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});

describe('::applyVotesUpdateOperation', () => {
  it('applies increment/decrement operation to question and updates ids', async () => {
    expect.hasAssertions();
  });

  it('applies increment/decrement operation to answer and updates ids', async () => {
    expect.hasAssertions();
  });

  it('applies increment/decrement operation to comment and updates ids', async () => {
    expect.hasAssertions();
  });

  it('rejects when duplicating an operation to an entry by a user', async () => {
    expect.hasAssertions();
  });

  it('does not reject when duplicating an operation after first undoing it', async () => {
    expect.hasAssertions();
  });

  it('rejects when a decrement operation would result in a negative value', async () => {
    expect.hasAssertions();
  });

  it('rejects if question_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    const question_id = 'does-not-exist';

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id,
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
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
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
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
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(question_id, 'question_id')
    });
  });

  it('rejects if answer_id not found', async () => {
    expect.hasAssertions();

    const answer_id = new ObjectId().toString();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id,
        comment_id: new ObjectId().toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(answer_id, 'answer_id')
    });
  });

  it('rejects if comment_id not found', async () => {
    expect.hasAssertions();

    const comment_id = new ObjectId().toString();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: dummyAppData.users[0].username,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id,
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(comment_id, 'comment_id')
    });
  });

  it('rejects if username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.applyVotesUpdateOperation({
        username: 'does-not-exist',
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id:
          dummyAppData.questions[0].answerItems[0].commentItems[0]._id.toString(),
        operation: { op: 'increment', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.applyVotesUpdateOperation({
        username: undefined,
        question_id: dummyAppData.questions[0]._id.toString(),
        answer_id: dummyAppData.questions[0].answerItems[0]._id.toString(),
        comment_id:
          dummyAppData.questions[0].answerItems[0].commentItems[0]._id.toString(),
        operation: { op: 'decrement', target: 'upvotes' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });
});
