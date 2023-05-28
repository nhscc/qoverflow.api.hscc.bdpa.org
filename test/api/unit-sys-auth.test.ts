/* eslint-disable no-global-assign */
import { randomUUID } from 'node:crypto';
import { testApiHandler } from 'next-test-api-route-handler';
import { ObjectId, type Collection, type Db } from 'mongodb';

import AuthEndpoint, { config as AuthConfig } from 'universe/pages/api/sys/auth';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';
import { useMockDateNow } from 'multiverse/jest-mock-date';
import { getDb } from 'multiverse/mongo-schema';
import { dummyRootData } from 'multiverse/mongo-common';

import {
  BANNED_BEARER_TOKEN,
  DEV_BEARER_TOKEN,
  DUMMY_BEARER_TOKEN,
  toPublicAuthEntry,
  type PublicAuthEntry,
  type InternalAuthBearerEntry
} from 'multiverse/next-auth';

import AuthUnbanEndpoint, {
  config as AuthUnbanConfig
} from 'universe/pages/api/sys/auth/unban';

import type { NextApiHandlerMixin } from 'testverse/fixtures';
import type { InternalLimitedLogEntry } from 'multiverse/next-limit';

setupMemoryServerOverride();
useMockDateNow();

const authHandler = AuthEndpoint as NextApiHandlerMixin;
const authUnbanHandler = AuthUnbanEndpoint as NextApiHandlerMixin;

authHandler.config = AuthConfig;
authUnbanHandler.config = AuthUnbanConfig;

// * This suite blurs the line between unit and integration tests for portability
// * reasons.
// TODO: replace with next-fable (formerly / in addition to: @xunnamius/fable)

describe('middleware correctness tests', () => {
  it('endpoints fail on req with bad authentication', async () => {
    expect.hasAssertions();

    await testApiHandler({
      handler: authHandler,
      test: async ({ fetch }) => {
        await expect(fetch().then((r) => r.status)).resolves.toBe(401);
      }
    });

    await testApiHandler({
      handler: authUnbanHandler,
      test: async ({ fetch }) => {
        await expect(fetch().then((r) => r.status)).resolves.toBe(401);
      }
    });
  });

  it('endpoints fail if authenticated req is not authorized', async () => {
    expect.hasAssertions();

    await testApiHandler({
      handler: authHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${DUMMY_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(403);
      }
    });

    await testApiHandler({
      handler: authUnbanHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${DUMMY_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(403);
      }
    });
  });

  it('endpoints fail if authed req is rate limited', async () => {
    expect.hasAssertions();

    await (await getDb({ name: 'root' }))
      .collection<InternalAuthBearerEntry>('auth')
      .updateOne(
        { token: { bearer: BANNED_BEARER_TOKEN } },
        { $set: { 'attributes.isGlobalAdmin': true } }
      );

    await testApiHandler({
      handler: authHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${BANNED_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(429);
      }
    });

    await testApiHandler({
      handler: authUnbanHandler,
      test: async ({ fetch }) => {
        await expect(
          fetch({
            headers: { Authorization: `bearer ${BANNED_BEARER_TOKEN}` }
          }).then((r) => r.status)
        ).resolves.toBe(429);
      }
    });
  });
});

