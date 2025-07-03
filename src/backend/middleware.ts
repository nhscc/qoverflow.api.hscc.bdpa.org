/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */

import { middlewareFactory } from '@-xun/api';
import { makeMiddleware as makeAuthMiddleware } from '@-xun/api/middleware/auth-request';
import { makeMiddleware as makeContentTypeMiddleware } from '@-xun/api/middleware/check-content-type';
import { makeMiddleware as makeMethodMiddleware } from '@-xun/api/middleware/check-method';
import { makeMiddleware as makeVersionMiddleware } from '@-xun/api/middleware/check-version';
import { makeMiddleware as makeContrivedMiddleware } from '@-xun/api/middleware/contrive-error';
import { makeMiddleware as makeLimitMiddleware } from '@-xun/api/middleware/enforce-limits';
import { makeMiddleware as makeErrorHandlingMiddleware } from '@-xun/api/middleware/handle-error';
import { makeMiddleware as makeLoggingMiddleware } from '@-xun/api/middleware/log-request';
import { makeMiddleware as makeCorsMiddleware } from '@-xun/api/middleware/use-cors';
import { getDb, setSchemaConfig } from '@-xun/mongo-schema';
import { hydrateDbWithDummyData, setDummyData } from '@-xun/mongo-test';
import { createDebugLogger } from 'rejoinder';

import { getSchemaConfig } from 'universe/backend/db';
import { getEnv } from 'universe/backend/env';

import type {
  Context as AuthMiddlewareContext,
  Options as AuthMiddlewareOptions
} from '@-xun/api/middleware/auth-request';

import type {
  Context as ContentTypeMiddlewareContext,
  Options as ContentTypeMiddlewareOptions
} from '@-xun/api/middleware/check-content-type';

import type {
  Context as MethodMiddlewareContext,
  Options as MethodMiddlewareOptions
} from '@-xun/api/middleware/check-method';

import type {
  Context as VersionMiddlewareContext,
  Options as VersionMiddlewareOptions
} from '@-xun/api/middleware/check-version';

import type {
  Context as ContrivedMiddlewareContext,
  Options as ContrivedMiddlewareOptions
} from '@-xun/api/middleware/contrive-error';

import type {
  Context as LimitMiddlewareContext,
  Options as LimitMiddlewareOptions
} from '@-xun/api/middleware/enforce-limits';

import type {
  Context as ErrorHandlingMiddlewareContext,
  LegacyErrorHandler,
  Options as ErrorHandlingMiddlewareOptions
} from '@-xun/api/middleware/handle-error';

import type {
  Context as LoggingMiddlewareContext,
  Options as LoggingMiddlewareOptions
} from '@-xun/api/middleware/log-request';

import type {
  Context as CorsMiddlewareContext,
  Options as CorsMiddlewareOptions
} from '@-xun/api/middleware/use-cors';

type ExposedOptions = LoggingMiddlewareOptions &
  ContentTypeMiddlewareOptions &
  MethodMiddlewareOptions &
  VersionMiddlewareOptions;

type GenericErrorHandlingMiddlewareOptions = ErrorHandlingMiddlewareOptions<
  LegacyErrorHandler<Record<string, unknown>, Record<PropertyKey, unknown>>
>;

const setSchemaAndHydrateDbDebug = createDebugLogger({
  namespace: 'next-api:f:hydrate-prod'
});

/**
 * Sets the database schema if NODE_ENV starts with "production" or
 * "development". Additionally hydrates the database with dummy data if NODE_ENV
 * starts with "development".
 */
export default async function setSchemaAndMaybeHydrateDb() {
  setSchemaAndHydrateDbDebug('entered middleware runtime');

  const isProduction = getEnv().NODE_ENV.startsWith('production');
  const isDevelopment = getEnv().NODE_ENV.startsWith('development');

  if (isProduction || isDevelopment) {
    setSchemaConfig(() => getSchemaConfig());

    if (isDevelopment && getEnv().API_HYDRATE_DB) {
      setSchemaAndHydrateDbDebug('executing api db hydration directive');
      // ? This next line prevents webpack/esbuild from bundling testverse
      setDummyData(require('testverse/db'.toString()).getDummyData());

      await getDb({ name: 'root' });
      await getDb({ name: 'app' });

      setSchemaAndHydrateDbDebug('dbs initialized successfully: root, app');

      await hydrateDbWithDummyData({ name: 'root' });
      await hydrateDbWithDummyData({ name: 'app' });

      setSchemaAndHydrateDbDebug('db hydrated successfully: root, app');

      throw new Error(
        'database was hydrated successfully. You may invoke the app normally now (without API_HYDRATE_DB)'
      );
    }
  }
}

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
    AuthMiddlewareOptions &
    ContrivedMiddlewareOptions &
    GenericErrorHandlingMiddlewareOptions &
    LimitMiddlewareOptions &
    CorsMiddlewareOptions,
  ContentTypeMiddlewareContext &
    MethodMiddlewareContext &
    VersionMiddlewareContext &
    LoggingMiddlewareContext &
    AuthMiddlewareContext &
    ContrivedMiddlewareContext &
    ErrorHandlingMiddlewareContext &
    LimitMiddlewareContext &
    CorsMiddlewareContext
>({
  use: [
    setSchemaAndMaybeHydrateDb,
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
    enableContrivedErrors: true
  }
});

/**
 * Middleware runner for the special /sys API endpoints.
 */
/* istanbul ignore next */
const withSysMiddleware = middlewareFactory<
  LoggingMiddlewareOptions &
    AuthMiddlewareOptions &
    MethodMiddlewareOptions &
    ContentTypeMiddlewareOptions &
    GenericErrorHandlingMiddlewareOptions
>({
  use: [
    setSchemaAndMaybeHydrateDb,
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
    requiresAuth: { filter: { isGlobalAdmin: true } }
  }
});

export { withMiddleware, withSysMiddleware };
