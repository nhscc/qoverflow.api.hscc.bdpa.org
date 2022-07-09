import {
  AppError,
  GuruMeditationError,
  InvalidAppEnvironmentError
} from 'named-app-errors';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';

import { getDb } from 'multiverse/mongo-schema';
import { debugFactory } from 'multiverse/debug-extended';

const debugNamespace = `${namespace}:log-stats`;

const log = debugFactory(debugNamespace);
const debug = debugFactory(`${debugNamespace}:debug`);

// eslint-disable-next-line no-console
log.log = console.info.bind(console);

// ? Ensure this next line survives Webpack
if (!globalThis.process.env.DEBUG && getEnv().NODE_ENV != 'test') {
  debugFactory.enable(
    `${debugNamespace},${debugNamespace}:*,-${debugNamespace}:debug`
  );
}

/**
 * Pores over request-log entries and drops the ban hammer on rule breaking
 * clients.
 */
const invoked = async () => {
  try {
    if (!getEnv().MONGODB_URI) {
      throw new InvalidAppEnvironmentError(
        'MONGODB_URI must be a valid mongodb connection string'
      );
    }

    log('compiling statistics...');

    const db = await getDb({ name: 'root' });

    const requestLogPipeline = [
      {
        $group: {
          _id: {
            ip: '$ip',
            header: '$header'
          },
          requests: { $sum: 1 },
          latestAt: { $max: '$createdAt' }
        }
      },
      {
        $group: {
          _id: '$_id.header',
          ips: {
            $push: {
              ip: '$_id.ip',
              requests: '$requests'
            }
          },
          requests: { $sum: '$requests' },
          latestAt: { $max: '$latestAt' }
        }
      },
      {
        $sort: { requests: -1 }
      },
      {
        $project: {
          _id: false,
          header: '$_id',
          token: { $arrayElemAt: [{ $split: ['$_id', ' '] }, 1] },
          requests: true,
          ips: true,
          latestAt: true
        }
      },
      {
        $lookup: {
          from: 'auth',
          localField: 'token',
          foreignField: 'token.bearer',
          as: 'auth'
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [{ $arrayElemAt: ['$auth', 0] }, '$$ROOT']
          }
        }
      },
      {
        $project: {
          _id: false,
          owner: { $ifNull: ['$attributes.owner', '<unauthenticated>'] },
          token: {
            $cond: {
              if: { $gt: ['$attributes.owner', null] },
              then: { $ifNull: ['$token', '<none>'] },
              else: '<unauthenticated>'
            }
          },
          header: true,
          requests: true,
          ips: true,
          latestAt: true
        }
      }
    ];

    const limitedLogPipeline = [
      {
        $project: {
          _id: false,
          header: true,
          token: { $arrayElemAt: [{ $split: ['$header', ' '] }, 1] },
          ip: true,
          until: true
        }
      },
      {
        $lookup: {
          from: 'auth',
          localField: 'token',
          foreignField: 'token.bearer',
          as: 'auth'
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [{ $arrayElemAt: ['$auth', 0] }, '$$ROOT']
          }
        }
      },
      {
        $project: {
          owner: { $ifNull: ['$attributes.owner', '<unauthenticated>'] },
          token: {
            $cond: {
              if: { $gt: ['$attributes.owner', null] },
              then: { $ifNull: ['$token', '<none>'] },
              else: '<unauthenticated>'
            }
          },
          header: true,
          ip: true,
          until: true,
          dummy: true
        }
      },
      {
        $sort: { until: -1, _id: -1 }
      },
      {
        $project: {
          _id: false,
          dummy: false
        }
      }
    ];

    debug('request-log aggregation pipeline: %O', requestLogPipeline);
    debug('limited-log aggregation pipeline: %O', limitedLogPipeline);

    const requestLogCursor = db.collection('request-log').aggregate<{
      owner: string;
      token: string;
      header: string | null;
      requests: number;
      ips: { ip: string; requests: number }[];
      latestAt: number;
    }>(requestLogPipeline);

    const limitedLogCursor = db.collection('limited-log').aggregate<{
      owner?: string;
      token?: string;
      header?: string | null;
      ip?: string;
      until: number;
    }>(limitedLogPipeline);

    const requestLogStats = await requestLogCursor.toArray();
    const limitedLogStats = await limitedLogCursor.toArray();

    const chalk = (await import('chalk')).default;
    const outputStrings: string[] = [];

    const addAuthInfo = (
      owner: string,
      token: string,
      header: string | null,
      error = false
    ) => {
      outputStrings.push(
        `  owner: ${
          owner == '<unauthenticated>'
            ? chalk.gray(owner)
            : chalk[error ? 'red' : 'green'].bold(owner)
        }`
      );

      outputStrings.push(
        `  token: ${token == '<unauthenticated>' ? chalk.gray(token) : token}`
      );

      outputStrings.push(`  header: ${!header ? chalk.gray(header) : header}`);
    };

    debug('compiling output');
    debug(`requestLogStats.length=${requestLogStats.length}`);
    debug(`limitedLogStats.length=${limitedLogStats.length}`);

    outputStrings.push(`\n::REQUEST LOG::${requestLogStats.length ? '\n' : ''}`);

    if (!requestLogStats.length) {
      outputStrings.push('  <request-log collection is empty>');
    } else {
      requestLogStats.forEach(({ owner, token, header, requests, ips, latestAt }) => {
        addAuthInfo(owner, token, header);
        outputStrings.push(`  total requests: ${requests}`);
        outputStrings.push(
          `  most recent request: ${new Date(latestAt).toLocaleString()}`
        );
        outputStrings.push('  requests by ip:');

        ips.forEach(({ ip, requests: requestsFromIp }) =>
          outputStrings.push(`    ${ip} - ${requestsFromIp} requests`)
        );

        outputStrings.push('');
      });
    }

    outputStrings.push(`\n::LIMIT LOG::${limitedLogStats.length ? '\n' : ''}`);

    if (!limitedLogStats.length) {
      outputStrings.push('  <limited-log collection is empty>');
    } else {
      limitedLogStats.forEach(({ owner, token, header, ip, until }) => {
        const now = Date.now();
        const banned = until > now;

        if (owner && token && header !== undefined) {
          addAuthInfo(owner, token, header, banned);
        } else if (ip) {
          outputStrings.push(`  ip: ${ip}`);
        } else {
          throw new GuruMeditationError('encountered malformed limit log data');
        }

        outputStrings.push(
          `  status: ${
            !banned
              ? chalk.gray('expired')
              : chalk.red.bold(
                  `banned until ${new Date(until - now).toLocaleString()}`
                )
          }`
        );

        outputStrings.push('');
      });
    }

    log(outputStrings.join('\n'));

    await requestLogCursor.close();

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
