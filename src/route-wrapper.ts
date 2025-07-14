import { middlewareFactory } from '@-xun/api';
import { makeMiddleware as makeAuthMiddleware } from '@-xun/api/middleware/auth-request';
import { makeMiddleware as makeContentTypeMiddleware } from '@-xun/api/middleware/check-content-type';
import { makeMiddleware as makeMethodMiddleware } from '@-xun/api/middleware/check-method';
import { makeMiddleware as makeVersionMiddleware } from '@-xun/api/middleware/check-version';
import { makeMiddleware as makeDatabaseMiddleware } from '@-xun/api/middleware/connect-databases';
import { makeMiddleware as makeContrivedMiddleware } from '@-xun/api/middleware/contrive-error';
import { makeMiddleware as makeLimitMiddleware } from '@-xun/api/middleware/enforce-limits';
import { makeMiddleware as makeErrorHandlingMiddleware } from '@-xun/api/middleware/handle-error';
import { makeMiddleware as makeLoggingMiddleware } from '@-xun/api/middleware/log-request';
import { makeMiddleware as makeCorsMiddleware } from '@-xun/api/middleware/use-cors';
import { getSchemaConfig } from '@nhscc/backend-qoverflow~npm/db';

import type { Options as AuthMiddlewareOptions } from '@-xun/api/middleware/auth-request';
import type { Options as ContentTypeMiddlewareOptions } from '@-xun/api/middleware/check-content-type';
import type { Options as MethodMiddlewareOptions } from '@-xun/api/middleware/check-method';
import type { Options as VersionMiddlewareOptions } from '@-xun/api/middleware/check-version';
import type { Options as DatabaseMiddlewareOptions } from '@-xun/api/middleware/connect-databases';
import type { Options as ContrivedMiddlewareOptions } from '@-xun/api/middleware/contrive-error';
import type { Options as LimitMiddlewareOptions } from '@-xun/api/middleware/enforce-limits';

import type {
  LegacyErrorHandler,
  Options as ErrorHandlingMiddlewareOptions
} from '@-xun/api/middleware/handle-error';

import type { Options as LoggingMiddlewareOptions } from '@-xun/api/middleware/log-request';
import type { Options as CorsMiddlewareOptions } from '@-xun/api/middleware/use-cors';

type ExposedOptions = LoggingMiddlewareOptions &
  ContentTypeMiddlewareOptions &
  MethodMiddlewareOptions &
  VersionMiddlewareOptions;

type GenericErrorHandlingMiddlewareOptions = ErrorHandlingMiddlewareOptions<
  LegacyErrorHandler<Record<string, unknown>, Record<PropertyKey, unknown>>
>;

/**
 * The shape of an API endpoint metadata object.
 *
 * This export is heavily relied upon by most of the testing infrastructure and
 * should be exported alongside `defaultEndpointConfig`/`config` in every
 * Next.js API handler file.
 */
export type EndpointMetadata = ExposedOptions & { descriptor: string };

/**
 * Primary middleware runner for the REST API.
 */
/* istanbul ignore next */
const withMiddleware = middlewareFactory<
  ExposedOptions &
    DatabaseMiddlewareOptions &
    LoggingMiddlewareOptions &
    CorsMiddlewareOptions &
    AuthMiddlewareOptions &
    // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
    LimitMiddlewareOptions &
    ContrivedMiddlewareOptions &
    GenericErrorHandlingMiddlewareOptions
>({
  use: [
    makeDatabaseMiddleware(),
    makeLoggingMiddleware(),
    makeCorsMiddleware(),
    makeVersionMiddleware(),
    makeAuthMiddleware(),
    makeLimitMiddleware(),
    makeMethodMiddleware(),
    makeContentTypeMiddleware(),
    makeContrivedMiddleware()
  ],
  useOnError: [makeErrorHandlingMiddleware()],
  options: {
    legacyMode: true,
    allowedContentTypes: ['application/json'],
    requiresAuth: true,
    enableContrivedErrors: true,
    database: {
      schema() {
        return getSchemaConfig();
      },
      data() {
        const { getDummyData } = require(
          // ? This expression prevents webpack/turbopack from bundling things
          '@nhscc/backend-qoverflow~npm/dummy'.toString()
        ) as typeof import('@nhscc/backend-qoverflow~npm/dummy');

        return getDummyData();
      }
    }
  }
});

/**
 * Middleware runner for the special /sys API endpoints.
 */
/* istanbul ignore next */
const withSysMiddleware = middlewareFactory<
  DatabaseMiddlewareOptions &
    LoggingMiddlewareOptions &
    AuthMiddlewareOptions &
    // eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
    LimitMiddlewareOptions &
    MethodMiddlewareOptions &
    ContentTypeMiddlewareOptions &
    GenericErrorHandlingMiddlewareOptions
>({
  use: [
    makeDatabaseMiddleware(),
    makeLoggingMiddleware(),
    makeAuthMiddleware(),
    makeLimitMiddleware(),
    makeMethodMiddleware(),
    makeContentTypeMiddleware()
  ],
  useOnError: [makeErrorHandlingMiddleware()],
  options: {
    legacyMode: true,
    allowedContentTypes: ['application/json'],
    requiresAuth: { filter: { isGlobalAdmin: true } },
    database: {
      schema() {
        return getSchemaConfig();
      },
      data() {
        const { getDummyData } = require(
          // ? This expression prevents webpack/turbopack from bundling things
          '@nhscc/backend-qoverflow~npm/dummy'.toString()
        ) as typeof import('@nhscc/backend-qoverflow~npm/dummy');

        return getDummyData();
      }
    }
  }
});

export { withMiddleware, withSysMiddleware };
