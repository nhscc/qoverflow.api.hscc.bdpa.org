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
 * An internal representation of the `addRequestToQueue` and
 * `prependRequestToQueue` parameters.
 */
type ExtendedFetchParams = [
  url: RequestInfo,
  init?: RequestInit | undefined,
  state?: Record<string, unknown>
];

/**
 * An internal function used to eventually resolve the `addRequestToQueue` and
 * `prependRequestToQueue` calls with the response data.
 */
type RequestQueueCallback = {
  (err: null, retval: unknown): void;
  (err: Error, retval?: undefined): void;
};

/**
 * A `RequestInit` instance guaranteed to have a non-falsy signal property.
 */
type RequestInitWithSignal = RequestInit & {
  signal: NonNullable<RequestInit['signal']>;
};

/**
 * The shape of a request-inspecting function.
 */
export type RequestInspector = (params: {
  queue: RequestQueue;
  requestInfo: RequestInfo;
  requestInit: RequestInitWithSignal;
  state: Record<string, unknown>;
}) => Promisable<unknown>;

/**
 * The shape of a response-inspecting function.
 */
export type ResponseInspector = (params: {
  response: unknown;
  queue: RequestQueue;
  requestInfo: RequestInfo;
  requestInit: RequestInitWithSignal;
  state: Record<string, unknown>;
}) => Promisable<unknown>;

/**
 * The shape of a FetchError-inspecting function.
 */
export type FetchErrorInspector = (params: {
  error: unknown;
  queue: RequestQueue;
  requestInfo: RequestInfo;
  requestInit: RequestInitWithSignal;
  state: Record<string, unknown>;
}) => Promisable<unknown>;

/**
 * Thrown in response to a queue-related error.
 */
export class RequestQueueError extends Error {}
makeNamedError(RequestQueueError, 'RequestQueueError');

/**
 * Thrown by `addRequestToQueue` when the request was removed from the queue
 * without being sent or otherwise processed.
 */
export class RequestQueueClearedError extends RequestQueueError {}
makeNamedError(RequestQueueClearedError, 'RequestQueueClearedError');

/**
 * The default `RequestInspector` used by each `RequestQueue` instance unless
 * otherwise configured. Simply passes through the given fetch parameters.
 */
export const defaultRequestInspector: RequestInspector = () => undefined;

/**
 * The default `ResponseInspector` used by each `RequestQueue` instance unless
 * otherwise configured. Simply passes through the `Response` instance.
 */
export const defaultResponseInspector: ResponseInspector = ({ response: res }) => res;

/**
 * The default `FetchErrorInspector` used by each `RequestQueue` instance unless
 * otherwise configured. Re-throws the `FetchError` instance.
 */
export const defaultFetchErrorInspector: FetchErrorInspector = ({ error: e }) => {
  throw e;
};

/**
 * Execute requests present in the request queue with respect to backoff data,
 * flow control, rate limits, and other data.
 */
export class RequestQueue<T = any> {
  /**
   * If non-zero, no new requests will be made until this many milliseconds have
   * transpired.
   */
  #delayRequestProcessingByMs = 0;

  /**
   * Once this is set to false and requestQueue is empty,
   * `queueAbortController.abort()` will be called automatically.
   */
  #keepProcessingRequestQueue = true;

  /**
   * Determines when queue processing is "soft-paused," which allows the
   * processor to avoid wasting cycles scheduling intervals when the request
   * queue is empty.
   */
  #queueProcessingIsSoftPaused = false;

  /**
   * Used to abort the request queue processor.
   */
  #timeoutId: NodeJS.Timeout | null = null;

  /**
   * Used to immediately end the delaying period.
   */
  #terminationAbortController = new AbortController();

  /**
   * A function used to individual requests based on feedback from request data.
   */
  #requestInspector: RequestInspector;

  /**
   * A function used to alter the behavior of the queue based on feedback from
   * response data.
   */
  #responseInspector: ResponseInspector;

  /**
   * A function used to alter the behavior of the queue when the fetch function
   * rejects.
   */
  #fetchErrorInspector: FetchErrorInspector;

