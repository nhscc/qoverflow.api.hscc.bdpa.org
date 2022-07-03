import { toss } from 'toss-expression';
import { AppError, InvalidAppEnvironmentError } from 'named-app-errors';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';
import { deleteUser } from 'universe/backend';

import { debugFactory } from 'multiverse/debug-extended';
import { closeClient, getDb } from 'multiverse/mongo-schema';

import type { Document, FindCursor, WithId } from 'mongodb';
import type { Promisable } from 'type-fest';
import type { InternalUser } from 'universe/backend/db';

const debugNamespace = `${namespace}:prune-data`;

const log = debugFactory(debugNamespace);
const debug = debugFactory(debugNamespace);

type DataLimit = {
  limit: { maxBytes: number } | { maxDocuments: number };
  orderBy?: string;
  deleteFn?: (thresholdEntry: WithId<Document>) => Promisable<number>;
};

// eslint-disable-next-line no-console
log.log = console.info.bind(console);

if (!getEnv().DEBUG && getEnv().NODE_ENV != 'test') {
  debugFactory.enable(`${debugNamespace},${debugNamespace}:*`);
  debug.enabled = false;
}

// * Add new env var configurations here
const getDbCollectionLimits = (env: ReturnType<typeof getEnv>) => {
  const limits: Record<string, Record<string, DataLimit>> = {
    root: {
      'request-log': {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_LOGS && env.PRUNE_DATA_MAX_LOGS > 0
              ? env.PRUNE_DATA_MAX_LOGS
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_LOGS must be greater than zero'
                  )
                )
        }
      },
      'limited-log': {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_BANNED && env.PRUNE_DATA_MAX_BANNED > 0
              ? env.PRUNE_DATA_MAX_BANNED
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_BANNED must be greater than zero'
                  )
                )
        }
      }
    },
    'hscc-api-qoverflow': {
      mail: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_MAIL && env.PRUNE_DATA_MAX_MAIL > 0
              ? env.PRUNE_DATA_MAX_MAIL
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_MAIL must be greater than zero'
                  )
                )
        }
      },
      questions: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_QUESTIONS && env.PRUNE_DATA_MAX_QUESTIONS > 0
              ? env.PRUNE_DATA_MAX_QUESTIONS
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_QUESTIONS must be greater than zero'
                  )
                )
        }
      },
      users: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_USERS && env.PRUNE_DATA_MAX_USERS > 0
              ? env.PRUNE_DATA_MAX_USERS
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_USERS must be greater than zero'
                  )
                )
        },
        async deleteFn(thresholdEntry) {
          const users = (
            await getDb({ name: 'hscc-api-qoverflow' })
          ).collection<InternalUser>('users');

          const usernames = (
            await users.find({ _id: { $lte: thresholdEntry._id } }).toArray()
          ).map((user) => user.username);

          await Promise.all(usernames.map((username) => deleteUser({ username })));
          return usernames.length;
        }
      }
    }
  };

  debug('limits: %O', limits);
  return limits;
};

/**
 * Runs maintenance on the database, ensuring collections do not grow too large.
 */
const invoked = async () => {
  try {
    const limits = getDbCollectionLimits(getEnv());

    await Promise.all(
      Object.entries(limits).map(async ([dbName, dbLimitsObj]) => {
        debug(`using db "${dbName}"`);
        const db = await getDb({ name: dbName });

        await Promise.all(
          Object.entries(dbLimitsObj).map(async ([collectionName, colLimitsObj]) => {
            const name = `${dbName}.${collectionName}`;
            debug(`collection "${name}" is a target for pruning`);

            const subLog = log.extend(name);
            const collection = db.collection(collectionName);
            const total = await collection.countDocuments();

            const {
              limit: limitSpec,
              orderBy = '_id',
              deleteFn = undefined
            } = colLimitsObj;

            let cursor: FindCursor<WithId<Document>>;

            const pruneCollectionAtThreshold = async (
              thresholdEntry: WithId<Document> | null,
              deleteFn: DataLimit['deleteFn'],
              successContext: string,
              failContext: string
            ) => {
              if (thresholdEntry) {
                debug(`determined threshold entry: ${thresholdEntry._id}`);
                let deletedCount: number;

                if (deleteFn) {
                  debug('using custom pruning strategy');
                  deletedCount = await deleteFn(thresholdEntry);
                } else {
                  debug('using default pruning strategy');
                  deletedCount = (
                    await collection.deleteMany({
                      [orderBy]: { $lte: thresholdEntry[orderBy] }
                    })
                  ).deletedCount;
                }

                subLog(`${deletedCount} pruned (${successContext})`);
              } else {
                subLog(`0 pruned (${failContext})`);
              }

              await cursor.close();
            };

            if ('maxBytes' in limitSpec) {
              debug('limiting metric: document size');

              const { maxBytes } = limitSpec;

              debug(`sorting ${name} by "${orderBy}"`);
              debug(
                `iteratively summing document size until limit is reached (${maxBytes} bytes)`
              );

              // TODO: Use $bsonSize operator to sort by most recent first, then
              // TODO: sum them until either documents are exhausted or total
              // TODO: size > limit, then delete the (old) documents that exist
              // TODO: beyond the limit.
              // TODO:
              // TODO: Also, replace all PRUNE_X numerical environment variables
              // TODO: with string variables representing byte amounts
              cursor = collection
                .find()
                .sort({ [orderBy]: -1 })
                .limit(1);

              const thresholdEntry = await cursor.next();

              await pruneCollectionAtThreshold(
                thresholdEntry,
                deleteFn,
                `size of ${total} entries > ${maxBytes} bytes`,
                `size of ${total} entries <= ${maxBytes} bytes`
              );
            } else {
              debug('limiting metric: document count');

              const { maxDocuments } = limitSpec;

              debug(`sorting ${name} by "${orderBy}"`);
              debug(`skipping ${maxDocuments} entries"`);

              cursor = collection
                .find()
                .sort({ [orderBy]: -1 })
                .skip(maxDocuments)
                .limit(1);

              const thresholdEntry = await cursor.next();

              await pruneCollectionAtThreshold(
                thresholdEntry,
                deleteFn,
                `${total} > ${maxDocuments}`,
                `${total} <= ${maxDocuments}`
              );
            }
          })
        );
      })
    );
  } catch (e) {
    throw new AppError(`${e}`);
  } finally {
    /* istanbul ignore if */
    if (['production', 'development'].includes(getEnv().NODE_ENV)) {
      await closeClient();
      log('execution complete');
      process.exit(0);
    } else {
      log('execution complete');
    }
  }
};

export default invoked().catch((e: Error) => {
  debug.error(e.message);
  process.exit(2);
});
