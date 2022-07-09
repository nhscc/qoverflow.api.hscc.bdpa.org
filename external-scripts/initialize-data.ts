import { AppError } from 'named-app-errors';

import { debugNamespace as namespace } from 'universe/constants';
import { getEnv } from 'universe/backend/env';

import { debugFactory } from 'multiverse/debug-extended';

const debugNamespace = `${namespace}:initialize-data`;

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
 * Setups up a database from scratch by creating collections (only if they do
 * not already exist) and populating them with a large amount of data. Suitable
 * for initializing local machines or production instances alike.
 *
 * This function is idempotent (can be called multiple times without changing
 * anything) and data-preserving (all actions are non-destructive: data is never
 * overwritten or deleted)
 */
const invoked = async () => {
  try {
    /* const {

    } = getEnv();

    if (!calledEverySeconds || !(Number(calledEverySeconds) > 0)) {
      throw new InvalidAppEnvironmentError(
        'BAN_HAMMER_WILL_BE_CALLED_EVERY_SECONDS must be greater than zero'
      );
    }

    const db = await getDb({ name: 'root' });

    debug('something or other: %O', pipeline);

    const cursor = db.collection('request-log').aggregate(pipeline);

    await cursor.next();
    await cursor.close();*/
    void debug;
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
