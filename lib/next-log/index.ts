import { getClientIp } from 'request-ip';

import { getEnv } from 'multiverse/next-env';
import { getDb } from 'multiverse/mongo-schema';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { HttpStatusCode, UnixEpochMs } from '@xunnamius/types';
import type { WithId, WithoutId } from 'mongodb';

/**
 * The shape of an entry in the well-known "request log" collection.
 */
export type InternalRequestLogEntry = WithId<{
  ip: string | null;
  header: string | null;
  route: string | null;
  endpoint: string | null;
  method: string | null;
  resStatusCode: HttpStatusCode;
  createdAt: UnixEpochMs;
  durationMs: number;
}>;

/**
 * The shape of a new entry in the well-known "request log" collection.
 */
export type NewRequestLogEntry = WithoutId<InternalRequestLogEntry>;

/**
 * This function adds a request metadata entry to the database.
 *
 * Note that this async function **does not have to be awaited**. It's fire and
 * forget!
 *
 * @example
 * ```
 * doSomeStuff();
 * void addToRequestLog({ req, res, endpoint });
 * doSomeOtherStuff();
 * ```
 */
export async function addToRequestLog({
  req,
  res,
  endpoint,
  durationMs
}: {
  req: NextApiRequest;
  res: NextApiResponse;
  endpoint: string | null | undefined;
  durationMs: number;
}): Promise<void> {
  if (!endpoint) {
    // eslint-disable-next-line no-console
    console.warn(
      `${
        req.url ? `API endpoint at ${req.url}` : 'an API endpoint'
      } is missing its descriptor metadata`
    );
  }

  await (await getDb({ name: 'root' }))
    .collection<NewRequestLogEntry>('request-log')
    .insertOne({
      ip: getClientIp(req),
      header:
        req.headers.authorization
          ?.slice(0, getEnv().AUTH_HEADER_MAX_LENGTH)
          .toLowerCase() || null,
      method: req.method?.toUpperCase() || null,
      route: req.url || null,
      endpoint: endpoint || null,
      resStatusCode: res.statusCode as HttpStatusCode,
      createdAt: Date.now(),
      durationMs
    });
}
