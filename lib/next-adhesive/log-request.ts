import { randomUUID } from 'node:crypto';
import { performance as perf } from 'node:perf_hooks';

import { addToRequestLog } from 'multiverse/next-log';
import { debugFactory } from 'multiverse/debug-extended';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { MiddlewareContext } from 'multiverse/next-api-glue';

const debug = debugFactory('next-adhesive:log-request');

export type Options = {
  // No options
};

/**
 * Logs the response to each request after it is sent (i.e. `res.end()`).
 */
export default async function (
  req: NextApiRequest,
  res: NextApiResponse,
  context: MiddlewareContext<Options>
) {
  debug('entered middleware runtime');

  const perfUUID = randomUUID();
  perf.mark(perfUUID);

  const send = res.end;
  res.end = ((...args: Parameters<typeof res.end>) => {
    const sent = res.writableEnded;
    send(...args);

    if (!sent) {
      debug('logging request after initial call to res.end');
      // ! Note that this async function is NOT awaited!!!
      void addToRequestLog({
        req,
        res,
        endpoint: context.runtime.endpoint.descriptor,
        // @ts-expect-error: @types/node is broken... *sigh*
        durationMs: Math.floor(perf.measure(randomUUID(), perfUUID).duration)
      });
    }
  }) as typeof res.end;
}
