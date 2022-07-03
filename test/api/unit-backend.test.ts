/* eslint-disable no-await-in-loop */
import { ObjectId } from 'mongodb';

import * as Backend from 'universe/backend';
import { toPublicUser } from 'universe/backend/db';
import { getEnv } from 'universe/backend/env';
import { ErrorMessage } from 'universe/error';

import { useMockDateNow } from 'multiverse/mongo-common';
import { getDb } from 'multiverse/mongo-schema';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';

import { dummyAppData } from 'testverse/db';
import { mockEnvFactory } from 'testverse/setup';

import type { PublicUser, Username, NewUser, PatchUser } from 'universe/backend/db';

setupMemoryServerOverride();
useMockDateNow();

const withMockedEnv = mockEnvFactory({ NODE_ENV: 'test' });

describe('::getAllUsers', () => {
  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getAllUsers({ after: undefined })
    ).resolves.not.toStrictEqual([]);

    await (await getDb({ name: 'hscc-api-qoverflow' }))
      .collection('users')
      .deleteMany({});
    await expect(Backend.getAllUsers({ after: undefined })).resolves.toStrictEqual(
      []
    );
  });

  it('returns all users', async () => {
    expect.hasAssertions();

    await expect(Backend.getAllUsers({ after: undefined })).resolves.toStrictEqual(
      sortedUsers.map(toPublicUser)
    );
  });

  it('supports pagination', async () => {
    expect.hasAssertions();

    await withMockedEnv(
      async () => {
        expect([
          await Backend.getAllUsers({ after: undefined }),
          await Backend.getAllUsers({
            after: sortedUsers[0]._id.toString()
          }),
          await Backend.getAllUsers({
            after: sortedUsers[1]._id.toString()
          })
        ]).toStrictEqual(sortedUsers.slice(-3).map((user) => [toPublicUser(user)]));
      },
      { RESULTS_PER_PAGE: '1' }
    );
  });

  it('rejects if after user_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(Backend.getAllUsers({ after: 'fake-oid' })).rejects.toMatchObject({
      message: ErrorMessage.InvalidObjectId('fake-oid')
    });
  });

  it('rejects if after user_id not found', async () => {
    expect.hasAssertions();

    const after = new ObjectId().toString();

    await expect(Backend.getAllUsers({ after })).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(after, 'user_id')
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
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::getUserAnswers', () => {
  it('', async () => {
    expect.hasAssertions();
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
      salt: newUser.salt
    });

    await expect(
      (await getDb({ name: 'hscc-api-qoverflow' }))
        .collection('users')
        .countDocuments({ username: 'new-user' })
    ).resolves.toBe(1);
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

  it('rejects when attempting to create a user named "public"', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createUser({
        data: {
          username: 'public',
          email: 'new-user@email.com',
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.IllegalUsername() });
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
});

describe('::updateUser', () => {
  it('updates an existing user', async () => {
    expect.hasAssertions();

    const usersDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection('users');

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        email: 'fake@email.com'
      })
    ).resolves.toBe(0);

    await expect(
      Backend.updateUser({
        username: dummyAppData.users[0].username,
        data: {
          email: 'fake@email.com',
          key: '0'.repeat(getEnv().USER_KEY_LENGTH),
          salt: '0'.repeat(getEnv().USER_SALT_LENGTH)
        }
      })
    ).resolves.toBeUndefined();

    await expect(
      usersDb.countDocuments({
        username: dummyAppData.users[0].username,
        email: 'fake@email.com'
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

  it('returns immediately is no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateUser({
        username: undefined,
        data: {}
      })
    ).resolves.toBeUndefined();
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
      [{ data: 1 } as NewUser, ErrorMessage.UnknownField('data')],
      [{ name: 'username' } as NewUser, ErrorMessage.UnknownField('name')],
      [
        {
          email: 'valid@email.address',
          salt: '0'.repeat(saltLen),
          key: '0'.repeat(keyLen),
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

  it('deleted users are removed from all permissions objects', async () => {
    expect.hasAssertions();

    const user = dummyAppData.users[0].username;

    const numFileNodePerms = dummyAppData['file-nodes'].filter(
      ({ permissions }) => !!permissions[user]
    ).length;

    const numMetaNodePerms = dummyAppData['file-nodes'].filter(
      ({ permissions }) => !!permissions[user]
    ).length;

    expect(numFileNodePerms).toBeGreaterThan(0);
    expect(numMetaNodePerms).toBeGreaterThan(0);

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const metaNodeDb = db.collection('meta-nodes');

    await expect(
      fileNodeDb.countDocuments({ [`permissions.${user}`]: { $exists: true } })
    ).resolves.toBe(numFileNodePerms);

    await expect(
      metaNodeDb.countDocuments({ [`permissions.${user}`]: { $exists: true } })
    ).resolves.toBe(numMetaNodePerms);

    await expect(Backend.deleteUser({ username: user })).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({ [`permissions.${user}`]: { $exists: true } })
    ).resolves.toBe(0);

    await expect(
      metaNodeDb.countDocuments({ [`permissions.${user}`]: { $exists: true } })
    ).resolves.toBe(0);
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
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::createMessage', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::searchQuestions', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::getQuestion', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::createQuestion', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::updateQuestion', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::getAnswers', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::createAnswer', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::updateAnswer', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::getComments', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::createComment', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::deleteComment', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});

describe('::applyVotesUpdateOperation', () => {
  it('', async () => {
    expect.hasAssertions();
  });
});
