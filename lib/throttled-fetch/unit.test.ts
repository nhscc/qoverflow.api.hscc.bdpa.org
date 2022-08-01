/* eslint-disable jest/unbound-method */
/* eslint-disable jest/prefer-lowercase-title */
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { DummyError, TrialError } from 'named-app-errors';
import { Headers, Response } from 'node-fetch';
import { asMockedFunction } from '@xunnamius/jest-types';
import { setTimeout } from 'node:timers/promises';

import {
  defaultResponseInspector,
  RequestQueue,
  RequestQueueClearedError,
  RequestQueueError
} from 'multiverse/throttled-fetch';

jest.mock('node:timers/promises');

const useFakeTimers = () =>
  jest.useFakeTimers({
    timerLimit: 10,
    doNotFake: [
      'Date',
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval'
    ]
  });

const mockSetTimeout = asMockedFunction(setTimeout);

const server = setupServer(
  rest.all('*', async (req, res, ctx) => {
    const { method, headers, params } = req;
    const body = await req.text();

    return res(
      ctx.status(
        body.startsWith('status=')
          ? Number.parseInt(body.split('status=').at(-1) || '200')
          : 200
      ),
      ctx.json({ method, headers: headers.raw(), params, body })
    );
  })
);

/**
 * Ensure that a promise does not settle before it's supposed to.
 *
 * @returns a `setThreshold` function and a `sentinel` function (via array)
 */
const promiseSettledSentinel = () => {
  let threshold = 0;

  return [
    (newThreshold: number) => (threshold = newThreshold),
    {
      resolve(count = Infinity) {
        return <T>(result: T) => {
          if (count > threshold) {
            throw new TrialError(
              `promise #${count} resolved before it was supposed to`
            );
          }
          return Promise.resolve(result);
        };
      },

      reject(count = Infinity) {
        return <T>(result: T) => {
          if (count > threshold) {
            throw new TrialError(
              `promise #${count} rejected before it was supposed to`
            );
          }
          return Promise.reject(result);
        };
      }
    }
  ] as const;
};

/**
 * Ensure no new intervals are being processed by the given queue. This function
 * should be called at the very end of your test when you want to ensure queue
 * processing has terminated. **Otherwise, you'll have to deal with an extra
 * enqueued request.**
 */
const assertRequestQueueProcessingStopped = (queue: RequestQueue) => {
  const mockSetTimeoutCalls = mockSetTimeout.mock.calls.length;
  const previousRequestDelayMs = queue.requestDelayMs;

  // ? First, ensure graceful stop happens
  jest.advanceTimersByTime(queue.intervalPeriodMs);

  // ? Now, if we didn't stop, then this request delay will trip mockSetTimeout
  queue.requestDelayMs = 1000;
  void queue.addRequestToQueue('https://fake-url');
  jest.advanceTimersByTime(queue.intervalPeriodMs);
  expect(mockSetTimeout).toBeCalledTimes(mockSetTimeoutCalls);

  // ? Reset things back to the way they were
  queue.requestDelayMs = previousRequestDelayMs;
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  mockSetTimeout.mockReturnValue(Promise.resolve());
  useFakeTimers();
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => server.close());

describe('RequestQueue::constructor', () => {
  it('can be initialized without a responseInspector', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 30
    });

    expect(queue.intervalPeriodMs).toBe(1000);
    expect(queue.maxRequestsPerInterval).toBe(30);
    expect(queue.responseInspector).toBe(defaultResponseInspector);
  });

  it('can be initialized with a responseInspector', async () => {
    expect.hasAssertions();

    const responseInspector = () => undefined;

    const queue = new RequestQueue({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 30,
      responseInspector
    });

    expect(queue.intervalPeriodMs).toBe(1000);
    expect(queue.maxRequestsPerInterval).toBe(30);
    expect(queue.responseInspector).toBe(responseInspector);
  });

  it('begins processing queue upon instantiation and gracefully ends automatically if autoStart is true', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true
    });

    const pRes = queue.addRequestToQueue('https://fake-url');
    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);
    await expect(pRes).resolves.toBeInstanceOf(Response);

    assertRequestQueueProcessingStopped(queue);
  });
});

