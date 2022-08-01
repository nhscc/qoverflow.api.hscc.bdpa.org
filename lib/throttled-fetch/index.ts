/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch, { Headers } from 'node-fetch';
import autobind from 'auto-bind';
import { GuruMeditationError, HttpError, makeNamedError } from 'named-app-errors';
import { toss } from 'toss-expression';
import { setTimeout as wait } from 'node:timers/promises';

import { debugFactory } from 'multiverse/debug-extended';

const debug = debugFactory(`throttled-fetch:index`);

import type { Promisable } from 'type-fest';
import type { RequestInfo, RequestInit } from 'node-fetch';

/**
 * An internal representation of the node-fetch function's parameters.
 */
type FetchParams = Parameters<typeof fetch>;

/**
 * An internal representation of the `addRequestToQueue` parameters.
 */
type ExtendedFetchParams = [
  url: RequestInfo,
  init?: RequestInit | undefined,
  isARetry?: boolean
];

/**
 * An internal function used to eventually resolve the `addRequestToQueue` call
 * with the response data.
 */
type RequestQueueCallback = {
  (err: null, retval: unknown): void;
  (err: Error, retval?: undefined): void;
};

export class RequestQueueError extends Error {}
makeNamedError(RequestQueueError, 'RequestQueueError');

export class RequestQueueClearedError extends RequestQueueError {}
makeNamedError(RequestQueueClearedError, 'RequestQueueClearedError');

/**
 * A function used to alter the behavior of the queue based on feedback from
 * response data (e.g. JSON data or response status).
 */
export type ResponseInspector = (
  response: Awaited<ReturnType<typeof fetch>>,
  requestQueue: RequestQueue,
  wasARetry: boolean,
  requestInfo: RequestInfo,
  requestInit: RequestInit
) => Promisable<unknown>;

/**
 * The default `ResponseInspector` used by each `RequestQueue` instance unless
 * otherwise configured. Simply passes through the `Response` instance.
 */
export const defaultResponseInspector: ResponseInspector = (res) => res;

/**
 * Execute requests present in the request queue with respect to backoff data,
 * flow control, rate limits, and other data.
 */
export class RequestQueue<T = any> {
  /**
   * If non-zero, no new requests will be made until this many milliseconds have
   * expired.
   */
  #requestDelayMs = 0;

  /**
   * Once this is set to false and requestQueue is empty,
   * `queueAbortController.abort()` will be called automatically.
   */
  #keepProcessingRequestQueue = true;

  /**
   * Used to abort the request queue processor.
   */
  #timeoutId: NodeJS.Timeout | null = null;

  /**
   * Used to immediately end the delaying period.
   */
  #terminationAbortController = new AbortController();

  /**
   * A function used to alter the behavior of the queue based on feedback from
   * response data (e.g. JSON data or response status).
   */
  #responseInspector: ResponseInspector;

  /**
   * Default request initialization parameters sent along with every request.
   */
  #defaultRequestInit: RequestInit = {};

  /**
   * If true, retries will be prepended to the queue.
   */
  #prependRetries = true;

  /**
   * Used to facilitate "waiting" for the queue to stop processing requests.
   */
  #queueStoppedPromise: Promise<void> = Promise.resolve();

  /**
   * Used to facilitate "waiting" for the queue to stop processing requests.
   */
  /* istanbul ignore next */
  #queueStoppedPromiseResolver: () => void = () => undefined;

  /**
   * The maximum number of requests processed in a single interval.
   */
  #maxRequestsPerInterval: number;

  /**
   * The number of milliseconds between intervals.
   */
  #intervalPeriodMs: number;

