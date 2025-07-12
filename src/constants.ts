/* eslint-disable unicorn/prefer-export-from */
import { name as packageName } from 'rootverse:package.json';

/**
 * This value is used in first party source app-wide as a debug package
 * namespace.
 */
export const debugNamespace = packageName;