describe('RequestQueue::addRequestToQueue', () => {
  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { addRequestToQueue } = queue;
    const pRes = addRequestToQueue('https://fake-url');

    queue.beginProcessingRequestQueue();
    jest.advanceTimersToNextTimer();
    await expect(pRes).resolves.toBeInstanceOf(Response);
  });

  it('can override return type information provided at instantiation', async () => {
    expect.assertions(0);

    const { addRequestToQueue } = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const pRes = addRequestToQueue<{ a: 1 }>('https://fake-url');
    const res = pRes as unknown as Awaited<typeof pRes>;

    void res.a;
    // @ts-expect-error: if an error occurs, then the type check was successful!
    void res.json;
  });
});

describe('RequestQueue::beginProcessingRequestQueue', () => {
  it('processes requests added to the queue', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const requests = [
      queue
        .addRequestToQueue('https://fake-url', { method: 'GET' })
        .then(sentinel.resolve(1)),
      queue
        .addRequestToQueue('https://fake-url', { method: 'POST' })
        .then(sentinel.resolve(2)),
      queue
        .addRequestToQueue('https://fake-url', { method: 'PUT' })
        .then(sentinel.resolve(3)),
      queue
        .addRequestToQueue('https://fake-url', { method: 'PATCH' })
        .then(sentinel.resolve(4)),
      queue
        .addRequestToQueue('https://fake-url', { method: 'DELETE' })
        .then(sentinel.resolve(5))
    ];

    queue.beginProcessingRequestQueue();

    setThreshold(1);
    jest.advanceTimersByTime(1 * queue.intervalPeriodMs);

    await expect((await requests[0]).json()).resolves.toHaveProperty('method', 'GET');

    setThreshold(2);
    jest.advanceTimersByTime(1 * queue.intervalPeriodMs);

    await expect((await requests[1]).json()).resolves.toHaveProperty(
      'method',
      'POST'
    );

    setThreshold(5);
    jest.advanceTimersByTime(3 * queue.intervalPeriodMs);

    await expect((await requests[2]).json()).resolves.toHaveProperty('method', 'PUT');
    await expect((await requests[3]).json()).resolves.toHaveProperty(
      'method',
      'PATCH'
    );

    await expect((await requests[4]).json()).resolves.toHaveProperty(
      'method',
      'DELETE'
    );
  });

  it('respects headers passed to addRequestToQueue', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 3
    });

    const requests = [
      queue.addRequestToQueue('https://fake-url', {
        method: 'GET',
        headers: { a: '1' }
      }),
      queue.addRequestToQueue('https://fake-url', {
        method: 'GET',
        headers: [['b', '2']]
      }),
      queue.addRequestToQueue('https://fake-url', {
        method: 'GET',
        headers: new Headers({ c: '3' })
      })
    ].map((req) => req.then((res) => res.json()));

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    const responses = await Promise.all(requests);

    expect(responses[0]).toHaveProperty(
      'headers',
      expect.objectContaining({ a: '1' })
    );

    expect(responses[1]).toHaveProperty(
      'headers',
      expect.objectContaining({ b: '2' })
    );

    expect(responses[2]).toHaveProperty(
      'headers',
      expect.objectContaining({ c: '3' })
    );
  });

  it('keeps processing even if queue is empty', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(3 * queue.intervalPeriodMs);

    const pReq = queue.addRequestToQueue('https://fake-url', { method: 'GET' });
    jest.advanceTimersByTime(3 * queue.intervalPeriodMs);
    await expect((await pReq).json()).resolves.toHaveProperty('method', 'GET');

    const pReq2 = queue.addRequestToQueue('https://fake-url', { method: 'POST' });
    jest.advanceTimersByTime(3 * queue.intervalPeriodMs);
    await expect((await pReq2).json()).resolves.toHaveProperty('method', 'POST');
  });

  it('throws if called while already processing queue', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();
    expect(() => queue.beginProcessingRequestQueue()).toThrow(RequestQueueError);
  });

  it('causes addRequestToQueue promise to reject when fetch function rejects', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();

    const pReq = queue.addRequestToQueue('bad-url');
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pReq).rejects.toBeInstanceOf(Error);
  });

  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { beginProcessingRequestQueue } = queue;
    const pRes = queue.addRequestToQueue('https://fake-url', { method: 'GET' });

    beginProcessingRequestQueue();
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pRes).resolves.toBeInstanceOf(Response);
  });
});

