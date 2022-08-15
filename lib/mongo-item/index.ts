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
export type IdItem<IdType extends ObjectId> =
  | WithId<unknown>
  | { _id: string }
  | string
  | IdType
  | null
  | undefined;

/**
 * The shape of an array of objects that can be translated into an array of
 * `ObjectId` (or `T`) instances or are `null`/`undefined`.
 */
export type IdItemArray<
  IdType extends ObjectId,
  ItemType
> = ItemType extends IdItem<IdType>[]
  ? ItemType
  : ItemType extends unknown[]
  ? IdItemArray<IdType, ItemType[number]>[]
  : never;

export type MaybeNestedIdArray<
  IdType extends ObjectId,
  ItemArrayType
> = ItemArrayType extends (IdItem<IdType> | IdItemArray<IdType, ItemArrayType>)[]
  ? (IdType | MaybeNestedIdArray<IdType, ItemArrayType[number]>)[]
  : ItemArrayType extends IdItemArray<IdType, ItemArrayType>
  ? MaybeNestedIdArray<IdType, ItemArrayType[number]>[]
  : IdType;

const j = {} as unknown as IdItemArray<>;
const i = {} as unknown as MaybeNestedIdArray<ObjectId, (string | string[])[]>;

/**
 * Reduces an `item` down to its `ObjectId` instance.
 */
export function itemToObjectId<IdType extends ObjectId>(item: IdItem<IdType>): IdType;
/**
 * Reduces an array of `items` down to their respective `ObjectId` instances.
 *
 * An attempt is made to eliminate duplicates via `new Set(...)`, but the
 * absence of duplicates is not guaranteed when `items` contains `WithId<...>`
 * objects and/or contains nested arrays. If you must eliminate duplicates,
 * flatten your array before passing it into this function.
 */
export function itemToObjectId<
  IdType extends ObjectId,
  ItemType,
  ItemArrayType extends IdItemArray<IdType, ItemType>
>(items: ItemType): MaybeNestedIdArray<IdType, ItemArrayType>;
export function itemToObjectId<IdType extends ObjectId>(
  item: IdItem<IdType> | IdItemArray<IdType, unknown[]>
): unknown {
  let _id: unknown = '<uninitialized>';
  try {
    return item instanceof ObjectId
      ? item
      : Array.isArray(item)
      ? Array.from(new Set<typeof item[0]>(item)).map((i) => {
          return (
            i instanceof ObjectId
              ? i
              : Array.isArray(i)
              ? itemToObjectId(i)
              : typeof i == 'string'
              ? ((_id = i), new ObjectId(i))
              : i?._id instanceof ObjectId
              ? i._id
              : typeof i?._id == 'string'
              ? ((_id = i._id), new ObjectId(i._id))
              : toss(
                  new GuruMeditationError(`encountered irreducible sub-item: ${i}`)
                )
          ) as IdType;
        })
      : typeof item == 'string'
      ? ((_id = item), new ObjectId(item) as IdType)
      : item?._id instanceof ObjectId
      ? (item._id as IdType)
      : typeof item?._id == 'string'
      ? ((_id = item._id), new ObjectId(item._id) as IdType)
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
 *
 * An attempt is made to eliminate duplicates via `new Set(...)`, but the
 * absence of duplicates is not guaranteed when `items` contains nested arrays.
 * If you must eliminate duplicates, flatten your array before passing it into
 * this function.
 */
export function itemToStringId<T extends ObjectId>(items: IdItemArray<T>): string[];
export function itemToStringId<T extends ObjectId>(
  item: IdItem<T> | IdItemArray<T>
): string | string[] {
  return Array.isArray(item)
    ? itemToObjectId<T>(item).map(String)
    : itemToObjectId<T>(item).toString();
}
