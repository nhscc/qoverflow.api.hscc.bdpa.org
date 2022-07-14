import jsonFile from 'jsonfile';

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
const cachePath = `${__dirname}/log-stats-cache.json`;

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

    const previousResults: Record<string, number> = await (async () => {
      try {
        debug(`reading in results from cache at ${cachePath}`);
        return await jsonFile.readFile(cachePath);
      } catch {
        return {};
      }
    })();

    debug('previous results: %O', previousResults);

    const db = await getDb({ name: 'root' });
    const requestLogDb = db.collection('request-log');
    const limitedLogDb = db.collection('limited-log');

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
          ],
          // ? Count requests per (header, endpoint)
          group_header_x_endpoints: [
            {
              $group: {
                _id: {
                  header: '$header',
                  endpoint: {
                    $cond: {
                      if: { $not: ['$endpoint'] },
                      then: '<unknown>',
                      else: '$endpoint'
                    }
                  }
                },
                requests: { $sum: 1 }
              }
            },
            {
              $group: {
                _id: '$_id.header',
                endpoints: {
                  $push: {
                    endpoint: '$_id.endpoint',
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
              '$group_header_x_status',
              '$group_header_x_endpoints'
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

    // ? Calculates duration percentiles: fastest, 50%, 90%, 95%, 99%, 99.9%,
    // ? and slowest
    const requestPercentilePipeline = [
      { $match: { durationMs: { $exists: true } } },
      { $sort: { durationMs: 1 } },
      {
        $group: {
          _id: null,
          durations: { $push: '$durationMs' }
        }
      },
      {
        $project: {
          _id: false,
          fastest: { $arrayElemAt: ['$durations', 0] },
          percentile_50: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.5, { $size: '$durations' }] } }
            ]
          },
          percentile_90: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.9, { $size: '$durations' }] } }
            ]
          },
          percentile_95: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.95, { $size: '$durations' }] } }
            ]
          },
          percentile_99: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.99, { $size: '$durations' }] } }
            ]
          },
          percentile_999: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.999, { $size: '$durations' }] } }
            ]
          },
          percentile_9999: {
            $arrayElemAt: [
              '$durations',
              { $floor: { $multiply: [0.9999, { $size: '$durations' }] } }
            ]
          },
          slowest: { $arrayElemAt: ['$durations', -1] }
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

    const requestLogCursor = requestLogDb.aggregate<{
      owner: string;
      token: string;
      header: string | null;
      normalRequests: number;
      preflightRequests: number;
      totalRequests: number;
      ips: { ip: string; requests: number }[];
      statuses: { status: number; requests: number }[];
      methods: { method: string; requests: number }[];
      endpoints: { endpoint: string; requests: number }[];
      latestAt: number;
    }>(requestLogPipeline);

    const percentileCursor = requestLogDb.aggregate<{
      fastest: number;
      percentile_50: number;
      percentile_90: number;
      percentile_95: number;
      percentile_99: number;
      percentile_999: number;
      percentile_9999: number;
      slowest: number;
    }>(requestPercentilePipeline);

    const limitedLogCursor = limitedLogDb.aggregate<{
      owner?: string;
      token?: string;
      header?: string | null;
      ip?: string;
      until: number;
    }>(limitedLogPipeline);

    const [requestLogStats, requestPercentiles, limitedLogStats] = await Promise.all([
      requestLogCursor.toArray(),
      percentileCursor.next(),
      limitedLogCursor.toArray()
    ]);

    await Promise.all([
      requestLogCursor.close(),
      percentileCursor.close(),
      limitedLogCursor.close()
    ]);

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
    debug(`requestPercentiles=${requestPercentiles}`);

    outputStrings.push(`\n::REQUEST LOG::${requestLogStats.length ? '\n' : ''}`);

    if (!requestLogStats.length) {
      outputStrings.push('  <request-log collection is empty>');
      Object.keys(previousResults).forEach((k) => {
        delete previousResults[k];
      });
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
          endpoints,
          statuses,
          latestAt
        }) => {
          addAuthInfo(owner, token, header);

          const headerString = String(header);
          const delta = previousResults[headerString]
            ? normalRequests - previousResults[headerString]
            : null;

          previousResults[headerString] = normalRequests;

          outputStrings.push(
            `  total requests: ${
              preflightRequests
                ? `${normalRequests} (+${preflightRequests} preflight, ${totalRequests} total)`
                : totalRequests
            }${
              delta !== null
                ? chalk.yellow(` (Δ${delta >= 0 ? `+${delta}` : delta})`)
                : ''
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

          outputStrings.push('  requests by endpoint:');

          endpoints
            .sort(byRequests)
            .forEach(({ endpoint, requests: requestsToEndpoint }) => {
              const str = `    ${endpoint} - ${requestsToEndpoint} requests`;
              outputStrings.push(endpoint == '<unknown>' ? chalk.gray(str) : str);
            });

          outputStrings.push('');
        }
      );

      outputStrings.push('  :PERCENTILES:');

      outputStrings.push(
        `   fastest: ${
          requestPercentiles?.fastest
            ? `${requestPercentiles.fastest}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `     50%<=: ${
          requestPercentiles?.percentile_50
            ? `${requestPercentiles.percentile_50}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `     90%<=: ${
          requestPercentiles?.percentile_90
            ? `${requestPercentiles.percentile_90}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `     95%<=: ${
          requestPercentiles?.percentile_95
            ? `${requestPercentiles.percentile_95}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `     99%<=: ${
          requestPercentiles?.percentile_99
            ? `${requestPercentiles.percentile_99}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `   99.9%<=: ${
          requestPercentiles?.percentile_999
            ? `${requestPercentiles.percentile_999}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `  99.99%<=: ${
          requestPercentiles?.percentile_9999
            ? `${requestPercentiles.percentile_9999}ms`
            : '<unknown>'
        }`
      );

      outputStrings.push(
        `   slowest: ${
          requestPercentiles?.slowest
            ? `${requestPercentiles.slowest}ms`
            : '<unknown>'
        }`
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

    debug(`writing out results to cache at ${cachePath}`);
    await jsonFile.writeFile(cachePath, previousResults);

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
