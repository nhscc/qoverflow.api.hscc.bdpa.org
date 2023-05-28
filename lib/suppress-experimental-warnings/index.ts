import { debugFactory } from 'multiverse/debug-extended';

const debug = debugFactory('suppress-warnings:debug');

/**
 * Prevent Node from emitting specific warnings when running third-party code.
 */
export function suppressWarnings(
  /**
   * The exact (case-sensitive) names of the warnings that will be suppressed.
   *
   * @default ['ExperimentalWarning']
   */
  names?: string[]
) {
  const ignoredWarningNames = names || ['ExperimentalWarning'];
  const warningListeners = process.listeners('warning');
  let alreadyWarned = false;

  if (warningListeners[0]) {
    const originalWarningListener = warningListeners[0];
    process.removeAllListeners('warning');

    process.prependListener('warning', (warning) => {
      if (!ignoredWarningNames.includes(warning.name)) {
        originalWarningListener(warning);
      } else if (!alreadyWarned) {
        debug.warn('one or more warnings were suppressed');
        alreadyWarned = true;
      }
    });
  }

  if (warningListeners.length != 1) {
    debug.warn(
      `expected 1 listener on the process "warning" event, but removed ${warningListeners.length}`
    );
  }
}