describe('RequestQueue::clearRequestQueue', () => {
  it('clears only pending/unprocessed requests from the queue and rejects them', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');
    const pReq2 = queue.addRequestToQueue('https://fake-url');
    const pReq3 = queue.addRequestToQueue('https://fake-url');
    const pReq4 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    queue.clearRequestQueue();

    await expect(pReq1).resolves.toBeInstanceOf(Response);
    await expect(pReq2).rejects.toBeInstanceOf(RequestQueueClearedError);
    await expect(pReq3).rejects.toBeInstanceOf(RequestQueueClearedError);
    await expect(pReq4).rejects.toBeInstanceOf(RequestQueueClearedError);
  });

  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { clearRequestQueue } = queue;
    const pReq = queue.addRequestToQueue('https://fake-url');

    clearRequestQueue();

    await expect(pReq).rejects.toBeInstanceOf(RequestQueueClearedError);
  });
});

describe('RequestQueue::gracefullyStopProcessingRequestQueue', () => {
  it('terminates after request queue is exhausted but still allows queue processing to begin again later', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');
    jest.advanceTimersByTime(3 * queue.intervalPeriodMs);

    await expect(pReq1).resolves.toBeInstanceOf(Response);

    const pReq2 = queue.addRequestToQueue('https://fake-url');

    queue.gracefullyStopProcessingRequestQueue();
    jest.advanceTimersByTime(1 * queue.intervalPeriodMs);

    await expect(pReq2).resolves.toBeInstanceOf(Response);

    assertRequestQueueProcessingStopped(queue);

    const pReq3 = queue.addRequestToQueue('https://fake-url');

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);
    await expect(pReq3).resolves.toBeInstanceOf(Response);
  });

  it('does not abort in-flight requests', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();
    queue.gracefullyStopProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');
    const pReq2 = queue.addRequestToQueue('https://fake-url');
    const pReq3 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(4 * queue.intervalPeriodMs);

    await expect(pReq1).resolves.toBeInstanceOf(Response);
    await expect(pReq2).resolves.toBeInstanceOf(Response);
    await expect(pReq3).resolves.toBeInstanceOf(Response);

    assertRequestQueueProcessingStopped(queue);
  });

  it('throws if queue processing already stopped', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    expect(() => queue.gracefullyStopProcessingRequestQueue()).toThrow(
      RequestQueueError
    );
  });

  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { gracefullyStopProcessingRequestQueue } = queue;

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    gracefullyStopProcessingRequestQueue();

    assertRequestQueueProcessingStopped(queue);
  });
});

describe('RequestQueue::immediatelyStopProcessingRequestQueue', () => {
  it('terminates immediately even if in the middle of a delay timeout', async () => {
    expect.hasAssertions();

    let abortSignal: AbortSignal | undefined;
    let delayPromiseResolver: ((value?: unknown) => void) | undefined;

    mockSetTimeout.mockImplementation((_, __, options) => {
      abortSignal = options?.signal;
      return new Promise((resolve) => {
        delayPromiseResolver = resolve;
      });
    });

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 2
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    expect(mockSetTimeout).toBeCalledTimes(0);

    const [, sentinel] = promiseSettledSentinel();

    queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(), sentinel.reject());
    queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(), sentinel.reject());

    jest.advanceTimersByTime(queue.intervalPeriodMs);

    expect(mockSetTimeout).toBeCalledTimes(1);
    expect(abortSignal?.aborted).toBeFalse();
    expect(delayPromiseResolver).toBeDefined();

    queue.immediatelyStopProcessingRequestQueue();

    expect(abortSignal?.aborted).toBeTrue();
    delayPromiseResolver?.();

    assertRequestQueueProcessingStopped(queue);
  });

  it('terminates immediately even if queue is not empty and in-flight requests are pending but still allows queue processing to resume later', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pReq1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(1), sentinel.reject(1));
    const pReq2 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(2), sentinel.reject(2));
    const pReq3 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(3), sentinel.reject(3));

    setThreshold(1);

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    queue.immediatelyStopProcessingRequestQueue();

    await expect(pReq1).rejects.toMatchObject({ name: 'AbortError' });

    setThreshold(2);

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq2).resolves.toBeInstanceOf(Response);

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    queue.immediatelyStopProcessingRequestQueue();

    setThreshold(3);

    await expect(pReq3).rejects.toMatchObject({ name: 'AbortError' });
    assertRequestQueueProcessingStopped(queue);
  });

  it('throws if queue processing already stopped', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    expect(() => queue.immediatelyStopProcessingRequestQueue()).toThrow(
      RequestQueueError
    );
  });

  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { immediatelyStopProcessingRequestQueue } = queue;

    queue.beginProcessingRequestQueue();

    const [setThreshold, sentinel] = promiseSettledSentinel();
    const pReq1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(), sentinel.reject(1));

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    immediatelyStopProcessingRequestQueue();

    setThreshold(1);

    await expect(pReq1).rejects.toMatchObject({ name: 'AbortError' });
    assertRequestQueueProcessingStopped(queue);
  });
});

