import { disableLoggers, enableLoggers, LoggerType } from 'rejoinder';

import { defaultConfig } from 'universe/backend/api';

import type { withMockedEnv } from '@-xun/jest';
import type { NextApiHandler, NextApiRequest, NextApiResponse, PageConfig } from 'next';

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
