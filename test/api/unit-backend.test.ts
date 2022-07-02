/* eslint-disable no-await-in-loop */
import { ObjectId } from 'mongodb';
import { useMockDateNow } from 'multiverse/mongo-common';
import { getDb } from 'multiverse/mongo-schema';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { dummyAppData } from 'testverse/db';
import { mockEnvFactory } from 'testverse/setup';
import { toPublicUser } from 'universe/backend/db';
import { getEnv } from 'universe/backend/env';
import { ErrorMessage } from 'universe/error';

import * as Backend from 'universe/backend';

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

describe('::getNodes', () => {
  it('returns one or more nodes by node_id', async () => {
    expect.hasAssertions();

    const testNodes: [Username, InternalNode[]][] = [
      [dummyAppData['file-nodes'][0].owner, dummyAppData['file-nodes'].slice(0, 2)],
      [dummyAppData['file-nodes'][2].owner, []],
      [dummyAppData['file-nodes'][2].owner, [dummyAppData['file-nodes'][2]]],
      [
        dummyAppData['file-nodes'][3].owner,
        [...dummyAppData['file-nodes'].slice(3), ...dummyAppData['meta-nodes']]
      ]
    ];

    await Promise.all(
      testNodes.map(([username, nodes]) =>
        expect(
          Backend.getNodes({ username, node_ids: nodes.map((n) => n._id.toString()) })
        ).resolves.toStrictEqual(sortNodes(nodes).map(toPublicNode))
      )
    );
  });

  it('rejects if one or more node_ids are not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: ['bad']
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidObjectId('bad') });

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString(), 'bad']
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidObjectId('bad') });
  });

  it('rejects if one or more node_ids missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [new ObjectId().toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemOrItemsNotFound('node_ids')
    });

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [
          dummyAppData['file-nodes'][0]._id.toString(),
          new ObjectId().toString()
        ]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemOrItemsNotFound('node_ids')
    });

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('node_ids', 'parameter')
    });
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: 'does-not-exist',
        node_ids: [dummyAppData['file-nodes'][0]._id.toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.getNodes({
        username: undefined,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('rejects if node_id not owned by username', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][2].owner,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemOrItemsNotFound('node_ids')
    });
  });

  it('does not reject if node_id not owned when user has view/edit permission', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: 'User2',
        node_ids: [dummyAppData['file-nodes'][3]._id.toString()]
      })
    ).resolves.toStrictEqual([toPublicNode(dummyAppData['file-nodes'][3])]);

    await expect(
      Backend.getNodes({
        username: 'User2',
        node_ids: [dummyAppData['meta-nodes'][1]._id.toString()]
      })
    ).resolves.toStrictEqual([toPublicNode(dummyAppData['meta-nodes'][1])]);
  });

  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });

    await db.collection('file-nodes').deleteMany({});
    await db.collection('meta-nodes').deleteMany({});

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemOrItemsNotFound('node_ids')
    });

    await db.collection('users').deleteMany({});

    await expect(
      Backend.getNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString()]
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(dummyAppData['file-nodes'][0].owner, 'user')
    });
  });

  it('rejects if too many node_ids requested', async () => {
    expect.hasAssertions();

    await expect(
      Backend.getNodes({
        username: 'User1',
        node_ids: Array.from({ length: getEnv().MAX_PARAMS_PER_REQUEST + 1 }).map(
          () => new ObjectId().toString()
        )
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.TooManyItemsRequested('node_ids')
    });
  });
});