  /**
   * A queue of requests waiting to be processed. The response JSON data will be
   * returned via the `resolve` function.
   */
  #requestQueue: [
    fetchParams: FetchParams,
    callback: RequestQueueCallback,
    retried: boolean
  ][] = [];

  /**
   * A counter used only in debug output.
   */
  #debugIntervalCounter = 0;

  /**
   * Create, configure, and return a new RequestQueue instance. All instance
   * methods are auto-bound.
   */
  constructor({
    maxRequestsPerInterval,
    intervalPeriodMs,
    responseInspector,
    autoStart = false
  }: {
    /**
     * A maximum of `maxRequestsPerInterval` requests will be processed every
     * `>=intervalPeriodMs` milliseconds.
     */
    maxRequestsPerInterval: number;
    /**
     * A maximum of `maxRequestsPerInterval` requests will be processed every
     * `>=intervalPeriodMs` milliseconds.
     */
    intervalPeriodMs: number;
    /**
     * A function used to alter the behavior of the queue based on feedback from
     * response data (e.g. JSON data or response status). This function must do
     * one of the following before terminating:
     *
     *   - return a JSON representation of the response, e.g. `response.json()`.
     *   - interpret and/or transform the response data and return any value.
     *   - throw an error causing the `addRequestToQueue` method to reject.
     *
     * The return value of this function will eventually be used as the resolved
     * value of the promise returned by the `addRequestToQueue` call that
     * triggered it. Similarly, if this function throws, the corresponding
     * `addRequestToQueue` call will reject.
     *
     * @default defaultResponseInspector (see export)
     */
    responseInspector?: ResponseInspector;
    /**
     * If `true`, `beginProcessingRequestQueue` and
     * `gracefullyStopProcessingRequestQueue` will be called immediately after
     * the new instance is created. This allows you to start adding requests to
     * the queue immediately without worrying about managing the processor
     * runtime.
     *
     * Note that using `await` in the same context as the queue instance, and
     * before adding all of your desired requests, could cause the queue to stop
     * processing earlier than you might expect. If this is happening, you'll
     * have to call `beginProcessingRequestQueue` and
     * `gracefullyStopProcessingRequestQueue` manually instead of using
     * `autoStart`.
     *
     * @default false
     */
    autoStart?: boolean;
  }) {
    this.#maxRequestsPerInterval = maxRequestsPerInterval;
    this.#intervalPeriodMs = intervalPeriodMs;
    this.#responseInspector = responseInspector ?? defaultResponseInspector;

    // ? Note that this only auto-binds public methods
    autobind(this);

    if (autoStart) {
      this.beginProcessingRequestQueue();
      this.gracefullyStopProcessingRequestQueue();
    }
  }

  /**
   * A function used to alter the behavior of the queue based on feedback from
   * response data (e.g. JSON data or response status). This function must do
   * one of the following before terminating:
   *
   *   - return a JSON representation of the response, e.g. `response.json()`.
   *   - interpret and/or transform the response data and return any value.
   *   - throw an error causing the `addRequestToQueue` method to reject.
   *
   * The return value of this function will eventually be used as the resolved
   * value of the promise returned by the `addRequestToQueue` call that
   * triggered it. Similarly, if this function throws, the corresponding
   * `addRequestToQueue` call will reject.
   *
   * @default defaultResponseInspector (see export)
   */
  get responseInspector() {
    return this.#responseInspector;
  }

  /**
   * A function used to alter the behavior of the queue based on feedback from
   * response data (e.g. JSON data or response status). This function must do
   * one of the following before terminating:
   *
   *   - return a JSON representation of the response, e.g. `response.json()`.
   *   - interpret and/or transform the response data and return any value.
   *   - throw an error causing the `addRequestToQueue` method to reject.
   *
   * The return value of this function will eventually be used as the resolved
   * value of the promise returned by the `addRequestToQueue` call that
   * triggered it. Similarly, if this function throws, the corresponding
   * `addRequestToQueue` call will reject.
   *
   * @default defaultResponseInspector (see export)
   */
  set responseInspector(inspector) {
    debug('set new responseInspector');
    this.#responseInspector = inspector;
  }

  /**
   * Default request initialization parameters sent along with every request.
   */
  get defaultRequestInit() {
    return this.#defaultRequestInit;
  }

  /**
   * Default request initialization parameters sent along with every request.
   */
  set defaultRequestInit(init) {
    debug('set defaultRequestInit: %O => %O', this.#defaultRequestInit, init);
    this.#defaultRequestInit = init;
  }

  /**
   * If true, `addRequestToQueue` will prepend to the queue requests where
   * `isARetry == true`. Otherwise, retried requests will be appended like
   * normal.
   *
   * @default true
   */
  get prependRetries() {
    return this.#prependRetries;
  }

  /**
   * If true, `addRequestToQueue` will prepend to the queue requests where
   * `isARetry == true`. Otherwise, retried requests will be appended like
   * normal.
   *
   * @default true
   */
  set prependRetries(value) {
    debug(`set prependRetries: ${this.#prependRetries} => ${value}`);
    this.#prependRetries = value;
  }

  /**
   * If non-zero, this determines how long (in milliseconds) the request
   * processor will wait before sending a new request.
   *
   * After the delay period transpires, `requestDelayMs` will be reset to `0`
   * _regardless of changes to the value in the interim_. **Hence, due to the
   * asynchronous nature of request processing, setting `requestDelayMs`
   * asynchronously (e.g. via `responseInspector`) does not guarantee that the
   * new value will be respected, or that no requests will be sent during the
   * delay period.** Handle this eventuality accordingly.
   */
  get requestDelayMs() {
    return this.#requestDelayMs;
  }

  /**
   * If non-zero, this determines how long (in milliseconds) the request
   * processor will wait before sending a new request.
   *
   * After the delay period transpires, `requestDelayMs` will be reset to `0`
   * _regardless of changes to the value in the interim_. **Hence, due to the
   * asynchronous nature of request processing, setting `requestDelayMs`
   * asynchronously (e.g. via `responseInspector`) does not guarantee that the
   * new value will be respected, or that no requests will be sent during the
   * delay period.** Handle this eventuality accordingly.
   */
  set requestDelayMs(delay) {
    if (delay < 0) {
      throw new RequestQueueError(
        `requestDelayMs must be a non-negative integer, saw ${delay} instead`
      );
    }

    debug(`set requestDelayMs: ${this.#requestDelayMs} => ${delay}`);
    this.#requestDelayMs = delay;
  }

  /**
   * A maximum of `maxRequestsPerInterval` requests will be processed every
   * `>=intervalPeriodMs` milliseconds.
   */
  get maxRequestsPerInterval() {
    return this.#maxRequestsPerInterval;
  }

  /**
   * A maximum of `maxRequestsPerInterval` requests will be processed every
   * `>=intervalPeriodMs` milliseconds.
   */
  set maxRequestsPerInterval(count) {
    debug(`set maxRequestsPerInterval: ${this.#maxRequestsPerInterval} => ${count}`);
    this.#maxRequestsPerInterval = count;
  }

  /**
   * A maximum of `maxRequestsPerInterval` requests will be processed every
   * `>=intervalPeriodMs` milliseconds.
   */
  get intervalPeriodMs() {
    return this.#intervalPeriodMs;
  }

  /**
   * A maximum of `maxRequestsPerInterval` requests will be processed every
   * `>=intervalPeriodMs` milliseconds.
   */
  set intervalPeriodMs(period) {
    debug(`set intervalPeriodMs: ${this.#intervalPeriodMs} => ${period}`);
    this.#intervalPeriodMs = period;
  }

  /**
   * Add a request to the request queue. This function returns a promise that
   * will resolve with the request's response data as determined by
   * `responseInspector`.
   */
  addRequestToQueue<TT = T>(...params: ExtendedFetchParams): Promise<TT> {
    debug(`adding new request to queue${params[2] ? ' (as retry)' : ''}`);
    return new Promise((resolve, reject) => {
      // ? If we're retrying, add the request to the beginning of the queue if ?
      // prependRetries == true
      this.#requestQueue[params[2] && this.prependRetries ? 'unshift' : 'push']([
        [params[0], params[1]],
        (err, retval) => {
          err ? reject(err) : resolve(retval as TT);
        },
        !!params[2]
      ]);
    });
  }

  /**
   * An internal function to execute requests present in the request queue with
   * respect to constraints available in the response data.
   */
  async #processRequestQueue() {
    const subDebug = debug.extend(`interval#${++this.#debugIntervalCounter}`);
    subDebug('entered queue processing interval function');

    if (this.#requestQueue.length) {
      let previousMaxRequestsPerInterval = this.maxRequestsPerInterval;
      const terminationAbortController = this.#terminationAbortController;

      subDebug(
        `processing at most ${previousMaxRequestsPerInterval} requests in this interval`
      );

      let count = 0;

      for (; count < this.maxRequestsPerInterval; ++count) {
        const reqDebug = subDebug.extend(`request#${count + 1}`);

        if (!terminationAbortController.signal.aborted && this.requestDelayMs) {
          reqDebug('detected non-zero requestDelayMs, processing paused');
          reqDebug(`resuming in ${this.requestDelayMs}ms...`);

          const previousRequestDelayMs = this.requestDelayMs;
          this.requestDelayMs = 0;

          // ? If we need to delay, pause processing request queue immediately
          // eslint-disable-next-line no-await-in-loop
          await wait(previousRequestDelayMs, undefined, {
            signal: terminationAbortController.signal
          });

          reqDebug(`processing resumed`);

          if (this.requestDelayMs != 0) {
            subDebug.warn(`resetting requestDelayMs after resuming queue processing`);
            this.requestDelayMs = 0;
          }
        }

        if (previousMaxRequestsPerInterval != this.maxRequestsPerInterval) {
          subDebug.warn(
            `maxRequestsPerInterval changed while processing request #${
              count + 1
            }: ${previousMaxRequestsPerInterval} => ${this.maxRequestsPerInterval}`
          );
          previousMaxRequestsPerInterval = this.maxRequestsPerInterval;
        }

        if (terminationAbortController.signal.aborted) {
          // ? Immediately terminate request queue processing
          reqDebug(`detected abort signal: queue processing will terminate`);
          break;
        }

        const enqueuedRequest = this.#requestQueue.shift();

        if (!enqueuedRequest) {
          reqDebug(`early end of queue: nothing left to process in this interval`);
          break;
        }

        const [fetchParams, callback, wasARetry] = enqueuedRequest;

        // ? Guarantees fetchParams[1] is non-nullish
        fetchParams[1] = {
          ...this.#defaultRequestInit,
          ...fetchParams[1],
          headers: new Headers(
            Object.entries({
              // ? Ensure default headers can be overwritten
              ...new Headers(this.#defaultRequestInit?.headers).raw(),
              ...new Headers(fetchParams[1]?.headers).raw()
            }).map(([k, v]) => [k, v.join(',')])
          ),
          signal: terminationAbortController.signal
        } as RequestInit;

        const isFinal = count + 1 >= this.maxRequestsPerInterval;

        reqDebug(`sending request to ${fetchParams[0]}`);

        void fetch(...fetchParams)
          .then(async (res) => {
            reqDebug('response received');

            if (isFinal) {
              reqDebug('this is the final request to be processed in this interval');
            }

            try {
              reqDebug('triggering response inspector');

              callback(
                null,
                await this.responseInspector(
                  res,
                  this,
                  wasARetry,
                  fetchParams[0],
                  // ? Guaranteed to be non-nullish
                  fetchParams[1] as RequestInit
                )
              );

              reqDebug('finished processing request');
            } catch (e) {
              subDebug.error(`error during response inspection: ${e}`);
              callback(e instanceof Error ? e : new HttpError(res, String(e)));
            }
          })
          .catch((e) => {
            subDebug.error(`error during request execution: ${e}`);
            callback(
              e instanceof Error
                ? e
                : /* istanbul ignore next */
                  new HttpError(String(e))
            );
          });
      }

      subDebug(
        `processing complete: ${count} request${count > 1 ? 's' : ''} in-flight`
      );
    } else if (this.#keepProcessingRequestQueue) {
      subDebug('queue empty: nothing to process in this interval');
    } else {
      subDebug(
        'queue empty and graceful stop requested: queue processing will be terminated'
      );

      this.#timeoutId = null;

      subDebug('queue processing stopped gracefully');

      this.#queueStoppedPromiseResolver();
      return;
    }

    this.#timeoutId = setTimeout(
      this.#processRequestQueue.bind(this),
      this.intervalPeriodMs
    );

    subDebug(`scheduled next interval in ${this.intervalPeriodMs}ms`);
  }

  /**
   * Returns `true` if the request queue is currently being processed or `false`
   * otherwise.
   */
  get isProcessingRequestQueue() {
    return !!this.#timeoutId;
  }

  /**
   * Begin asynchronously processing the request queue.
   */
  beginProcessingRequestQueue() {
    if (this.isProcessingRequestQueue) {
      debug.error(
        'attempted to call beginProcessingRequestQueue while already processing request queue'
      );
      throw new RequestQueueError('already processing request queue');
    } else {
      debug(`beginning queue processing (${this.intervalPeriodMs}ms intervals)`);

      this.#keepProcessingRequestQueue = true;
      this.#terminationAbortController = new AbortController();

      this.#queueStoppedPromise = new Promise((resolve) => {
        this.#queueStoppedPromiseResolver = resolve;
      });

      this.#timeoutId = setTimeout(
        this.#processRequestQueue.bind(this),
        this.intervalPeriodMs
      );
    }
  }

  /**
   * Signal to the queue processor that, once the queue is empty, request
   * processing is to stop. This means no further requests will be dequeued or
   * executed.
   *
   * Requests can still be added to the queue after request processing
   * eventually stops (via `addRequestToQueue`), but they will not be dequeued
   * and executed until `beginProcessingRequestQueue` is called again.
   */
  gracefullyStopProcessingRequestQueue() {
    if (!this.isProcessingRequestQueue) {
      debug.error(
        'attempted to call gracefullyStopProcessingRequestQueue when processing already stopped'
      );
      throw new RequestQueueError('request queue processing already stopped');
    }

    debug('graceful stop signal received: processing will stop when queue is empty');
    this.#keepProcessingRequestQueue = false;
  }

  /**
   * Signal to the queue processor to stop all request processing immediately,
   * regardless of if the queue is empty or not. After calling this method, no
   * new or queued requests will be processed, though the queue is not cleared.
   * Requests can still be added to the queue (via `addRequestToQueue`) but they
   * will not be processed until `beginProcessingRequestQueue` is called again.
   *
   * If a request is in-flight when this method is called, the request will be
   * aborted and the corresponding promise rejected with an `AbortError`. The
   * aborted request must be re-added to the queue manually as it will not be
   * retried automatically.
   */
  immediatelyStopProcessingRequestQueue() {
    if (!this.isProcessingRequestQueue) {
      debug.error(
        'attempted to call immediatelyStopProcessingRequestQueue when processing already stopped'
      );
      throw new RequestQueueError('request queue processing already stopped');
    }

    debug('immediately halting queue processing and aborting in-flight requests');

    this.#keepProcessingRequestQueue = false;

    clearTimeout(this.#timeoutId as NodeJS.Timeout);
    this.#timeoutId = null;

    this.#terminationAbortController.abort();

    debug('queue processing halted abruptly and in-flight requests aborted');

    this.#queueStoppedPromiseResolver();
  }

  /**
   * Remove all pending and unprocessed requests from the request queue,
   * rejecting their corresponding promises with a `RequestQueueClearedError`.
   * In-flight requests will still complete unless
   * `immediatelyStopProcessingRequestQueue` has been called.
   */
  clearRequestQueue() {
    const count = this.#requestQueue.length;
    debug(`clearing request queue (${count} requests will reject)`);

    for (let i = 0; i < count; ++i) {
      const [, callback] =
        this.#requestQueue.shift() ||
        /* istanbul ignore next */
        toss(new GuruMeditationError('queue length invariant violated'));
      callback(new RequestQueueClearedError());
    }

    debug('request queue cleared');
  }

  /**
   * Returns a promise that resolves after queue processing stops. Before
     calling this function, you should ensure that
     `gracefullyStopProcessingRequestQueue` or
     `immediatelyStopProcessingRequestQueue` have already been or will
     eventually be called or this promise will never settle.
   */
  waitForQueueProcessingToStop() {
    debug('caller is waiting for queue processing to terminate...');
    return this.#queueStoppedPromise;
  }
}
