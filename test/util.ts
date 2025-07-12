/**
 ** This file exports test utilities specific to this project and beyond what is
 ** exported by @-xun/jest; these can be imported using the testversal aliases.
 */

import { disableLoggers, enableLoggers, LoggerType } from 'rejoinder';

import { defaultConfig } from '@nhscc/backend-qoverflow/api';

import type { withMockedEnv } from '@-xun/jest';
import type { NextApiHandler, NextApiRequest, NextApiResponse, PageConfig } from 'next';

// ? These will always come from @-xun/symbiote and @-xun/jest (transitively)
// {@symbiote/notInvalid
//   - @-xun/jest
//   - @-xun/test-mock-argv
//   - @-xun/test-mock-exit
//   - @-xun/test-mock-import
//   - @-xun/test-mock-env
//   - @-xun/test-mock-fixture
//   - @-xun/test-mock-output
// }

export * from '@-xun/jest';

/**
 * A mock Next.js API handler that sends an empty object Reponse with a 200
 * status code.
 */
export const noopHandler = async (_req: NextApiRequest, res: NextApiResponse) => {
  res.status(200).send({});
};

/**
 * This function wraps mock Next.js API handler functions so that they provide
 * the default (or a custom) API configuration object.
 */
export const wrapHandler = (pagesHandler: NextApiHandler, config?: PageConfig) => {
  const api = async (req: NextApiRequest, res: NextApiResponse) =>
    pagesHandler(req, res);
  api.config = config || defaultConfig;
  return api;
};

/**
 * Enable all rejoinder's debug loggers.
 *
 * Use this function when you're UNWISELY relying on debug output to test
 * functionality.
 *
 * **That is: don't delete/unwrap this when you see it!**
 */
export async function withDebugEnabled(fn: Parameters<typeof withMockedEnv>[0]) {
  enableLoggers({ type: LoggerType.DebugOnly });

  try {
    await fn();
  } finally {
    disableLoggers({ type: LoggerType.DebugOnly });
  }
}
