import { isPlainObject as originalIsPlainObject } from 'is-plain-object';

export function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return originalIsPlainObject(obj);
}