describe('RequestQueue::waitForQueueProcessingToStop', () => {
  it('resolves only after queue processing is stopped', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();
    queue.gracefullyStopProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(4 * queue.intervalPeriodMs);

    await expect(pReq1).resolves.toBeInstanceOf(Response);
    await expect(queue.waitForQueueProcessingToStop()).resolves.toBeUndefined();

    assertRequestQueueProcessingStopped(queue);
  });

  it('is auto-bound at instantiation', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const { waitForQueueProcessingToStop } = queue;

    queue.beginProcessingRequestQueue();
    queue.gracefullyStopProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);

    await expect(pReq1).resolves.toBeInstanceOf(Response);
    await expect(waitForQueueProcessingToStop()).resolves.toBeUndefined();

    assertRequestQueueProcessingStopped(queue);
  });
});

describe('RequestQueue::defaultRequestInit', () => {
  test('default request init parameters are passed along with every request', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.defaultRequestInit = { method: 'POST', body: 'yes' };
    queue.beginProcessingRequestQueue();

    const pReq1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect((await pReq1).json()).resolves.toStrictEqual(
      expect.objectContaining({ method: 'POST', body: 'yes' })
    );
  });

  test('default headers coexist peacefully with headers passed to addRequestToQueue', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();

    queue.defaultRequestInit.headers = { a: '1' };
    const pReq1 = queue.addRequestToQueue('https://fake-url');
    const pReq11 = queue.addRequestToQueue('https://fake-url', {
      headers: [
        ['a', 'one'],
        ['z', 'Z']
      ]
    });

    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);

    queue.defaultRequestInit.headers = [['b', '2']];
    const pReq2 = queue.addRequestToQueue('https://fake-url');
    const pReq22 = queue.addRequestToQueue('https://fake-url', {
      headers: new Headers([
        ['b', 'two'],
        ['z', 'Z']
      ])
    });

    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);

    queue.defaultRequestInit.headers = new Headers({ c: '3' });
    const pReq3 = queue.addRequestToQueue('https://fake-url');
    const pReq33 = queue.addRequestToQueue('https://fake-url', {
      headers: { c: 'three', z: 'Z' }
    });

    jest.advanceTimersByTime(2 * queue.intervalPeriodMs);

    await expect((await pReq1).json()).resolves.toStrictEqual(
      expect.objectContaining({ headers: expect.objectContaining({ a: '1' }) })
    );

    await expect((await pReq11).json()).resolves.toStrictEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ a: 'one', z: 'Z' })
      })
    );

    await expect((await pReq2).json()).resolves.toStrictEqual(
      expect.objectContaining({ headers: expect.objectContaining({ b: '2' }) })
    );

    await expect((await pReq22).json()).resolves.toStrictEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ b: 'two', z: 'Z' })
      })
    );

    await expect((await pReq3).json()).resolves.toStrictEqual(
      expect.objectContaining({ headers: expect.objectContaining({ c: '3' }) })
    );

    await expect((await pReq33).json()).resolves.toStrictEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ c: 'three', z: 'Z' })
      })
    );
  });
});

describe('RequestQueue::intervalPeriodMs', () => {
  it('determines the delay period between intervals', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 10000,
      maxRequestsPerInterval: 1
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    expect(mockSetTimeout).toBeCalledTimes(0);

    const [, sentinel] = promiseSettledSentinel();

    void queue.addRequestToQueue('https://fake-url').then(
      sentinel.resolve(1),
      // ? Since this request will get sent, the halt below will abort it
      sentinel.resolve(0)
    );

    jest.advanceTimersByTime(10000);
    expect(mockSetTimeout).toBeCalledTimes(1);

    void queue.addRequestToQueue('https://fake-url');

    // ? Wait for the current interval microtask to finish before continuing
    await Promise.resolve().then(() => (queue.requestDelayMs = 1000));

    jest.advanceTimersByTime(2500);
    expect(mockSetTimeout).toBeCalledTimes(1);
    jest.advanceTimersByTime(2500);
    expect(mockSetTimeout).toBeCalledTimes(1);
    jest.advanceTimersByTime(5000);
    expect(mockSetTimeout).toBeCalledTimes(2);

    queue.immediatelyStopProcessingRequestQueue();

    queue.requestDelayMs = 1000;
    queue.intervalPeriodMs = 500;

    queue.beginProcessingRequestQueue();

    void queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(250);
    expect(mockSetTimeout).toBeCalledTimes(2);
    jest.advanceTimersByTime(250);
    expect(mockSetTimeout).toBeCalledTimes(3);
  });
});

