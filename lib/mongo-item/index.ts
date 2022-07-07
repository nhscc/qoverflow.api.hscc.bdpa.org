import { ObjectId } from 'mongodb';
import { isError } from '@xunnamius/types';
import { toss } from 'toss-expression';
import { GuruMeditationError, ValidationError } from 'named-app-errors';

import type { Collection, WithId } from 'mongodb';

/**
 * Represents the value of the `_id` property of a MongoDB collection entry.
 * Optionally, a key other than `_id` can be specified using the `{ key: ...,
 * id: ... }` syntax.
 */
export type ItemExistsIdParam =
  | string
  | ObjectId
  | { key: string; id: string | ObjectId };

/**
 * Available options for the `itemExists` function.
 */
export type ItemExistsOptions = {
  /**
   * Items matching excludeId will be completely ignored by this function.
   *
   * @default undefined
   */
  excludeId?: ItemExistsIdParam;
  /**
   * If `true`, ids will be matched in a case-insensitive manner (via locale).
   *
   * @default false
   */
  caseInsensitive?: boolean;
  /**
   * When looking for an item matching `{ _id: id }`, where the descriptor key
   * is the string `"_id"`, `id` will be optimistically wrapped in a `new
   * ObjectId(id)` call. Set this to `false` to prevent this.
   *
   * @default true
   */
  optimisticCoercion?: boolean;
};

/**
 * Checks if an item matching `{ _id: id }` exists within `collection`.
 */
export async function itemExists<T>(
  collection: Collection<T>,
  id: string | ObjectId,
  options?: ItemExistsOptions
): Promise<boolean>;
/**
 * Checks if an item matching `{ [descriptor.key]: descriptor.id }` exists
 * within `collection`.
 */
export async function itemExists<T>(
  collection: Collection<T>,
  descriptor: { key: string; id: string | ObjectId },
  options?: ItemExistsOptions
): Promise<boolean>;
export async function itemExists<T>(
  collection: Collection<T>,
  id: ItemExistsIdParam,
  options?: ItemExistsOptions
): Promise<boolean> {
  let excludeIdProperty: string | null = null;
  let excludeId: string | ObjectId | null = null;
  const idProperty = typeof id == 'string' || id instanceof ObjectId ? '_id' : id.key;
  id = typeof id == 'string' || id instanceof ObjectId ? id : id.id;

  if (options?.excludeId) {
    excludeIdProperty =
      typeof options.excludeId == 'string' || options.excludeId instanceof ObjectId
        ? '_id'
        : options.excludeId.key;

    excludeId =
      typeof options.excludeId == 'string' || options.excludeId instanceof ObjectId
        ? options.excludeId
        : options.excludeId.id;
  }

  if (idProperty == excludeIdProperty) {
    throw new GuruMeditationError(
      `cannot lookup an item by property "${idProperty}" while also filtering results by that same property`
    );
  }

  if (
    options?.optimisticCoercion !== false &&
    typeof id == 'string' &&
    idProperty == '_id'
  ) {
    id = new ObjectId(id);
  }

  return (
    (await collection.countDocuments(
      {
        [idProperty]: id,
        ...(excludeIdProperty ? { [excludeIdProperty]: { $ne: excludeId } } : {})
      } as unknown as Parameters<typeof collection.countDocuments>[0],
      {
        ...(options?.caseInsensitive
          ? { collation: { locale: 'en', strength: 2 } }
          : {})
      }
    )) != 0
  );
}

/**
 * The shape of an object that can be translated into an `ObjectId` (or `T`)
 * instance or is `null`/`undefined`.
 */
export type IdItem<T extends ObjectId> =
  | WithId<unknown>
  | string
  | T
  | null
  | undefined;

/**
 * The shape of an array of objects that can be translated into an array of
 * `ObjectId` (or `T`) instances or are `null`/`undefined`.
 */
export type IdItemArray<T extends ObjectId> = IdItem<T>[];

/**
 * Reduces an `item` down to its `ObjectId` instance.
 */
export function itemToObjectId<T extends ObjectId>(item: IdItem<T>): T;
/**
 * Reduces an array of `items` down to their respective `ObjectId` instances.
 *
 * An attempt is made to eliminate duplicates via `new Set(...)`, but the
 * absence of duplicates is not guaranteed when `items` contains `WithId<...>`
 * objects.
 */
export function itemToObjectId<T extends ObjectId>(items: IdItemArray<T>): T[];
export function itemToObjectId<T extends ObjectId>(
  item: IdItem<T> | IdItemArray<T>
): T | T[] {
  let _id: unknown = '<uninitialized>';
  try {
    return item instanceof ObjectId
      ? item
      : Array.isArray(item)
      ? Array.from(new Set<typeof item[0]>(item)).map((i) => {
          _id = i;
          return (
            i instanceof ObjectId
              ? i
              : typeof i == 'string'
              ? new ObjectId(i)
              : i?._id instanceof ObjectId
              ? i._id
              : toss(
                  new GuruMeditationError(`encountered irreducible sub-item: ${i}`)
                )
          ) as T;
        })
      : typeof item == 'string'
      ? ((_id = item), new ObjectId(item) as T)
      : item?._id instanceof ObjectId
      ? (item._id as T)
      : toss(new GuruMeditationError(`encountered irreducible item: ${item}`));
  } catch (e) {
    if (isError(e) && e.name == 'BSONTypeError') {
      throw new ValidationError(`invalid id "${_id}"`);
    }

    throw e;
  }
}

/**
 * Reduces an `item` down to the string representation of its `ObjectId`
 * instance.
 */
export function itemToStringId<T extends ObjectId>(item: IdItem<T>): string;
/**
 * Reduces an array of `items` down to the string representations of their
 * respective `ObjectId` instances.
 */
export function itemToStringId<T extends ObjectId>(items: IdItemArray<T>): string[];
export function itemToStringId<T extends ObjectId>(
  item: IdItem<T> | IdItemArray<T>
): string | string[] {
  return Array.isArray(item)
    ? itemToObjectId<T>(item).map(String)
    : itemToObjectId<T>(item).toString();
}