describe('::searchNodes', () => {
  const getOwnedAndSharedNodes = (username: Username) => {
    return sortedNodes.filter(
      (n) => n.owner == username || !!n.permissions[username]
    );
  };

  it("returns all of a user's nodes if no query params given", async () => {
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

  it('only returns nodes owned by the user', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[1].username,
        after: undefined,
        match: { tags: ['darkshines'] },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[1].username)
        .filter((n) => n.type == 'file' && n.tags.includes('darkshines'))
        .map(toPublicNode)
    );
  });

  it('also returns nodes not owned when user has view/edit permission', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[1].username,
        after: undefined,
        match: { owner: dummyAppData.users[2].username },
        regexMatch: { [`permissions.${dummyAppData.users[1].username}`]: 'view|edit' }
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[2].username)
        .filter((n) => !!n.permissions[dummyAppData.users[1].username])
        .map(toPublicNode)
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

  it('rejects if after node_id is not a valid ObjectId', async () => {
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

  it('rejects if after node_id not found', async () => {
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

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: 'does-not-exist',
        after: undefined,
        match: {},
        regexMatch: {}
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.searchNodes({
        username: undefined,
        after: undefined,
        match: {},
        regexMatch: {}
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('does not crash when database is empty', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
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

  it('returns expected nodes when using match and regexMatch simultaneously', async () => {
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

  it('returns expected nodes when matching case-insensitively by tag', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: { tags: ['MuSiC'] },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter((n) => n.type == 'file' && n.tags.includes('music'))
        .map(toPublicNode)
    );

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[0].username,
        after: undefined,
        match: { tags: ['MuSiC', 'muse'] },
        regexMatch: {}
      })
    ).resolves.toStrictEqual(
      getOwnedAndSharedNodes(dummyAppData.users[0].username)
        .filter(
          (n) =>
            n.type == 'file' && (n.tags.includes('music') || n.tags.includes('muse'))
        )
        .map(toPublicNode)
    );
  });

  it('returns expected nodes when matching case-insensitively by name', async () => {
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

  it('returns expected nodes when matching conditioned on createdAt and/or modifiedAt', async () => {
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

  it('rejects when attempting to search for more than MAX_SEARCHABLE_TAGS tags', async () => {
    expect.hasAssertions();

    await expect(
      Backend.searchNodes({
        username: dummyAppData.users[2].username,
        after: undefined,
        match: {
          tags: Array.from({ length: getEnv().MAX_SEARCHABLE_TAGS + 1 }).map(() =>
            Math.random().toString(32).slice(2, 7)
          )
        },
        regexMatch: {}
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.TooManyItemsRequested('searchable tags')
    });
  });

  it('rejects when attempting to search using disallowed or unknown fields', async () => {
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

describe('::createNode', () => {
  it('creates and returns a new file node', async () => {
    expect.hasAssertions();

    const newNode: Required<NewFileNode> = {
      type: 'file',
      name: 'My New File',
      text: "You'll take only seconds to draw me in.",
      tags: ['muse', 'darkshines', 'ORIGIN', 'origin', 'music'],
      lock: null,
      permissions: {}
    };

    const metaNodesDb = (
      await getDb({ name: 'hscc-api-qoverflow' })
    ).collection<InternalFileNode>('file-nodes');

    await expect(
      metaNodesDb.countDocuments({
        name: newNode.name,
        'name-lowercase': newNode.name.toLowerCase()
      })
    ).resolves.toBe(0);

    await expect(
      Backend.createNode({ username: dummyAppData.users[0].username, data: newNode })
    ).resolves.toStrictEqual<PublicFileNode>({
      node_id: expect.any(String),
      ...newNode,
      tags: Array.from(new Set(newNode.tags.map((tag) => tag.toLowerCase()))),
      owner: dummyAppData.users[0].username,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      size: newNode.text.length
    });

    await expect(
      metaNodesDb.countDocuments({
        name: newNode.name,
        'name-lowercase': newNode.name.toLowerCase()
      })
    ).resolves.toBe(1);
  });

  it('creates and returns a new symlink node', async () => {
    expect.hasAssertions();

    const newNode: Required<NewMetaNode> = {
      type: 'symlink',
      name: 'Latest Symlink',
      contents: [],
      permissions: {}
    };

    const metaNodesDb = (
      await getDb({ name: 'hscc-api-qoverflow' })
    ).collection<InternalMetaNode>('meta-nodes');

    await expect(metaNodesDb.countDocuments({ name: newNode.name })).resolves.toBe(0);

    await expect(
      Backend.createNode({ username: dummyAppData.users[0].username, data: newNode })
    ).resolves.toStrictEqual<PublicMetaNode>({
      node_id: expect.any(String),
      ...newNode,
      owner: dummyAppData.users[0].username,
      createdAt: Date.now()
    });

    await expect(metaNodesDb.countDocuments({ name: newNode.name })).resolves.toBe(1);
  });

  it('creates and returns a new directory node', async () => {
    expect.hasAssertions();

    const newNode: Required<NewMetaNode> = {
      type: 'directory',
      name: 'New Directory',
      contents: [
        dummyAppData['file-nodes'][0]._id.toString(),
        dummyAppData['file-nodes'][0]._id.toString()
      ],
      permissions: {}
    };

    const metaNodesDb = (
      await getDb({ name: 'hscc-api-qoverflow' })
    ).collection<InternalMetaNode>('meta-nodes');

    await expect(metaNodesDb.countDocuments({ name: newNode.name })).resolves.toBe(0);

    await expect(
      Backend.createNode({ username: dummyAppData.users[0].username, data: newNode })
    ).resolves.toStrictEqual<PublicMetaNode>({
      node_id: expect.any(String),
      ...newNode,
      contents: [dummyAppData['file-nodes'][0]._id.toString()],
      owner: dummyAppData.users[0].username,
      createdAt: Date.now()
    });

    await expect(metaNodesDb.countDocuments({ name: newNode.name })).resolves.toBe(1);
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.createNode({
        username: 'does-not-exist',
        data: {
          type: 'directory',
          name: 'New Directory',
          contents: [],
          permissions: {}
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.createNode({
        username: undefined,
        data: {
          type: 'directory',
          name: 'New Directory',
          contents: [],
          permissions: {}
        }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MIN_USER_NAME_LENGTH: minUsernameLen,
      MAX_USER_NAME_LENGTH: maxUsernameLen,
      MAX_LOCK_CLIENT_LENGTH: maxLockClientLen,
      MAX_NODE_NAME_LENGTH: maxNodeNameLen,
      MAX_NODE_TAGS: maxNodeTags,
      MAX_NODE_TAG_LENGTH: maxNodeTagLen,
      MAX_NODE_PERMISSIONS: maxNodePerms,
      MAX_NODE_CONTENTS: maxNodeContents,
      MAX_NODE_TEXT_LENGTH_BYTES: maxNodeTextBytes
    } = getEnv();

    const knownNewId = new ObjectId().toString();

    const newNodes: [NewNode, string][] = [
      [undefined as unknown as NewNode, ErrorMessage.InvalidJSON()],
      ['string data' as NewNode, ErrorMessage.InvalidJSON()],
      [{ type: null } as unknown as NewNode, ErrorMessage.InvalidFieldValue('type')],
      [
        { type: 'bad-type' } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('type')
      ],
      [
        { type: 'directory', name: '' },
        ErrorMessage.InvalidStringLength('name', 1, maxNodeNameLen, 'string')
      ],
      [
        { type: 'symlink', name: 'x'.repeat(maxNodeNameLen + 1) },
        ErrorMessage.InvalidStringLength('name', 1, maxNodeNameLen, 'string')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          permissions: null
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('permissions')
      ],
      [
        {
          type: 'directory',
          name: 'x',
          permissions: ['yes']
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('permissions')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          permissions: { 'user-does-not-exist': 'edit' }
        },
        ErrorMessage.ItemNotFound('user-does-not-exist', 'user (permissions)')
      ],
      [
        {
          type: 'directory',
          name: 'x',
          permissions: { [dummyAppData.users[0].username]: 'bad-perm' }
        } as unknown as NewNode,
        ErrorMessage.InvalidObjectKeyValue('permissions')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          permissions: Array.from({ length: maxNodePerms + 1 }).reduce<
            NonNullable<NewNode['permissions']>
          >((o) => {
            o[Math.random().toString(32).slice(2, 7) as keyof typeof o] = 'view';
            return o;
          }, {})
        },
        ErrorMessage.TooManyItemsRequested('permissions')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: ['yes']
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('permissions')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: { 'user-does-not-exist': 'edit' }
        },
        ErrorMessage.ItemNotFound('user-does-not-exist', 'user (permissions)')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: { [dummyAppData.users[0].username]: 'bad-perm' }
        } as unknown as NewNode,
        ErrorMessage.InvalidObjectKeyValue('permissions')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: Array.from({ length: maxNodePerms + 1 }).reduce<
            NonNullable<NewNode['permissions']>
          >((o) => {
            o[Math.random().toString(32).slice(2, 7) as keyof typeof o] = 'view';
            return o;
          }, {})
        },
        ErrorMessage.TooManyItemsRequested('permissions')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: { public: 'edit' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          permissions: { public: 'view' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions')
      ],
      [
        {
          type: 'directory',
          name: 'x',
          permissions: { public: 'view' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: null
        } as unknown as NewNode,
        ErrorMessage.InvalidStringLength('text', 0, maxNodeTextBytes, 'bytes')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: { public: 'view' },
          text: 'x'.repeat(maxNodeTextBytes + 1)
        },
        ErrorMessage.InvalidStringLength('text', 0, maxNodeTextBytes, 'bytes')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: null
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('tags')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [1]
        } as unknown as NewNode,
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        )
      ],
      [
        { type: 'file', name: 'x', permissions: {}, text: 'x', tags: [''] },
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        )
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: ['x'.repeat(maxNodeTagLen + 1)]
        },
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        )
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: Array.from({ length: maxNodeTags + 1 }).map(() =>
            Math.random().toString(32).slice(2, 7)
          )
        },
        ErrorMessage.TooManyItemsRequested('tags')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: 1
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('lock')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: {
            user: 'x'.repeat(minUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen)
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen + 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen)
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: {
            user: null as unknown as string,
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen)
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: '',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: '',
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.client', 1, maxLockClientLen, 'string')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: '',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: null as unknown as string,
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.client', 1, maxLockClientLen, 'string')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: '',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen + 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.client', 1, maxLockClientLen, 'string')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: '',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1)
          } as NodeLock
        },
        ErrorMessage.InvalidFieldValue('lock.createdAt')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: null
          } as unknown as NodeLock
        },
        ErrorMessage.InvalidFieldValue('lock.createdAt')
      ],
      [
        {
          type: 'file',
          name: 'x',
          permissions: {},
          text: 'x',
          tags: [],
          lock: {
            user: dummyAppData.users[0].username,
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now(),
            bad: 1
          } as unknown as NodeLock
        },
        ErrorMessage.InvalidObjectKeyValue('lock')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          permissions: {},
          contents: null
        } as unknown as NewNode,
        ErrorMessage.InvalidFieldValue('contents')
      ],
      [
        {
          type: 'directory',
          name: 'x',
          permissions: {},
          contents: [1]
        } as unknown as NewNode,
        ErrorMessage.InvalidArrayValue('contents', '1')
      ],
      [
        { type: 'symlink', name: 'x', permissions: {}, contents: ['bad'] },
        ErrorMessage.InvalidArrayValue('contents', 'bad')
      ],
      [
        { type: 'directory', name: 'x', permissions: {}, contents: [knownNewId] },
        ErrorMessage.ItemNotFound(knownNewId, 'node_id')
      ],
      [
        { type: 'symlink', name: 'x', permissions: {}, contents: [knownNewId] },
        ErrorMessage.ItemNotFound(knownNewId, 'node_id')
      ],
      [
        {
          type: 'directory',
          name: 'x',
          permissions: {},
          contents: Array.from({ length: maxNodeContents + 1 }).map(() =>
            dummyAppData['file-nodes'][0]._id.toString()
          )
        },
        ErrorMessage.TooManyItemsRequested('content node_ids')
      ],
      [
        {
          type: 'symlink',
          name: 'x',
          contents: [
            dummyAppData['file-nodes'][0]._id.toString(),
            dummyAppData['file-nodes'][0]._id.toString()
          ],
          permissions: {}
        },
        ErrorMessage.TooManyItemsRequested('content node_ids')
      ],
      [
        {
          type: 'file',
          owner: 'User1',
          name: 'user1-file1',
          text: 'Tell me how did we get here?',
          tags: ['grandson', 'music'],
          lock: null,
          permissions: {}
        } as NewNode,
        ErrorMessage.UnknownField('owner')
      ],
      [
        {
          type: 'file',
          name: 'user1-file1',
          text: 'Tell me how did we get here?',
          tags: ['grandson', 'music'],
          lock: null,
          permissions: {},
          contents: [new ObjectId().toString()]
        } as NewNode,
        ErrorMessage.UnknownField('contents')
      ],
      [
        {
          type: 'symlink',
          name: 'user1-file1',
          text: 'Tell me how did we get here?',
          permissions: {},
          contents: []
        } as NewNode,
        ErrorMessage.UnknownField('text')
      ],
      [
        {
          type: 'directory',
          name: 'user1-file1',
          tags: ['grandson', 'music'],
          permissions: {},
          contents: []
        } as NewNode,
        ErrorMessage.UnknownField('tags')
      ],
      [
        {
          type: 'symlink',
          name: 'user1-file1',
          lock: null,
          permissions: {},
          contents: []
        } as NewNode,
        ErrorMessage.UnknownField('lock')
      ],
      [
        {
          type: 'symlink',
          name: 'user1-file1',
          permissions: {},
          contents: [],
          data: 1
        } as NewNode,
        ErrorMessage.UnknownField('data')
      ]
    ];

    await Promise.all(
      newNodes.map(([data, message]) =>
        expect(
          Backend.createNode({
            username: dummyAppData['file-nodes'][0].owner,
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::updateNode', () => {
  it('updates an existing node', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const metaNodeDb = db.collection('meta-nodes');

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        owner: dummyAppData['file-nodes'][0].owner
      })
    ).resolves.toBe(1);

    await expect(
      metaNodeDb.countDocuments({
        _id: dummyAppData['meta-nodes'][0]._id,
        owner: dummyAppData['meta-nodes'][0].owner
      })
    ).resolves.toBe(1);

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { owner: dummyAppData.users[2].username }
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.updateNode({
        username: dummyAppData['meta-nodes'][0].owner,
        node_id: dummyAppData['meta-nodes'][0]._id.toString(),
        data: { owner: dummyAppData.users[0].username }
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        owner: dummyAppData['file-nodes'][0].owner
      })
    ).resolves.toBe(0);

    await expect(
      metaNodeDb.countDocuments({
        _id: dummyAppData['meta-nodes'][0]._id,
        owner: dummyAppData['meta-nodes'][0].owner
      })
    ).resolves.toBe(0);
  });

  it('updates modifiedAt', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        modifiedAt: Date.now()
      })
    ).resolves.toBe(0);

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { owner: dummyAppData.users[2].username }
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        modifiedAt: Date.now()
      })
    ).resolves.toBe(1);
  });

  it('does not reject when demonstrating idempotency', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][2].owner,
        node_id: dummyAppData['file-nodes'][2]._id.toString(),
        data: {
          name: dummyAppData['file-nodes'][2].name,
          lock: dummyAppData['file-nodes'][2].lock,
          permissions: dummyAppData['file-nodes'][2].permissions
        }
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.updateNode({
        username: dummyAppData['meta-nodes'][0].owner,
        node_id: dummyAppData['meta-nodes'][0]._id.toString(),
        data: {
          name: dummyAppData['meta-nodes'][0].name,
          contents: dummyAppData['meta-nodes'][0].contents.map((id) => id.toString()),
          permissions: dummyAppData['meta-nodes'][0].permissions
        }
      })
    ).resolves.toBeUndefined();
  });

  it('treats tags as lowercase set', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const tags = ['TAG-1', 'tag-1', 'tag-2'];

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { tags }
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        tags: Array.from(new Set(tags.map((tag) => tag.toLowerCase())))
      })
    ).resolves.toBe(1);
  });

  it('updates size', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const size = 4096;
    const text = 'x'.repeat(size);

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        size
      })
    ).resolves.toBe(0);

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { text }
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        size
      })
    ).resolves.toBe(1);
  });

  it('updates name-lowercase', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const name = 'TEST-NAME';

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        'name-lowercase': name.toLowerCase()
      })
    ).resolves.toBe(0);

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { name }
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: dummyAppData['file-nodes'][0]._id,
        'name-lowercase': name.toLowerCase()
      })
    ).resolves.toBe(1);
  });

  it('rejects if the node_id is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: 'bad',
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidObjectId('bad') });
  });

  it('rejects if the node_id is missing or not found', async () => {
    expect.hasAssertions();

    const node_id = new ObjectId().toString();

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id,
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(node_id, 'node_id')
    });

    await expect(
      Backend.updateNode({
        username: dummyAppData['file-nodes'][0].owner,
        node_id: undefined,
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('node_id', 'parameter')
    });
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateNode({
        username: 'does-not-exist',
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.updateNode({
        username: undefined,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('returns immediately is no data passed in', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateNode({
        username: undefined,
        node_id: undefined,
        data: {}
      })
    ).resolves.toBeUndefined();
  });

  it('rejects if node_id not owned by username', async () => {
    expect.hasAssertions();

    await expect(
      Backend.updateNode({
        username: dummyAppData.users[2].username,
        node_id: dummyAppData['file-nodes'][0]._id.toString(),
        data: { owner: 'new-user' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(
        dummyAppData['file-nodes'][0]._id.toString(),
        'node_id'
      )
    });
  });

  it('does not reject if node_id not owned when user has edit (not view) permission', async () => {
    expect.hasAssertions();

    // ? Has edit perms
    await expect(
      Backend.updateNode({
        username: 'User2',
        node_id: dummyAppData['file-nodes'][3]._id.toString(),
        data: { text: 'new text' }
      })
    ).resolves.toBeUndefined();

    // ? Only has view perms
    await expect(
      Backend.updateNode({
        username: 'User2',
        node_id: dummyAppData['meta-nodes'][1]._id.toString(),
        data: { name: 'new name' }
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound(
        dummyAppData['meta-nodes'][1]._id.toString(),
        'node_id'
      )
    });
  });

  it('rejects if data is invalid or contains properties that violates limits', async () => {
    expect.hasAssertions();

    const {
      MIN_USER_NAME_LENGTH: minUsernameLen,
      MAX_USER_NAME_LENGTH: maxUsernameLen,
      MAX_LOCK_CLIENT_LENGTH: maxLockClientLen,
      MAX_NODE_NAME_LENGTH: maxNodeNameLen,
      MAX_NODE_TAGS: maxNodeTags,
      MAX_NODE_TAG_LENGTH: maxNodeTagLen,
      MAX_NODE_PERMISSIONS: maxNodePerms,
      MAX_NODE_CONTENTS: maxNodeContents,
      MAX_NODE_TEXT_LENGTH_BYTES: maxNodeTextBytes
    } = getEnv();

    const knownNewId = new ObjectId().toString();
    const knownFileNode = dummyAppData['file-nodes'][4];
    const knownDirNode = dummyAppData['meta-nodes'][1];
    const knownLinkNode = dummyAppData['meta-nodes'][2];

    const patchNodes: [patch: PatchNode, error: string, node: InternalNode][] = [
      [undefined as unknown as PatchNode, ErrorMessage.InvalidJSON(), knownFileNode],
      ['string data' as PatchNode, ErrorMessage.InvalidJSON(), knownFileNode],
      [
        { name: '' },
        ErrorMessage.InvalidStringLength('name', 1, maxNodeNameLen, 'string'),
        knownDirNode
      ],
      [
        { name: 'x'.repeat(maxNodeNameLen + 1) },
        ErrorMessage.InvalidStringLength('name', 1, maxNodeNameLen, 'string'),
        knownLinkNode
      ],
      [
        {
          permissions: null
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('permissions'),
        knownLinkNode
      ],
      [
        {
          permissions: ['yes']
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('permissions'),
        knownDirNode
      ],
      [
        {
          permissions: { 'user-does-not-exist': 'edit' }
        },
        ErrorMessage.ItemNotFound('user-does-not-exist', 'user (permissions)'),
        knownLinkNode
      ],
      [
        {
          permissions: { [dummyAppData.users[0].username]: 'bad-perm' }
        } as unknown as PatchNode,
        ErrorMessage.InvalidObjectKeyValue('permissions'),
        knownDirNode
      ],
      [
        {
          permissions: Array.from({ length: maxNodePerms + 1 }).reduce<
            NonNullable<PatchNode['permissions']>
          >((o) => {
            o[Math.random().toString(32).slice(2, 7) as keyof typeof o] = 'view';
            return o;
          }, {})
        },
        ErrorMessage.TooManyItemsRequested('permissions'),
        knownLinkNode
      ],
      [
        {
          permissions: ['yes']
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('permissions'),
        knownFileNode
      ],
      [
        {
          permissions: { 'user-does-not-exist': 'edit' }
        },
        ErrorMessage.ItemNotFound('user-does-not-exist', 'user (permissions)'),
        knownFileNode
      ],
      [
        {
          permissions: { [dummyAppData.users[0].username]: 'bad-perm' }
        } as unknown as PatchNode,
        ErrorMessage.InvalidObjectKeyValue('permissions'),
        knownFileNode
      ],
      [
        {
          permissions: Array.from({ length: maxNodePerms + 1 }).reduce<
            NonNullable<PatchNode['permissions']>
          >((o) => {
            o[Math.random().toString(32).slice(2, 7) as keyof typeof o] = 'view';
            return o;
          }, {})
        },
        ErrorMessage.TooManyItemsRequested('permissions'),
        knownFileNode
      ],
      [
        {
          permissions: { public: 'edit' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions'),
        knownFileNode
      ],
      [
        {
          permissions: { public: 'view' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions'),
        knownLinkNode
      ],
      [
        {
          permissions: { public: 'view' }
        },
        ErrorMessage.InvalidObjectKeyValue('permissions'),
        knownDirNode
      ],
      [
        { text: null } as unknown as PatchNode,
        ErrorMessage.InvalidStringLength('text', 0, maxNodeTextBytes, 'bytes'),
        knownFileNode
      ],
      [
        {
          permissions: { public: 'view' },
          text: 'x'.repeat(maxNodeTextBytes + 1)
        },
        ErrorMessage.InvalidStringLength('text', 0, maxNodeTextBytes, 'bytes'),
        knownFileNode
      ],
      [
        {
          tags: null
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('tags'),
        knownFileNode
      ],
      [
        {
          tags: [1]
        } as unknown as PatchNode,
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        ),
        knownFileNode
      ],
      [
        { tags: [''] },
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        ),
        knownFileNode
      ],
      [
        {
          tags: ['x'.repeat(maxNodeTagLen + 1)]
        },
        ErrorMessage.InvalidStringLength(
          'tags',
          1,
          maxNodeTagLen,
          'alphanumeric',
          false,
          true
        ),
        knownFileNode
      ],
      [
        {
          tags: Array.from({ length: maxNodeTags + 1 }).map(() =>
            Math.random().toString(32).slice(2, 7)
          )
        },
        ErrorMessage.TooManyItemsRequested('tags'),
        knownFileNode
      ],
      [
        {
          lock: 1
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('lock'),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(minUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(maxUsernameLen + 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen),
        knownFileNode
      ],
      [
        {
          lock: {
            user: null as unknown as string,
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength('lock.user', minUsernameLen, maxUsernameLen),
        knownFileNode
      ],
      [
        {
          text: '',
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: '',
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength(
          'lock.client',
          1,
          maxLockClientLen,
          'string'
        ),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: null as unknown as string,
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength(
          'lock.client',
          1,
          maxLockClientLen,
          'string'
        ),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen + 1),
            createdAt: Date.now()
          }
        },
        ErrorMessage.InvalidStringLength(
          'lock.client',
          1,
          maxLockClientLen,
          'string'
        ),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1)
          } as NodeLock
        },
        ErrorMessage.InvalidFieldValue('lock.createdAt'),
        knownFileNode
      ],
      [
        {
          lock: {
            user: 'x'.repeat(maxUsernameLen - 1),
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: null
          } as unknown as NodeLock
        },
        ErrorMessage.InvalidFieldValue('lock.createdAt'),
        knownFileNode
      ],
      [
        {
          lock: {
            user: dummyAppData.users[0].username,
            client: 'y'.repeat(maxLockClientLen - 1),
            createdAt: Date.now(),
            bad: 1
          } as unknown as NodeLock
        },
        ErrorMessage.InvalidObjectKeyValue('lock'),
        knownFileNode
      ],
      [
        {
          contents: null
        } as unknown as PatchNode,
        ErrorMessage.InvalidFieldValue('contents'),
        knownLinkNode
      ],
      [
        {
          contents: [1]
        } as unknown as PatchNode,
        ErrorMessage.InvalidArrayValue('contents', '1'),
        knownDirNode
      ],
      [
        { contents: ['bad'] },
        ErrorMessage.InvalidArrayValue('contents', 'bad'),
        knownLinkNode
      ],
      [
        { contents: [knownNewId] },
        ErrorMessage.ItemNotFound(knownNewId, 'node_id'),
        knownDirNode
      ],
      [
        { contents: [knownNewId] },
        ErrorMessage.ItemNotFound(knownNewId, 'node_id'),
        knownLinkNode
      ],
      [
        {
          contents: Array.from({ length: maxNodeContents + 1 }).map(() =>
            dummyAppData['file-nodes'][0]._id.toString()
          )
        },
        ErrorMessage.TooManyItemsRequested('content node_ids'),
        knownDirNode
      ],
      [
        {
          contents: [
            dummyAppData['meta-nodes'][0]._id.toString(),
            dummyAppData['meta-nodes'][1]._id.toString()
          ]
        },
        ErrorMessage.TooManyItemsRequested('content node_ids'),
        dummyAppData['meta-nodes'][2]
      ],
      [
        {
          owner: 'user-does-not-exist'
        } as PatchNode,
        ErrorMessage.ItemNotFound('user-does-not-exist', 'user'),
        knownFileNode
      ],
      [
        {
          contents: [new ObjectId().toString()]
        } as PatchNode,
        ErrorMessage.UnknownField('contents'),
        knownFileNode
      ],
      [
        {
          text: 'Tell me how did we get here?'
        } as PatchNode,
        ErrorMessage.UnknownField('text'),
        knownLinkNode
      ],
      [
        {
          tags: ['grandson', 'music']
        } as PatchNode,
        ErrorMessage.UnknownField('tags'),
        knownDirNode
      ],
      [
        {
          lock: null
        } as PatchNode,
        ErrorMessage.UnknownField('lock'),
        knownLinkNode
      ],
      [
        {
          data: 1
        } as PatchNode,
        ErrorMessage.UnknownField('data'),
        knownLinkNode
      ]
    ];

    await Promise.all(
      patchNodes.map(([data, message, node]) =>
        expect(
          Backend.updateNode({
            username: node.owner,
            node_id: node._id.toString(),
            data
          })
        ).rejects.toMatchObject({ message })
      )
    );
  });
});

describe('::deleteNodes', () => {
  it('deletes one or more existing nodes', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const metaNodeDb = db.collection('meta-nodes');

    await expect(
      fileNodeDb.countDocuments({
        _id: {
          $in: [dummyAppData['file-nodes'][0]._id, dummyAppData['file-nodes'][1]._id]
        }
      })
    ).resolves.toBe(2);

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][0]._id })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [
          dummyAppData['file-nodes'][0]._id.toString(),
          dummyAppData['file-nodes'][1]._id.toString()
        ]
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['meta-nodes'][0].owner,
        node_ids: [dummyAppData['meta-nodes'][0]._id.toString()]
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({
        _id: {
          $in: [dummyAppData['file-nodes'][0]._id, dummyAppData['file-nodes'][1]._id]
        }
      })
    ).resolves.toBe(0);

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][0]._id })
    ).resolves.toBe(0);
  });

  it('rejects if one or more of the node_ids is not a valid ObjectId', async () => {
    expect.hasAssertions();

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: ['bad']
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidObjectId('bad') });

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [dummyAppData['file-nodes'][0]._id.toString(), 'bad']
      })
    ).rejects.toMatchObject({ message: ErrorMessage.InvalidObjectId('bad') });
  });

  it('rejects if too many node_ids requested', async () => {
    expect.hasAssertions();

    await expect(
      Backend.deleteNodes({
        username: 'User1',
        node_ids: Array.from({ length: getEnv().MAX_PARAMS_PER_REQUEST + 1 }).map(
          () => new ObjectId().toString()
        )
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.TooManyItemsRequested('node_ids')
    });
  });

  it('rejects if the username is missing or not found', async () => {
    expect.hasAssertions();

    await expect(
      Backend.deleteNodes({
        username: 'does-not-exist',
        node_ids: []
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.ItemNotFound('does-not-exist', 'user')
    });

    await expect(
      Backend.deleteNodes({
        username: undefined,
        node_ids: []
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('username', 'parameter')
    });
  });

  it('rejects if node_ids is missing', async () => {
    expect.hasAssertions();

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: undefined
      })
    ).rejects.toMatchObject({
      message: ErrorMessage.InvalidItem('node_ids', 'parameter')
    });
  });

  it('does not reject if one or more of the node_ids is not found', async () => {
    expect.hasAssertions();

    const fileNodeDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection(
      'file-nodes'
    );

    await expect(
      fileNodeDb.countDocuments({ _id: dummyAppData['file-nodes'][0]._id })
    ).resolves.toBe(1);

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [new ObjectId().toString()]
      })
    ).resolves.toBeUndefined();

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][0].owner,
        node_ids: [
          dummyAppData['file-nodes'][0]._id.toString(),
          new ObjectId().toString()
        ]
      })
    ).resolves.toBeUndefined();

    await expect(
      fileNodeDb.countDocuments({ _id: dummyAppData['file-nodes'][0]._id })
    ).resolves.toBe(0);
  });

  it('does nothing to any node_ids not owned by username', async () => {
    expect.hasAssertions();

    const db = await getDb({ name: 'hscc-api-qoverflow' });
    const fileNodeDb = db.collection('file-nodes');
    const metaNodeDb = db.collection('meta-nodes');

    await expect(
      fileNodeDb.countDocuments({ _id: dummyAppData['file-nodes'][2]._id })
    ).resolves.toBe(1);

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][0]._id })
    ).resolves.toBe(1);

    await Backend.deleteNodes({
      username: dummyAppData['file-nodes'][2].owner,
      node_ids: [
        dummyAppData['file-nodes'][2]._id.toString(),
        dummyAppData['meta-nodes'][0]._id.toString()
      ]
    });

    await expect(
      fileNodeDb.countDocuments({ _id: dummyAppData['file-nodes'][2]._id })
    ).resolves.toBe(0);

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][0]._id })
    ).resolves.toBe(1);
  });

  it('does nothing to node_ids even when user has edit permissions', async () => {
    expect.hasAssertions();

    const metaNodeDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection(
      'meta-nodes'
    );

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][1]._id })
    ).resolves.toBe(1);

    await Backend.deleteNodes({
      username: 'User2',
      node_ids: [dummyAppData['meta-nodes'][1]._id.toString()]
    });

    await expect(
      metaNodeDb.countDocuments({ _id: dummyAppData['meta-nodes'][1]._id })
    ).resolves.toBe(1);
  });

  it('deleted node_ids are removed from all MetaNode contents arrays', async () => {
    expect.hasAssertions();

    const node_id = dummyAppData['file-nodes'][4]._id;

    const numInContentArrays = dummyAppData['meta-nodes'].filter(({ contents }) =>
      contents.includes(node_id)
    ).length;

    expect(numInContentArrays).toBeGreaterThan(0);

    const metaNodeDb = (await getDb({ name: 'hscc-api-qoverflow' })).collection(
      'meta-nodes'
    );

    await expect(metaNodeDb.countDocuments({ contents: node_id })).resolves.toBe(
      numInContentArrays
    );

    await expect(
      Backend.deleteNodes({
        username: dummyAppData['file-nodes'][4].owner,
        node_ids: [node_id.toString()]
      })
    ).resolves.toBeUndefined();

    await expect(metaNodeDb.countDocuments({ contents: node_id })).resolves.toBe(0);
  });
});
