import { useMockDateNow, mockDateNowMs } from 'multiverse/mongo-common';
import { getDb } from 'multiverse/mongo-schema';
import { BANNED_BEARER_TOKEN } from 'multiverse/next-auth';
import { addToRequestLog } from 'multiverse/next-log';
import { setupMemoryServerOverride } from 'multiverse/mongo-test';

import { withMockedOutput } from 'testverse/setup';

import type { InternalRequestLogEntry } from 'multiverse/next-log';
import type { HttpStatusCode } from '@xunnamius/types';
import type { NextApiRequest, NextApiResponse } from 'next';

setupMemoryServerOverride();
useMockDateNow();

const mockPerfNow = 1234;

jest.mock('node:perf_hooks', () => ({ performance: { now: () => mockPerfNow } }));

describe('::addToRequestLog', () => {
  it('adds request to mongo collection', async () => {
    expect.hasAssertions();

    const req1 = {
      headers: { 'x-forwarded-for': '9.9.9.9' },
      method: 'POST',
      url: '/api/route/path1'
    } as unknown as NextApiRequest;

    const req2 = {
      headers: {
        'x-forwarded-for': '8.8.8.8',
        authorization: `bearer ${BANNED_BEARER_TOKEN}`
      },
      method: 'GET',
      url: '/api/route/path2'
    } as unknown as NextApiRequest;

    const res1 = { statusCode: 1111 } as NextApiResponse;
    const res2 = { statusCode: 2222 } as NextApiResponse;

    await addToRequestLog({ req: req1, res: res1, endpoint: '/fake' });
    await addToRequestLog({ req: req2, res: res2, endpoint: '/fake' });

    const reqlog = (
      await getDb({ name: 'root' })
    ).collection<InternalRequestLogEntry>('request-log');

    await expect(
      reqlog.findOne({ resStatusCode: 1111 as HttpStatusCode })
    ).resolves.toStrictEqual({
      _id: expect.anything(),
      ip: '9.9.9.9',
      header: null,
      route: '/api/route/path1',
      endpoint: '/fake',
      method: 'POST',
      createdAt: mockDateNowMs,
      resStatusCode: 1111,
      durationMs: mockPerfNow
    });

    await expect(
      reqlog.findOne({ resStatusCode: 2222 as HttpStatusCode })
    ).resolves.toStrictEqual({
      _id: expect.anything(),
      ip: '8.8.8.8',
      header: `bearer ${BANNED_BEARER_TOKEN}`,
      route: '/api/route/path2',
      endpoint: '/fake',
      method: 'GET',
      createdAt: mockDateNowMs,
      resStatusCode: 2222,
      durationMs: mockPerfNow
    });
  });

  it('handles null method and/or url and lowercases schema', async () => {
    expect.hasAssertions();

    const req1 = {
      headers: { 'x-forwarded-for': '9.9.9.9' },
      method: null,
      url: '/api/route/path1'
    } as unknown as NextApiRequest;

    const req2 = {
      headers: {
        'x-forwarded-for': '8.8.8.8',
        authorization: `BeArEr ${BANNED_BEARER_TOKEN}`
      },
      method: 'GET',
      url: null
    } as unknown as NextApiRequest;

    const res1 = { statusCode: 1111 } as NextApiResponse;
    const res2 = { statusCode: 2222 } as NextApiResponse;

    await addToRequestLog({ req: req1, res: res1, endpoint: '/fake' });
    await addToRequestLog({ req: req2, res: res2, endpoint: '/fake' });

    const reqlog = (
      await getDb({ name: 'root' })
    ).collection<InternalRequestLogEntry>('request-log');

    await expect(
      reqlog.findOne({ resStatusCode: 1111 as HttpStatusCode })
    ).resolves.toStrictEqual({
      _id: expect.anything(),
      ip: '9.9.9.9',
      header: null,
      route: '/api/route/path1',
      endpoint: '/fake',
      method: null,
      createdAt: mockDateNowMs,
      resStatusCode: 1111,
      durationMs: mockPerfNow
    });

    await expect(
      reqlog.findOne({ resStatusCode: 2222 as HttpStatusCode })
    ).resolves.toStrictEqual({
      _id: expect.anything(),
      ip: '8.8.8.8',
      header: `bearer ${BANNED_BEARER_TOKEN}`,
      route: null,
      endpoint: '/fake',
      method: 'GET',
      createdAt: mockDateNowMs,
      resStatusCode: 2222,
      durationMs: mockPerfNow
    });
  });

  it('handles null or undefined endpoint metadata with warnings', async () => {
    expect.hasAssertions();

    const req1 = {
      headers: { 'x-forwarded-for': '9.9.9.9' },
      method: 'GET',
      url: '/api/route/path1'
    } as unknown as NextApiRequest;

    const req2 = {
      headers: { 'x-forwarded-for': '8.8.8.8' },
      method: 'GET',
      url: null
    } as unknown as NextApiRequest;

    const res1 = { statusCode: 1111 } as NextApiResponse;
    const res2 = { statusCode: 2222 } as NextApiResponse;
    const res3 = { statusCode: 3333 } as NextApiResponse;

    const reqlog = (
      await getDb({ name: 'root' })
    ).collection<InternalRequestLogEntry>('request-log');

    await withMockedOutput(async ({ warnSpy }) => {
      await addToRequestLog({ req: req1, res: res1, endpoint: null });

      expect(warnSpy).toBeCalledWith(
        expect.stringContaining(`API endpoint at ${req1.url}`)
      );

      await expect(
        reqlog.findOne({ resStatusCode: 1111 as HttpStatusCode })
      ).resolves.toStrictEqual(
        expect.objectContaining({
          endpoint: null
        })
      );

      await addToRequestLog({ req: req2, res: res2, endpoint: undefined });

      expect(warnSpy).toBeCalledWith(expect.stringContaining('an API endpoint'));

      await expect(
        reqlog.findOne({ resStatusCode: 2222 as HttpStatusCode })
      ).resolves.toStrictEqual(
        expect.objectContaining({
          endpoint: null
        })
      );

      // @ts-expect-error: purposely missing endpoint parameter
      await addToRequestLog({ req: req2, res: res3 });

      expect(warnSpy).toBeCalledTimes(3);

      await expect(
        reqlog.findOne({ resStatusCode: 3333 as HttpStatusCode })
      ).resolves.toStrictEqual(
        expect.objectContaining({
          endpoint: null
        })
      );

      await addToRequestLog({ req: req2, res: res3, endpoint: '/fake' });

      expect(warnSpy).toBeCalledTimes(3);
    });
  });
});
