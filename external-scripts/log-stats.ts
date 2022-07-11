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
        $facet: {
          // ? Select the latest timestamp per (header)
          group_header_x_latest: [
            {
              $group: {
                _id: '$header',
                latestAt: { $max: '$createdAt' }
              }
            }
          ],
          // ? Count requests per (header)
          group_header: [
            {
              $group: {
                _id: '$header',
                totalRequests: { $sum: 1 },
                preflightRequests: {
                  $sum: {
                    $cond: { if: { $eq: ['$method', 'OPTIONS'] }, then: 1, else: 0 }
                  }
                },
                normalRequests: {
                  $sum: {
                    $cond: { if: { $eq: ['$method', 'OPTIONS'] }, then: 0, else: 1 }
                  }
                }
              }
            }
          ],
          // ? Count requests per (header, ip)
          group_header_x_ip: [
            {
              $group: {
                _id: { header: '$header', ip: '$ip' },
                requests: { $sum: 1 }
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
                }
              }
            }
          ],
          // ? Count requests per (header, method)
          group_header_x_method: [
            {
              $group: {
                _id: { header: '$header', method: '$method' },
                requests: { $sum: 1 }
              }
            },
            {
              $group: {
                _id: '$_id.header',
                methods: {
                  $push: {
                    method: '$_id.method',
                    requests: '$requests'
                  }
                }
              }
            }
          ],
          // ? Count requests per (header, status)
          group_header_x_status: [
            {
              $group: {
                _id: { header: '$header', status: '$resStatusCode' },
                requests: { $sum: 1 }
              }
            },
            {
              $group: {
                _id: '$_id.header',
                statuses: {
                  $push: {
                    status: '$_id.status',
                    requests: '$requests'
                  }
                }
              }
            }
          ]
        }
      },

      // ? Merge stats into per-header documents
      {
        $project: {
          headerStats: {
            $concatArrays: [
              '$group_header_x_latest',
              '$group_header',
              '$group_header_x_ip',
              '$group_header_x_method',
              '$group_header_x_status'
            ]
          }
        }
      },
      {
        $unwind: '$headerStats'
      },
      {
        $group: {
          _id: '$headerStats._id',
          stats: { $mergeObjects: '$$ROOT.headerStats' }
        }
      },
      {
        $replaceRoot: { newRoot: '$stats' }
      },

      // ? Sort results by greatest number of requests
      {
        $sort: { normalRequests: -1 }
      },

      // ? Add relevant fields
      {
        $addFields: {
          header: '$_id',
          token: { $arrayElemAt: [{ $split: ['$_id', ' '] }, 1] }
        }
      },

      // ? Cross-reference tokens with identity data
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

      // ? Beautify output
      {
        $addFields: {
          owner: { $ifNull: ['$attributes.owner', '<unauthenticated>'] },
          token: {
            $cond: {
              if: { $gt: ['$attributes.owner', null] },
              then: { $ifNull: ['$token', '<none>'] },
              else: '<unauthenticated>'
            }
          }
        }
      },
      {
        $project: {
          _id: false,
          attributes: false,
          auth: false,
          scheme: false
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

    const byRequests = (a: { requests: number }, b: { requests: number }) =>
      b.requests - a.requests;

    const requestLogCursor = db.collection('request-log').aggregate<{
      owner: string;
      token: string;
      header: string | null;
      normalRequests: number;
      preflightRequests: number;
      totalRequests: number;
      ips: { ip: string; requests: number }[];
      statuses: { status: number; requests: number }[];
      methods: { method: string; requests: number }[];
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
      requestLogStats.forEach(
        ({
          owner,
          token,
          header,
          normalRequests,
          preflightRequests,
          totalRequests,
          ips,
          methods,
          statuses,
          latestAt
        }) => {
          addAuthInfo(owner, token, header);

          outputStrings.push(
            `  total requests: ${
              preflightRequests
                ? `${normalRequests} (+${preflightRequests} preflight, ${totalRequests} total)`
                : totalRequests
            }`
          );

          outputStrings.push(
            `  most recent request: ${new Date(latestAt).toLocaleString()}`
          );

          outputStrings.push('  requests by ip:');

          ips.forEach(({ ip, requests: requestsFromIp }) =>
            outputStrings.push(`    ${ip} - ${requestsFromIp} requests`)
          );

          outputStrings.push('  requests by HTTP status code:');

          statuses
            .sort(byRequests)
            .forEach(({ status, requests: requestResponseStatus }) => {
              const str = `    ${status} - ${requestResponseStatus} requests`;
              outputStrings.push(status == 429 ? chalk.red(str) : str);
              outputStrings.push();
            });

          outputStrings.push('  requests by HTTP method:');

          methods
            .sort(byRequests)
            .forEach(({ method, requests: requestsOfMethod }) => {
              const str = `    ${method} - ${requestsOfMethod} requests`;
              outputStrings.push(method == 'OPTIONS' ? chalk.gray(str) : str);
            });

          outputStrings.push('');
        }
      );
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
