import { parse as parseAsBytes } from 'bytes';
import { getEnv as getDefaultEnv } from 'multiverse/next-env';
import { InvalidAppEnvironmentError } from 'universe/error';

import type { Environment } from 'multiverse/next-env';

/**
 * Returns an object representing the application's runtime environment.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function getEnv<T extends Environment = Environment>() {
  const env = getDefaultEnv({
    STACKAPPS_AUTH_KEY: process.env.STACKAPPS_AUTH_KEY || null,
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
      parseAsBytes(process.env.MAX_MAIL_BODY_LENGTH_BYTES ?? '-Infinity') || 512,

    PRUNE_DATA_MAX_MAIL_BYTES:
      parseAsBytes(process.env.PRUNE_DATA_MAX_MAIL_BYTES ?? '-Infinity') || null,
    PRUNE_DATA_MAX_QUESTIONS_BYTES:
      parseAsBytes(process.env.PRUNE_DATA_MAX_QUESTIONS_BYTES ?? '-Infinity') || null,
    PRUNE_DATA_MAX_USERS_BYTES:
      parseAsBytes(process.env.PRUNE_DATA_MAX_USERS_BYTES ?? '-Infinity') || null
  });

  // TODO: retire all of the following logic when expect-env is created. Also,
  // TODO: expect-env should have the ability to skip runs on certain NODE_ENV
  // TODO: unless OVERRIDE_EXPECT_ENV is properly defined.
  /* istanbul ignore next */
  if (
    (env.NODE_ENV != 'test' && env.OVERRIDE_EXPECT_ENV != 'force-no-check') ||
    env.OVERRIDE_EXPECT_ENV == 'force-check'
  ) {
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
      if (!value || value <= 0) {
        errors.push(
          `bad ${name}, saw "${env[name]}" (expected a non-negative number)`
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

    // TODO: make it easier to reuse error code from getDefaultEnv. Or is it
    // TODO: obsoleted by expect-env package? Either way, factor this logic out!
    if (errors.length) {
      throw new InvalidAppEnvironmentError(
        `bad variables:\n - ${errors.join('\n - ')}`
      );
    }
  }

  return env as typeof env & T;
}
