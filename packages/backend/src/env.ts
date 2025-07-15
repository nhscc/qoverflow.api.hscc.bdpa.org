import { getEnv as getDefaultEnv } from '@-xun/env';
import { parse as parseAsBytes } from 'bytes';

import { ServerValidationError } from 'multiverse+shared:error.ts';

import type { Environment } from '@-xun/env';

let envOverrides: Environment = {};

// TODO: replace validation logic with arktype instead (including defaults)

/**
 * Returns an object representing the application's runtime environment.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function getEnv<T extends Environment = Environment>() {
  const env = {
    ...getDefaultEnv({
      MAX_PARAMS_PER_REQUEST: Number(process.env.MAX_PARAMS_PER_REQUEST) || 100,
      MIN_USER_NAME_LENGTH: Number(process.env.MIN_USER_NAME_LENGTH) || 4,
      MAX_USER_NAME_LENGTH: Number(process.env.MAX_USER_NAME_LENGTH) || 16,
      MIN_USER_EMAIL_LENGTH: Number(process.env.MIN_USER_EMAIL_LENGTH) || 4,
      MAX_USER_EMAIL_LENGTH: Number(process.env.MAX_USER_EMAIL_LENGTH) || 75,
      USER_SALT_LENGTH: Number(process.env.USER_SALT_LENGTH) || 32,
      USER_KEY_LENGTH: Number(process.env.USER_KEY_LENGTH) || 128,
      MAX_COMMENT_LENGTH: Number(process.env.MAX_COMMENT_LENGTH) || 150,
      MAX_QUESTION_TITLE_LENGTH: Number(process.env.MAX_QUESTION_TITLE_LENGTH) || 150,
      MAX_QUESTION_BODY_LENGTH_BYTES:
        parseAsBytes(process.env.MAX_QUESTION_BODY_LENGTH_BYTES ?? '-Infinity') || 3000,
      MAX_ANSWER_BODY_LENGTH_BYTES:
        parseAsBytes(process.env.MAX_ANSWER_BODY_LENGTH_BYTES ?? '-Infinity') || 3000,
      MAX_MAIL_SUBJECT_LENGTH:
        parseAsBytes(process.env.MAX_MAIL_SUBJECT_LENGTH ?? '-Infinity') || 75,
      MAX_MAIL_BODY_LENGTH_BYTES:
        parseAsBytes(process.env.MAX_MAIL_BODY_LENGTH_BYTES ?? '-Infinity') || 512
    }),
    ...envOverrides
  };

  /* istanbul ignore next */
  if (env.NODE_ENV !== 'test') {
    const errors: string[] = [];

    (
      [
        'MAX_PARAMS_PER_REQUEST',
        'MAX_USER_NAME_LENGTH',
        'MAX_USER_EMAIL_LENGTH',
        'MIN_USER_EMAIL_LENGTH',
        'USER_SALT_LENGTH',
        'USER_KEY_LENGTH',
        'MAX_COMMENT_LENGTH',
        'MAX_QUESTION_TITLE_LENGTH',
        'MAX_QUESTION_BODY_LENGTH_BYTES',
        'MAX_ANSWER_BODY_LENGTH_BYTES',
        'MAX_MAIL_BODY_LENGTH_BYTES'
      ] as (keyof typeof env)[]
    ).forEach((name) => {
      const value = env[name];
      if (!value || !Number.isSafeInteger(value) || (value as number) <= 0) {
        errors.push(
          `bad ${name}, saw "${String(env[name])}" (expected a safe non-negative number)`
        );
      }
    });

    if (env.MIN_USER_NAME_LENGTH >= env.MAX_USER_NAME_LENGTH) {
      errors.push(
        'MIN_USER_NAME_LENGTH must be strictly less than MAX_USER_NAME_LENGTH'
      );
    }

    if (env.MIN_USER_EMAIL_LENGTH >= env.MAX_USER_EMAIL_LENGTH) {
      errors.push(
        'MIN_USER_EMAIL_LENGTH must be strictly less than MAX_USER_EMAIL_LENGTH'
      );
    }

    if (errors.length) {
      throw new ServerValidationError(`bad variables:\n - ${errors.join('\n - ')}`);
    }
  }

  return env as typeof env & T;
}

/**
 * Set an internal `overrides` object that will be merged over any environment
 * variables coming from `process.env`. The values of `overrides` _must_ be in
 * their final form, e.g. of type `number` (✅ `42`) instead of a string (🚫
 * `"42"`), the latter being what the real `process.env` would provide but that
 * this function does not support.
 *
 * This function should only be used in a multitenant situation where relying on
 * exclusive access to `process.env` is not possible (e.g. `@nhscc/bdpa-cli`).
 */
export function overwriteEnv(overrides: typeof envOverrides) {
  envOverrides = overrides;
}