describe('RequestQueue::isProcessingRequestQueue', () => {
  it('returns true when request queue is being processed and false otherwise', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.beginProcessingRequestQueue();
    expect(queue.isProcessingRequestQueue).toBeTrue();

    queue.gracefullyStopProcessingRequestQueue();
    expect(queue.isProcessingRequestQueue).toBeTrue();

    queue.immediatelyStopProcessingRequestQueue();
    expect(queue.isProcessingRequestQueue).toBeFalse();
  });
});

describe('RequestQueue::maxRequestsPerInterval', () => {
  it('determines the maximum number of requests processed per interval', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pReq1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(1), sentinel.reject(1));
    const pReq2 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(2), sentinel.reject(2));
    const pReq3 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(3), sentinel.reject(3));
    const pReq4 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(4), sentinel.reject(4));
    const pReq5 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(5), sentinel.reject(5));
    const pReq6 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(6), sentinel.reject(6));

    setThreshold(1);

    queue.beginProcessingRequestQueue();
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq1).resolves.toBeInstanceOf(Response);

    setThreshold(3);

    queue.maxRequestsPerInterval = 2;
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq2).resolves.toBeInstanceOf(Response);
    await expect(pReq3).resolves.toBeInstanceOf(Response);

    setThreshold(6);

    queue.maxRequestsPerInterval = 3;
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq4).resolves.toBeInstanceOf(Response);
    await expect(pReq5).resolves.toBeInstanceOf(Response);
    await expect(pReq6).resolves.toBeInstanceOf(Response);
  });

  it('can be changed in the midst of interval processing', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 2
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pReq1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(1), sentinel.reject(1));

    const pReq2 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(2), sentinel.reject(2));

    const pReq3 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(3), sentinel.reject(3));

    const pReq4 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(4), sentinel.reject(4));

    setThreshold(1);

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    queue.maxRequestsPerInterval = 1;

    await expect(pReq1).resolves.toBeInstanceOf(Response);

    queue.requestDelayMs = 1000;
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    queue.maxRequestsPerInterval = 3;

    setThreshold(4);

    await expect(pReq2).resolves.toBeInstanceOf(Response);
    await expect(pReq3).resolves.toBeInstanceOf(Response);
    await expect(pReq4).resolves.toBeInstanceOf(Response);
  });

  it('keeps processing even if queue is smaller than maxRequestsPerInterval', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 100
    });

    queue.beginProcessingRequestQueue();

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pReq1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(1), sentinel.reject(1));

    setThreshold(1);
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pReq1).resolves.toBeInstanceOf(Response);

    // ? Some time passes...
    jest.advanceTimersByTime(5 * queue.intervalPeriodMs);

    const pReq2 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(2), sentinel.reject(2));

    const pReq3 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(3), sentinel.reject(3));

    const pReq4 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(4), sentinel.reject(4));

    setThreshold(4);
    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq2).resolves.toBeInstanceOf(Response);
    await expect(pReq3).resolves.toBeInstanceOf(Response);
    await expect(pReq4).resolves.toBeInstanceOf(Response);
  });
});