describe('api/sys/auth', () => {
  let db: Db;
  let authDb: Collection<InternalAuthBearerEntry>;
  let limitDb: Collection<InternalLimitedLogEntry>;

  const headerOverrides = {
    authorization: `bearer ${DEV_BEARER_TOKEN}`,
    'content-type': 'application/json'
  };

  beforeEach(async () => {
    db = await getDb({ name: 'root' });
    authDb = db.collection('auth');
    limitDb = db.collection('limited-log');
  });

  describe('/ [GET]', () => {
    it('returns all tokens belonging to the specified chapter', async () => {
      expect.hasAssertions();

      const newEntry: InternalAuthBearerEntry = {
        ...dummyRootData.auth[0],
        _id: new ObjectId(),
        token: { bearer: randomUUID() }
      };

      await authDb.insertOne(newEntry);

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'GET',
            headers: { 'X-Target-Owners': dummyRootData.auth[0].attributes.owner }
          });

          const json = await res.json();

          expect(json).toStrictEqual({
            success: true,
            entries: expect.arrayContaining([
              toPublicAuthEntry(dummyRootData.auth[0]),
              toPublicAuthEntry(newEntry)
            ])
          });

          expect(res.status).toBe(200);
        }
      });
    });

    it('returns all tokens belonging to all the specified chapters', async () => {
      expect.hasAssertions();

      const newEntry1: InternalAuthBearerEntry = {
        ...dummyRootData.auth[0],
        _id: new ObjectId(),
        token: { bearer: randomUUID() }
      };

      const newEntry2: InternalAuthBearerEntry = {
        ...dummyRootData.auth[1],
        _id: new ObjectId(),
        token: { bearer: randomUUID() }
      };

      await authDb.insertMany([newEntry1, newEntry2]);

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'GET',
            headers: [
              ['x-target-owners', dummyRootData.auth[0].attributes.owner],
              ['x-target-owners', dummyRootData.auth[1].attributes.owner]
            ]
          });

          const json = await res.json();

          expect(json).toStrictEqual({
            success: true,
            entries: expect.arrayContaining([
              toPublicAuthEntry(dummyRootData.auth[0]),
              toPublicAuthEntry(dummyRootData.auth[1]),
              toPublicAuthEntry(newEntry1),
              toPublicAuthEntry(newEntry2)
            ])
          });

          expect(res.status).toBe(200);
        }
      });

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'GET',
            headers: {
              'X-Target-Owners': `${dummyRootData.auth[0].attributes.owner},${dummyRootData.auth[1].attributes.owner}`
            }
          });

          const json = await res.json();

          expect(json).toStrictEqual({
            success: true,
            entries: expect.arrayContaining([
              toPublicAuthEntry(dummyRootData.auth[0]),
              toPublicAuthEntry(dummyRootData.auth[1]),
              toPublicAuthEntry(newEntry1),
              toPublicAuthEntry(newEntry2)
            ])
          });

          expect(res.status).toBe(200);
        }
      });
    });

    it('returns all tokens in the system if no chapter specified', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({ method: 'GET' });
          const json = await res.json();

          expect(json).toStrictEqual({
            success: true,
            entries: expect.arrayContaining(
              dummyRootData.auth.map((authEntry) => toPublicAuthEntry(authEntry))
            )
          });

          expect(res.status).toBe(200);
        }
      });
    });

    it('returns HTTP 400 on bad input', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect(
            (
              await fetch({
                method: 'GET',
                headers: { 'X-Target-Owners': '' }
              })
            ).status
          ).toBe(400);
        }
      });
    });
  });

  describe('/ [POST]', () => {
    it('returns a newly generated token owned by the specified chapter', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'POST',
            body: JSON.stringify({
              attributes: { owner: 'new-owner' }
            })
          });

          const json = await res.json();

          expect(json).toStrictEqual({
            success: true,
            entry: {
              attributes: { owner: 'new-owner' },
              scheme: 'bearer',
              token: { bearer: expect.any(String) }
            } as PublicAuthEntry
          });

          expect(res.status).toBe(200);
        }
      });
    });

    it('returns HTTP 400 on bad input', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect((await fetch({ method: 'POST' })).status).toBe(400);
        }
      });
    });
  });

  describe('/ [PATCH]', () => {
    it("updates the specified token's attributes", async () => {
      expect.hasAssertions();

      await expect(
        authDb.countDocuments({
          'attributes.owner': dummyRootData.auth[0].attributes.owner
        })
      ).resolves.toBe(1);

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'PATCH',
            body: JSON.stringify({
              target: dummyRootData.auth[1],
              attributes: dummyRootData.auth[0].attributes
            })
          });

          const json = await res.json();

          expect(json).toStrictEqual({ success: true });
          expect(res.status).toBe(200);

          await expect(
            authDb.countDocuments({
              'attributes.owner': dummyRootData.auth[0].attributes.owner
            })
          ).resolves.toBe(2);
        }
      });
    });

    it('returns HTTP 400 on bad input', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect((await fetch({ method: 'PATCH' })).status).toBe(400);
        }
      });

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect(
            (
              await fetch({
                method: 'PATCH',
                body: JSON.stringify({
                  target: dummyRootData.auth[1]
                })
              })
            ).status
          ).toBe(400);
        }
      });

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect(
            (
              await fetch({
                method: 'PATCH',
                body: JSON.stringify({
                  attributes: dummyRootData.auth[0].attributes
                })
              })
            ).status
          ).toBe(400);
        }
      });
    });
  });

  describe('/ [DELETE]', () => {
    it('deletes the specified token', async () => {
      expect.hasAssertions();

      await expect(
        authDb.countDocuments({
          scheme: 'bearer',
          token: { bearer: dummyRootData.auth[0].token.bearer }
        })
      ).resolves.toBe(1);

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          const res = await fetch({
            method: 'DELETE',
            body: JSON.stringify({ target: dummyRootData.auth[0] })
          });

          const json = await res.json();

          expect(json).toStrictEqual({ success: true });
          expect(res.status).toBe(200);

          await expect(
            authDb.countDocuments({
              scheme: 'bearer',
              token: { bearer: dummyRootData.auth[0].token.bearer }
            })
          ).resolves.toBe(0);
        }
      });
    });

    it('returns HTTP 400 on bad input', async () => {
      expect.hasAssertions();

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect((await fetch({ method: 'DELETE' })).status).toBe(400);
        }
      });

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect(
            (await fetch({ method: 'DELETE', body: JSON.stringify({}) })).status
          ).toBe(400);
        }
      });

      await testApiHandler({
        handler: authHandler,
        requestPatcher(req) {
          req.headers = { ...req.headers, ...headerOverrides };
        },
        async test({ fetch }) {
          expect(
            (await fetch({ method: 'DELETE', body: JSON.stringify({}) })).status
          ).toBe(400);
        }
      });
    });
  });

  describe('/unban', () => {
    describe('/ [GET]', () => {
      it('list all banned tokens and ips', async () => {
        expect.hasAssertions();

        await testApiHandler({
          handler: authUnbanHandler,
          requestPatcher(req) {
            req.headers = { ...req.headers, ...headerOverrides };
          },
          async test({ fetch }) {
            await expect(
              (await fetch({ method: 'GET' })).json()
            ).resolves.toStrictEqual({
              success: true,
              entries: dummyRootData['limited-log']
                .slice()
                .reverse()
                .map((ent) => {
                  const { _id, ...entry } = ent;
                  return entry;
                })
            });
          }
        });
      });
    });

    describe('/ [DELETE]', () => {
      it('unbans a token', async () => {
        expect.hasAssertions();

        await expect(
          limitDb.countDocuments({
            header: `bearer ${BANNED_BEARER_TOKEN}`,
            until: { $gt: Date.now() }
          })
        ).resolves.toBe(1);

        await testApiHandler({
          handler: authUnbanHandler,
          requestPatcher(req) {
            req.headers = { ...req.headers, ...headerOverrides };
          },
          async test({ fetch }) {
            const res = await fetch({
              method: 'DELETE',
              body: JSON.stringify({
                target: { header: `bearer ${BANNED_BEARER_TOKEN}` }
              })
            });

            const json = await res.json();

            expect(json).toStrictEqual({ success: true, unbannedCount: 1 });
            expect(res.status).toBe(200);

            await expect(
              limitDb.countDocuments({
                header: `bearer ${BANNED_BEARER_TOKEN}`,
                until: { $gt: Date.now() }
              })
            ).resolves.toBe(0);
          }
        });
      });

      it('unbans an ip address', async () => {
        expect.hasAssertions();

        await expect(
          limitDb.countDocuments({
            ip: '1.2.3.4',
            until: { $gt: Date.now() }
          })
        ).resolves.toBe(1);

        await testApiHandler({
          handler: authUnbanHandler,
          requestPatcher(req) {
            req.headers = { ...req.headers, ...headerOverrides };
          },
          async test({ fetch }) {
            const res = await fetch({
              method: 'DELETE',
              body: JSON.stringify({ target: { ip: '1.2.3.4' } })
            });

            const json = await res.json();

            expect(json).toStrictEqual({ success: true, unbannedCount: 1 });
            expect(res.status).toBe(200);

            await expect(
              limitDb.countDocuments({
                ip: '1.2.3.4',
                until: { $gt: Date.now() }
              })
            ).resolves.toBe(0);
          }
        });
      });

      it('returns HTTP 400 on bad input', async () => {
        expect.hasAssertions();

        await testApiHandler({
          handler: authUnbanHandler,
          requestPatcher(req) {
            req.headers = { ...req.headers, ...headerOverrides };
          },
          async test({ fetch }) {
            expect((await fetch({ method: 'DELETE' })).status).toBe(400);
          }
        });

        await testApiHandler({
          handler: authUnbanHandler,
          requestPatcher(req) {
            req.headers = { ...req.headers, ...headerOverrides };
          },
          async test({ fetch }) {
            expect(
              (await fetch({ method: 'DELETE', body: JSON.stringify({}) })).status
            ).toBe(400);
          }
        });
      });
    });
  });
});