  /**
   * Default request initialization parameters sent along with every request.
   */
  #defaultRequestInit: RequestInit = {};

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
    state: Record<string, unknown>
  ][] = [];

  /**
   * A counter used only in debug and stats output.
   */
  #debugIntervalCounter = 0;

  /**
   * A counter used only in debug and stats output.
   */
  #debugAddRequestCounter = 0;

  /**
   * A counter used only in debug and stats output.
   */
  #debugSentRequestCounter = 0;

  /**
   * Create, configure, and return a new RequestQueue instance. All instance
   * methods are auto-bound.
   */
  constructor({
    maxRequestsPerInterval,
    intervalPeriodMs,
    requestInspector,
    responseInspector,
    fetchErrorInspector,
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
     * A function used to alter the behavior of individual requests based on
     * available parameters. This function must do one of the following before
     * terminating:
     *
     *   - Mutate `addRequestToQueue`'s params before letting it continuing.
     *   - BYO fetch library and return a promise that resolves how you want.
     *   - Call `addRequestToQueue` again and return it (beware infinite loops).
     *   - Await a `setTimeout` promise to delay the request before continuing.
     *   - Throw an error causing the `addRequestToQueue` method to reject.
     *
     * Delaying a request using `requestInspector` will have no effect on the
     * processing of other requests or the period between intervals, making it
     * ideal for more complex (e.g. isolated, per-endpoint) throttling
     * requirements.
     *
     * If this function returns `undefined` or a promise that resolves to
     * `undefined`, an internal `fetch()` will be made using the request params
     * passed to (and potentially mutated by) this function. The fetch result
     * will be passed to `responseInspector`. Otherwise, the resolved defined
     * value of this function will be passed to `responseInspector` directly (no
     * additional internal `fetch()` happens).
     *
     * If this function throws, the corresponding `addRequestToQueue` call will
     * reject and `responseInspector` will not be called.
     *
     * @default defaultRequestInspector (see export)
     */
    requestInspector?: RequestInspector;
    /**
     * A function used to reshape response data before returning it through the
     * resolved `addRequestToQueue` promise. This function must do one of the
     * following before terminating:
     *
     *   - Return a JSON representation of the response, e.g. `response.json()`.
     *   - Interpret and/or transform the response data and return any value.
     *   - Throw an error causing the `addRequestToQueue` method to reject.
     *
     * The return value of this function will eventually be used as the resolved
     * value of the promise returned by the corresponding `addRequestToQueue`
     * call that triggered it. Similarly, if this function throws, the
     * corresponding `addRequestToQueue` call will reject.
     *
     * @default defaultResponseInspector (see export)
     */
    responseInspector?: ResponseInspector;
    /**
     * A function used to take some action after the node-fetch `fetch` function
     * rejects due to failure. Like `requestInspector`, this function must do
     * one of the following before terminating:
     *
     *   - Return a promise that resolves how you want.
     *   - Call `addRequestToQueue` again and return it (beware infinite loops).
     *   - Await a `setTimeout` promise to delay the request before continuing.
     *   - Throw an error causing the `addRequestToQueue` method to reject.
     *
     * Delaying a request using `requestInspector` will have no effect on the
     * processing of other requests or the period between intervals, making it
     * ideal to retry failed fetch requests.
     *
     * The resolved value of this function will always be passed to
     * `responseInspector` directly (no additional internal `fetch()` happens)
     * unless an error is thrown, in which case the `addRequestToQueue` return
     * value will reject.
     *
     * @default defaultFetchErrorInspector (see export)
     */
    fetchErrorInspector?: FetchErrorInspector;
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
    this.#requestInspector = requestInspector ?? defaultRequestInspector;
    this.#responseInspector = responseInspector ?? defaultResponseInspector;
    this.#fetchErrorInspector = fetchErrorInspector ?? defaultFetchErrorInspector;

    // ? Note that this only auto-binds public methods
    autobind(this);

    if (autoStart) {
      this.beginProcessingRequestQueue();
      this.gracefullyStopProcessingRequestQueue();
    }
  }

  /**
   * Returns `true` if the request queue is currently being processed or `false`
   * otherwise.
   */
  get isProcessingRequestQueue() {
    return !!this.#timeoutId;
  }

  /**
   * If non-zero, no new requests will be made until this many milliseconds have
   * transpired. This value is relative to when `delayRequestProcessingByMs` was
   * last called, so querying this property isn't useful without that additional
   * context.
   */
  get requestProcessingDelayMs() {
    return this.#delayRequestProcessingByMs;
  }

  /**
   * A function used to alter the behavior of individual requests based on
   * available parameters. This function must do one of the following before
   * terminating:
   *
   *   - Mutate `addRequestToQueue`'s params before letting it continuing.
   *   - BYO fetch library and return a promise that resolves how you want.
   *   - Call `addRequestToQueue` again and return it (beware infinite loops).
   *   - Await a `setTimeout` promise to delay the request before continuing.
   *   - Throw an error causing the `addRequestToQueue` method to reject.
   *
   * Delaying a request using `requestInspector` will have no effect on the
   * processing of other requests or the period between intervals, making it
   * ideal for more complex (e.g. isolated, per-endpoint) throttling
   * requirements.
   *
   * If this function returns `undefined` or a promise that resolves to
   * `undefined`, an internal `fetch()` will be made using the request params
   * passed to (and potentially mutated by) this function. The fetch result
   * will be passed to `responseInspector`. Otherwise, the resolved defined
   * value of this function will be passed to `responseInspector` directly (no
   * internal `fetch()` happens).
   *
   * If this function throws, the corresponding `addRequestToQueue` call will
   * reject and `responseInspector` will not be called.
   *
   * @default defaultRequestInspector (see export)
   */
  get requestInspector() {
    return this.#requestInspector;
  }

  set requestInspector(inspector) {
    debug('set new requestInspector');
    this.#requestInspector = inspector;
  }

  /**
   * A function used to reshape response data before returning it through the
   * resolved `addRequestToQueue` promise. This function must do one of the
   * following before terminating:
   *
   *   - Return a JSON representation of the response, e.g. `response.json()`.
   *   - Interpret and/or transform the response data and return any value.
   *   - Throw an error causing the `addRequestToQueue` method to reject.
   *
   * The return value of this function will eventually be used as the resolved
   * value of the promise returned by the corresponding `addRequestToQueue`
   * call that triggered it. Similarly, if this function throws, the
   * corresponding `addRequestToQueue` call will reject.
   *
   * @default defaultResponseInspector (see export)
   */
  get responseInspector() {
    return this.#responseInspector;
  }

  set responseInspector(inspector) {
    debug('set new responseInspector');
    this.#responseInspector = inspector;
  }

  /**
   * A function used to take some action after the node-fetch `fetch` function
   * rejects due to failure. Like `requestInspector`, this function must do one
   * of the following before terminating:
   *
   *   - Return a promise that resolves how you want.
   *   - Call `addRequestToQueue` again and return it (beware infinite loops).
   *   - Await a `setTimeout` promise to delay the request before continuing.
   *   - Throw an error causing the `addRequestToQueue` method to reject.
   *
   * Delaying a request using `requestInspector` will have no effect on the
   * processing of other requests or the period between intervals, making it
   * ideal to retry failed fetch requests.
   *
   * The resolved value of this function will always be passed to
   * `responseInspector` directly (no additional internal `fetch()` happens)
   * unless an error is thrown, in which case the `addRequestToQueue` return
   * value will reject.
   *
   * @default defaultFetchErrorInspector (see export)
   */
  get fetchErrorInspector() {
    return this.#fetchErrorInspector;
  }

  set fetchErrorInspector(inspector) {
    debug('set new fetchErrorInspector');
    this.#fetchErrorInspector = inspector;
  }

  /**
   * Default request initialization parameters sent along with every request.
   */
  get defaultRequestInit() {
    return this.#defaultRequestInit;
  }

  set defaultRequestInit(init) {
    debug('set defaultRequestInit: %O => %O', this.#defaultRequestInit, init);
    this.#defaultRequestInit = init;
  }

  /**
   * A maximum of `maxRequestsPerInterval` requests will be processed every
   * `>=intervalPeriodMs` milliseconds.
   */
  get maxRequestsPerInterval() {
    return this.#maxRequestsPerInterval;
  }

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

  set intervalPeriodMs(period) {
    debug(`set intervalPeriodMs: ${this.#intervalPeriodMs} => ${period}`);
    this.#intervalPeriodMs = period;
  }

  #scheduleNextInterval() {
    this.#timeoutId = setTimeout(
      this.#processRequestQueue.bind(this),
      this.intervalPeriodMs
    );

    if (this.#queueProcessingIsSoftPaused) {
      debug('queue processing unpaused');
      this.#queueProcessingIsSoftPaused = false;
    }

    debug(`scheduled next interval in ${this.intervalPeriodMs}ms`);
  }

  #finishGracefulStop() {
    this.#timeoutId = null;
    this.#queueProcessingIsSoftPaused = false;

    debug('queue processing stopped gracefully');

    this.#queueStoppedPromiseResolver();
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

        if (
          !terminationAbortController.signal.aborted &&
          this.#delayRequestProcessingByMs
        ) {
          reqDebug('detected non-zero delayRequestProcessingByMs, processing paused');
          reqDebug(`resuming in ${this.#delayRequestProcessingByMs}ms...`);

          const previousDelayRequestProcessingByMs = this.#delayRequestProcessingByMs;
          this.#delayRequestProcessingByMs = 0;

          // ? If we need to delay, pause processing request queue immediately
          // eslint-disable-next-line no-await-in-loop
          await wait(previousDelayRequestProcessingByMs, undefined, {
            signal: terminationAbortController.signal
          });

          reqDebug(`processing resumed`);

          if (this.#delayRequestProcessingByMs != 0) {
            subDebug.warn(
              `resetting delayRequestProcessingByMs after resuming queue processing`
            );
            this.#delayRequestProcessingByMs = 0;
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

        const [fetchParams, callback, state] = enqueuedRequest;

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
        } as RequestInitWithSignal;

        const isFinal = count + 1 >= this.maxRequestsPerInterval;

        reqDebug(`preparing to fetch: ${fetchParams[0]}`);

        void (async () => {
          try {
            reqDebug('triggering request inspector');

            const inspectorParams = {
              queue: this,
              requestInfo: fetchParams[0],
              requestInit: fetchParams[1] as RequestInitWithSignal,
              state
            };

            const requestInspectorResult = await this.requestInspector(
              inspectorParams
            );

            let res: unknown;

            if (requestInspectorResult === undefined) {
              try {
                reqDebug(`internal fetch: ${inspectorParams.requestInfo}`);
                this.#debugSentRequestCounter++;

                res = await fetch(
                  inspectorParams.requestInfo,
                  inspectorParams.requestInit
                );

                reqDebug('response received');
              } catch (e) {
                reqDebug.error(
                  `triggering error inspector for in-flight request error: ${e}`
                );

                try {
                  res = await this.fetchErrorInspector({
                    error: e,
                    queue: this,
                    requestInfo: inspectorParams.requestInfo,
                    requestInit: inspectorParams.requestInit,
                    state: inspectorParams.state
                  });
                } catch (e) {
                  reqDebug.error(`unhandled error during in-flight request: ${e}`);
                  callback(
                    e instanceof Error
                      ? e
                      : /* istanbul ignore next */
                        new HttpError(res as Response, String(e))
                  );
                  return;
                }
              }
            } else {
              reqDebug(
                'skipping internal fetch (due to defined requestInspector result)'
              );
              res = requestInspectorResult;
            }

            if (isFinal) {
              reqDebug('this is the final request to be processed in this interval');
            }

            try {
              reqDebug('triggering response inspector');

              callback(
                null,
                await this.responseInspector({
                  response: res,
                  queue: this,
                  requestInfo: inspectorParams.requestInfo,
                  requestInit: inspectorParams.requestInit,
                  state: inspectorParams.state
                })
              );

              reqDebug('finished processing request');
            } catch (e) {
              reqDebug.error(`unhandled error during response inspection: ${e}`);
              callback(e instanceof Error ? e : new HttpError(String(e)));
            }
          } catch (e) {
            reqDebug.error(`unhandled error during request inspection: ${e}`);
            callback(e instanceof Error ? e : new HttpError(String(e)));
          }
        })();
      }

      subDebug(
        `processing complete: ${count} request${count > 1 ? 's' : ''} in-flight`
      );

      this.#scheduleNextInterval();
    } else if (this.#keepProcessingRequestQueue) {
      subDebug('queue empty: nothing to process in this interval');

      this.#queueProcessingIsSoftPaused = true;

      subDebug(
        'queue processing soft-paused (next interval will be scheduled on new request)'
      );
    } else {
      subDebug(
        'queue empty and graceful stop requested: queue processing will be terminated'
      );

      this.#finishGracefulStop();
    }
  }

  /**
   * Append a request to the request queue. This function returns a promise that
   * will resolve with the request's response data as determined by
   * `responseInspector`.
   */
  addRequestToQueue<TT = T>(...params: ExtendedFetchParams): Promise<TT> {
    debug('adding (appending) new request to queue');
    this.#debugAddRequestCounter++;

    if (this.#queueProcessingIsSoftPaused && this.#keepProcessingRequestQueue) {
      this.#scheduleNextInterval();
    }

    return new Promise((resolve, reject) => {
      this.#requestQueue.push([
        [params[0], params[1]],
        (err, retval) => {
          err ? reject(err) : resolve(retval as TT);
        },
        params[2] || {}
      ]);
    });
  }

  /**
   * Exactly the same as `addRequestToQueue` in every way, except the request is
   * _prepended_ rather than appended to the queue.
   */
  prependRequestToQueue<TT = T>(...params: ExtendedFetchParams): Promise<TT> {
    debug('adding (prepending) new request to queue');
    this.#debugAddRequestCounter++;

    if (this.#queueProcessingIsSoftPaused && this.#keepProcessingRequestQueue) {
      this.#scheduleNextInterval();
    }

    return new Promise((resolve, reject) => {
      this.#requestQueue.unshift([
        [params[0], params[1]],
        (err, retval) => {
          err ? reject(err) : resolve(retval as TT);
        },
        params[2] || {}
      ]);
    });
  }

  /**
   * Calling this function will cause the request processor to wait `delay`
   * milliseconds before sending any subsequent requests. Requests that have
   * already been sent will resolve without delay.
   *
   * After the delay period transpires, the internal delay value will be reset
   * to `0` _regardless of calls to `delayRequestProcessingByMs` in the
   * interim_. Hence, due to the asynchronous nature of request processing,
   * calling `delayRequestProcessingByMs` asynchronously (e.g. via
   * `requestInspector` or `responseInspector`) **does not guarantee that the
   * new value will be respected.**
   *
   * To implement backoff or other complex throttling functionality, consider
   * instead using per-request delays manually (e.g. via `setTimeout`) at the
   * `requestInspector` level.
   */
  delayRequestProcessingByMs(delay: number) {
    if (delay < 0) {
      throw new RequestQueueError(
        `delayRequestProcessingByMs must be a non-negative integer, saw ${delay} instead`
      );
    }

    debug(
      `set delayRequestProcessingByMs: ${
        this.#delayRequestProcessingByMs
      } => ${delay}`
    );
    this.#delayRequestProcessingByMs = delay;
  }

  /**
   * Begin asynchronously processing the request queue. If the queue is already
   * being processed, calling this function again will throw.
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
      this.#queueProcessingIsSoftPaused = false;

      this.#terminationAbortController = new AbortController();

      this.#queueStoppedPromise = new Promise((resolve) => {
        this.#queueStoppedPromiseResolver = resolve;
      });

      this.#scheduleNextInterval();
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
   *
   * This function will throw if called when the queue is not being processed.
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

    if (this.#queueProcessingIsSoftPaused) {
      this.#finishGracefulStop();
    }
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
   *
   * This function will throw if called when the queue is not being processed.
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
    this.#queueProcessingIsSoftPaused = false;

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

  /**
   * Returns various statistics about the queue runtime.
   */
  getStats() {
    return {
      intervals: this.#debugIntervalCounter,
      requestsEnqueued: this.#debugAddRequestCounter,
      internalRequestsSent: this.#debugSentRequestCounter
    };
  }
}
