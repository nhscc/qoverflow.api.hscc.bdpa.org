import { toss } from 'toss-expression';
import {
  AppError,
  GuruMeditationError,
  InvalidAppEnvironmentError
} from 'named-app-errors';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';
import { deleteUser } from 'universe/backend';

import { debugFactory } from 'multiverse/debug-extended';
import { closeClient, getDb } from 'multiverse/mongo-schema';

import type {
  AggregationCursor,
  Document,
  FindCursor,
  ObjectId,
  WithId
} from 'mongodb';
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
            env.PRUNE_DATA_MAX_LOGS_BYTES && env.PRUNE_DATA_MAX_LOGS_BYTES > 0
              ? env.PRUNE_DATA_MAX_LOGS_BYTES
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_LOGS_BYTES must be greater than zero'
                  )
                )
        }
      },
      'limited-log': {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_BANNED_BYTES && env.PRUNE_DATA_MAX_BANNED_BYTES > 0
              ? env.PRUNE_DATA_MAX_BANNED_BYTES
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_BANNED_BYTES must be greater than zero'
                  )
                )
        }
      }
    },
    'hscc-api-qoverflow': {
      mail: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_MAIL_BYTES && env.PRUNE_DATA_MAX_MAIL_BYTES > 0
              ? env.PRUNE_DATA_MAX_MAIL_BYTES
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_MAIL_BYTES must be greater than zero'
                  )
                )
        }
      },
      questions: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_QUESTIONS_BYTES &&
            env.PRUNE_DATA_MAX_QUESTIONS_BYTES > 0
              ? env.PRUNE_DATA_MAX_QUESTIONS_BYTES
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_QUESTIONS_BYTES must be greater than zero'
                  )
                )
        }
      },
      users: {
        limit: {
          maxBytes:
            env.PRUNE_DATA_MAX_USERS_BYTES && env.PRUNE_DATA_MAX_USERS_BYTES > 0
              ? env.PRUNE_DATA_MAX_USERS_BYTES
              : toss(
                  new InvalidAppEnvironmentError(
                    'PRUNE_DATA_MAX_USERS_BYTES must be greater than zero'
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
            const totalCount = await collection.countDocuments();

            const {
              limit: limitSpec,
              orderBy = '_id',
              deleteFn = undefined
            } = colLimitsObj;

            const pruneCollectionAtThreshold = async (
              thresholdEntry: WithId<Document> | null,
              deleteFn: DataLimit['deleteFn'],
              pruneMessage: string,
              noPruneMessage: string
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

                subLog(`${deletedCount} pruned (${pruneMessage})`);
              } else {
                subLog(`0 pruned (${noPruneMessage})`);
              }
            };

            if ('maxBytes' in limitSpec) {
              debug('limiting metric: document size');

              const { maxBytes } = limitSpec;

              debug(`sorting ${name} by "${orderBy}"`);
              debug(
                `iteratively summing document size until limit is reached (${maxBytes} bytes)`
              );

              // ? Use $bsonSize operator to sort by most recent first, then sum
              // ? them until either documents are exhausted or total size >
              // ? limit, then delete the (old) documents that exist beyond the
              // ? limit.
              const cursor = collection.aggregate<WithId<{ size: number }>>([
                { $sort: { [orderBy]: -1 } },
                { $project: { _id: true, size: { $bsonSize: '$$ROOT' } } }
              ]);

              let totalSizeBytes = 0;
              let thresholdId: ObjectId | null = null;
              let foundThresholdId = false;

              (await cursor.toArray()).forEach(({ _id, size }) => {
                if (!thresholdId) {
                  thresholdId = _id;
                }

                totalSizeBytes += size;

                if (!foundThresholdId) {
                  if (totalSizeBytes > maxBytes) {
                    foundThresholdId = true;
                  } else {
                    thresholdId = _id;
                  }
                }
              });

              await pruneCollectionAtThreshold(
                foundThresholdId && thresholdId ? { _id: thresholdId } : null,
                deleteFn,
                `${totalCount} entries, ${totalSizeBytes}b > ${maxBytes} bytes`,
                `${totalCount} entries, ${totalSizeBytes}b <= ${maxBytes} bytes`
              ).then(() => cursor.close());
            } else {
              debug('limiting metric: document count');

              const { maxDocuments } = limitSpec;

              if (!maxDocuments) {
                throw new GuruMeditationError('invalid limit spec');
              }

              debug(`sorting ${name} by "${orderBy}"`);
              debug(`skipping ${maxDocuments} entries"`);

              const cursor = collection
                .find()
                .sort({ [orderBy]: -1 })
                .skip(maxDocuments)
                .limit(1);

              const thresholdEntry = await cursor.next();

              await pruneCollectionAtThreshold(
                thresholdEntry,
                deleteFn,
                `${totalCount} > ${maxDocuments}`,
                `${totalCount} <= ${maxDocuments}`
              ).then(() => cursor.close());
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