describe('RequestQueue::responseInspector', () => {
  it('causes addRequestToQueue promise to resolve with return value', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true,
      responseInspector: (res, q, wasARetry, url, requestInit) => {
        expect(res).toBeInstanceOf(Response);
        expect(q).toBe(queue);
        expect(url).toBe('https://fake-url');
        expect(requestInit.method).toBe('POST');
        expect(wasARetry).toBeFalse();

        return { hello: 'world' };
      }
    });

    const pReq1 = queue.addRequestToQueue('https://fake-url', { method: 'POST' });

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pReq1).resolves.toStrictEqual({ hello: 'world' });
  });

  it('causes addRequestToQueue promise to reject when Error is thrown', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true
    });

    queue.responseInspector = async () => {
      throw new DummyError();
    };

    const pReq1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pReq1).rejects.toBeInstanceOf(DummyError);
  });

  it('causes addRequestToQueue promise to reject with HttpError if non-Error is thrown', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true,
      responseInspector: async () => {
        throw 'goodbye, world!';
      }
    });

    const pReq1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);

    await expect(pReq1).rejects.toMatchObject({
      name: 'HttpError',
      message: expect.stringContaining('goodbye, world!')
    });
  });

  it('can detect retries and react accordingly', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true
    });

    queue.responseInspector = async (res, q, wasARetry) => {
      if (res.status == 200) {
        const pReqRetry = q.addRequestToQueue(
          'https://fake-url',
          { method: 'POST', body: 'status=403' },
          true
        );

        return Promise.resolve().then(() => {
          jest.advanceTimersByTime(queue.intervalPeriodMs);
          return pReqRetry;
        });
      }

      return `hello, ${wasARetry ? 'retry' : 'world'}!`;
    };

    const pReq1 = queue.addRequestToQueue('https://fake-url', { method: 'POST' });

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pReq1).resolves.toBe('hello, retry!');
  });
});

describe('RequestQueue::prependRetries', () => {
  it('makes addRequestToQueue prepend retries to the request queue when true or append when false', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1,
      autoStart: true
    });

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pRes1 = queue
      .addRequestToQueue('https://fake-url-1')
      .then(sentinel.resolve(2), sentinel.reject());

    const pRes2 = queue
      .addRequestToQueue('https://fake-url-2', {}, true)
      .then(sentinel.resolve(1), sentinel.reject());

    queue.prependRetries = false;

    const pRes3 = queue
      .addRequestToQueue('https://fake-url-3', {}, true)
      .then(sentinel.resolve(3), sentinel.reject());

    setThreshold(1);
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pRes2).resolves.toBeInstanceOf(Response);

    setThreshold(2);
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pRes1).resolves.toBeInstanceOf(Response);

    setThreshold(3);
    jest.advanceTimersByTime(queue.intervalPeriodMs);
    await expect(pRes3).resolves.toBeInstanceOf(Response);
  });
});

describe('RequestQueue::requestDelayMs', () => {
  it('causes delaying of entire request processing routine when set', async () => {
    expect.hasAssertions();

    let delayPromiseResolver: ((value?: unknown) => void) | undefined;

    mockSetTimeout.mockImplementation((_, __) => {
      return new Promise((resolve) => {
        delayPromiseResolver = resolve;
      });
    });

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    const [setThreshold, sentinel] = promiseSettledSentinel();

    const pRes1 = queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(1), sentinel.reject());

    queue
      .addRequestToQueue('https://fake-url')
      .then(sentinel.resolve(), sentinel.reject());

    jest.advanceTimersByTime(10 * queue.intervalPeriodMs);

    expect(delayPromiseResolver).toBeDefined();

    setThreshold(1);
    delayPromiseResolver?.();

    await expect(pRes1).resolves.toBeInstanceOf(Response);
  });

  it('is reset before a delay transpires', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    void queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);
    expect(queue.requestDelayMs).toBe(0);
  });

  it('is reset after a delay transpires, preventing unnecessary slowdowns', async () => {
    expect.hasAssertions();

    let delayPromiseResolver: ((value?: unknown) => void) | undefined;

    mockSetTimeout.mockImplementation((_, __) => {
      return new Promise((resolve) => {
        delayPromiseResolver = resolve;
      });
    });

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    queue.requestDelayMs = 1000;
    queue.beginProcessingRequestQueue();

    const pRes1 = queue.addRequestToQueue('https://fake-url');

    jest.advanceTimersByTime(queue.intervalPeriodMs);

    expect(delayPromiseResolver).toBeDefined();

    queue.requestDelayMs = 10000;
    delayPromiseResolver?.();

    await expect(pRes1).resolves.toBeInstanceOf(Response);
    expect(queue.requestDelayMs).toBe(0);
  });

  it('throws when attempting to set negative delay', async () => {
    expect.hasAssertions();

    const queue = new RequestQueue<Response>({
      intervalPeriodMs: 1000,
      maxRequestsPerInterval: 1
    });

    expect(() => (queue.requestDelayMs = -1)).toThrow(RequestQueueError);
  });
});
