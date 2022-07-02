import { MongoServerError, ObjectId } from 'mongodb';
import { isPlainObject } from 'is-plain-object';
import { getDb } from 'multiverse/mongo-schema';
import { itemExists } from 'multiverse/mongo-item';
import { getEnv } from 'universe/backend/env';
import { toss } from 'toss-expression';

import { publicUserProjection, VotesUpdateOperation } from 'universe/backend/db';

import {
  ItemNotFoundError,
  ItemsNotFoundError,
  InvalidItemError,
  ValidationError,
  ErrorMessage
} from 'universe/error';

import type {
  PublicUser,
  NewUser,
  PatchUser,
  Username,
  UserId,
  InternalUser,
  NewAnswer,
  NewComment,
  NewMail,
  NewQuestion,
  PatchAnswer,
  PatchQuestion,
  PublicAnswer,
  PublicComment,
  PublicMail,
  PublicQuestion
} from 'universe/backend/db';

// TODO: switch to using itemToObjectId from mongo-item library

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const usernameRegex = /^[a-zA-Z0-9_-]+$/;
const hexadecimalRegex = /^[a-fA-F0-9]+$/;

/**
 * Node properties that can be matched against with `searchNodes()` matchers.
 * Proxied properties should be listed in their final form.
 *
 * Specifically does not include tags or permissions, which are handled
 * specially.
 */
const matchableStrings = [
  'type',
  'owner',
  'createdAt',
  'modifiedAt',
  'name-lowercase', // * Proxied from name
  'size',
  'text'
];

/**
 * Node properties that can be matched against with `searchNodes()`
 * regexMatchers. Must be string fields. Proxied properties should be listed in
 * their final form.
 *
 * Specifically does not include tags or permissions, which are handled
 * specially.
 */
const regexMatchableStrings = [
  'type',
  'owner',
  'name-lowercase', // * Proxied from name
  'text'
];

/**
 * Whitelisted MongoDB sub-matchers that can be used with `searchNodes()`, not
 * including the special "$or" sub-matcher.
 */
const matchableSubStrings = ['$gt', '$lt', '$gte', '$lte'];

/**
 * Whitelisted MongoDB-esque sub-specifiers that can be used with
 * `searchNodes()` via the "$or" sub-matcher.
 */
type SubSpecifierObject = {
  [subspecifier in '$gt' | '$lt' | '$gte' | '$lte']?: number;
};

/**
 * Convert an array of node_id strings into a set of node_id ObjectIds.
 * TODO: replace with ItemToObjectIds
 */
const normalizeNodeIds = (ids: string[]) => {
  let node_id = '<uninitialized>';
  try {
    return Array.from(new Set(ids)).map((id) => {
      node_id = id;
      return new ObjectId(id);
    });
  } catch {
    throw new ValidationError(ErrorMessage.InvalidObjectId(node_id));
  }
};

/**
 * Convert an array of strings into a set of proper node tags (still strings).
 */
const normalizeTags = (tags: string[]) => {
  return Array.from(new Set(tags.map((tag) => tag.toLowerCase())));
};

/**
 * Validate a username string for correctness.
 */
function validateUsername(username: unknown): username is Username {
  return (
    typeof username == 'string' &&
    usernameRegex.test(username) &&
    username.length >= getEnv().MIN_USER_NAME_LENGTH &&
    username.length <= getEnv().MAX_USER_NAME_LENGTH
  );
}

/**
 * Validate a new or patch user data object.
 */
function validateUserData(
  data: NewUser | PatchUser | undefined,
  { required }: { required: boolean }
): asserts data is NewUser | PatchUser {
  if (!data || !isPlainObject(data)) {
    throw new ValidationError(ErrorMessage.InvalidJSON());
  }

  const {
    USER_KEY_LENGTH,
    USER_SALT_LENGTH,
    MIN_USER_EMAIL_LENGTH,
    MAX_USER_EMAIL_LENGTH
  } = getEnv();

  if (
    (required || (!required && data.email !== undefined)) &&
    (typeof data.email != 'string' ||
      !emailRegex.test(data.email) ||
      data.email.length < MIN_USER_EMAIL_LENGTH ||
      data.email.length > MAX_USER_EMAIL_LENGTH)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength(
        'email',
        MIN_USER_EMAIL_LENGTH,
        MAX_USER_EMAIL_LENGTH,
        'string'
      )
    );
  }

  if (
    (required || (!required && data.salt !== undefined)) &&
    (typeof data.salt != 'string' ||
      !hexadecimalRegex.test(data.salt) ||
      data.salt.length != USER_SALT_LENGTH)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('salt', USER_SALT_LENGTH, null, 'hexadecimal')
    );
  }

  if (
    (required || (!required && data.key !== undefined)) &&
    (typeof data.key != 'string' ||
      !hexadecimalRegex.test(data.key) ||
      data.key.length != USER_KEY_LENGTH)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('key', USER_KEY_LENGTH, null, 'hexadecimal')
    );
  }
}

export async function getAllUsers({
  after
}: {
  after: string | undefined;
}): Promise<PublicUser[]> {
  const afterId: UserId | undefined = (() => {
    try {
      return after ? new ObjectId(after) : undefined;
    } catch {
      throw new ValidationError(ErrorMessage.InvalidObjectId(after as string));
    }
  })();

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');

  if (afterId && !(await itemExists(users, afterId))) {
    throw new ItemNotFoundError(after, 'user_id');
  }

  return users
    .find(afterId ? { _id: { $lt: afterId } } : {})
    .sort({ _id: -1 })
    .limit(getEnv().RESULTS_PER_PAGE)
    .project<PublicUser>(publicUserProjection)
    .toArray();
}

export async function getUser({
  username
}: {
  username: Username | undefined;
}): Promise<PublicUser> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');

  return (
    (await users
      .find({ username })
      .project<PublicUser>(publicUserProjection)
      .next()) || toss(new ItemNotFoundError(username, 'user'))
  );
}

export async function createUser({
  data
}: {
  data: NewUser | undefined;
}): Promise<PublicUser> {
  validateUserData(data, { required: true });

  const { MAX_USER_NAME_LENGTH, MIN_USER_NAME_LENGTH } = getEnv();

  if (!validateUsername(data.username)) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength(
        'username',
        MIN_USER_NAME_LENGTH,
        MAX_USER_NAME_LENGTH
      )
    );
  }

  if (data.username == 'public') {
    throw new ValidationError(ErrorMessage.IllegalUsername());
  }

  const { email, username, key, salt, ...rest } = data as Required<NewUser>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...
  try {
    await users.insertOne({
      _id: new ObjectId(),
      username,
      email,
      salt: salt.toLowerCase(),
      key: key.toLowerCase()
    });
  } catch (e) {
    /* istanbul ignore else */
    if (e instanceof MongoServerError && e.code == 11000) {
      if (e.keyPattern?.username !== undefined) {
        throw new ValidationError(ErrorMessage.DuplicateFieldValue('username'));
      }

      /* istanbul ignore else */
      if (e.keyPattern?.email !== undefined) {
        throw new ValidationError(ErrorMessage.DuplicateFieldValue('email'));
      }
    }

    /* istanbul ignore next */
    throw e;
  }

  return getUser({ username });
}

export async function updateUser({
  username,
  data
}: {
  username: Username | undefined;
  data: PatchUser | undefined;
}): Promise<void> {
  if (data && !Object.keys(data).length) return;

  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  validateUserData(data, { required: false });

  const { email, key, salt, ...rest } = data as Required<PatchUser>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...
  try {
    const result = await users.updateOne(
      { username },
      {
        $set: {
          ...(email ? { email } : {}),
          ...(salt ? { salt: salt.toLowerCase() } : {}),
          ...(key ? { key: key.toLowerCase() } : {})
        }
      }
    );

    if (!result.matchedCount) {
      throw new ItemNotFoundError(username, 'user');
    }
  } catch (e) {
    if (e instanceof MongoServerError && e.code == 11000) {
      /* istanbul ignore else */
      if (e.keyPattern?.email !== undefined) {
        throw new ValidationError(ErrorMessage.DuplicateFieldValue('email'));
      }
    }

    throw e;
  }
}

export async function deleteUser({
  username
}: {
  username: Username | undefined;
}): Promise<void> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');
  const fileNodes = db.collection<InternalNode>('file-nodes');
  const metaNodes = db.collection<InternalNode>('meta-nodes');
  const result = await users.deleteOne({ username });

  if (!result.deletedCount) {
    throw new ItemNotFoundError(username, 'user');
  }

  await Promise.all(
    [fileNodes, metaNodes].map((col) =>
      col.updateMany(
        { [`permissions.${username}`]: { $exists: true } },
        { $unset: { [`permissions.${username}`]: '' } }
      )
    )
  );
}

export async function authAppUser({
  username,
  key
}: {
  username: Username | undefined;
  key: string | undefined;
}): Promise<boolean> {
  if (!key || !username) return false;

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');

  return !!(await users.countDocuments({ username, key }));
}

export async function searchQuestions({
  username,
  after,
  match,
  regexMatch
}: {
  username: Username | undefined;
  after: string | undefined;
  match: {
    [specifier: string]:
      | string
      | string[]
      | number
      | boolean
      | SubSpecifierObject
      | { $or: SubSpecifierObject[] };
  };
  regexMatch: {
    [specifier: string]: string;
  };
}): Promise<PublicQuestion[]> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const { MAX_SEARCHABLE_TAGS, RESULTS_PER_PAGE } = getEnv();

  // ? Derive the actual after_id
  const afterId: UserId | undefined = (() => {
    try {
      return after ? new ObjectId(after) : undefined;
    } catch {
      throw new ValidationError(ErrorMessage.InvalidObjectId(after as string));
    }
  })();

  // ? Initial matcher validation
  if (!isPlainObject(match)) {
    throw new ValidationError(ErrorMessage.InvalidMatcher('match'));
  } else if (!isPlainObject(regexMatch)) {
    throw new ValidationError(ErrorMessage.InvalidMatcher('regexMatch'));
  }

  // ? Handle aliasing/proxying
  [regexMatch, match].forEach((matchSpec) => {
    if (typeof matchSpec.name == 'string') {
      matchSpec['name-lowercase'] = matchSpec.name.toLowerCase();
      delete matchSpec.name;
    }

    if (Array.isArray(matchSpec.tags)) {
      matchSpec.tags = normalizeTags(matchSpec.tags);
    }
  });

  // ? Validate username and after_id

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const users = db.collection<InternalUser>('users');
  const fileNodes = db.collection('file-nodes');
  const metaNodes = db.collection('meta-nodes');

  if (
    afterId &&
    !(await itemExists(fileNodes, afterId)) &&
    !(await itemExists(metaNodes, afterId))
  ) {
    throw new ItemNotFoundError(after, 'node_id');
  }

  if (!(await itemExists(users, { key: 'username', id: username }))) {
    throw new ItemNotFoundError(username, 'user');
  }

  // ? Validate the match object
  let sawPermissionsSpecifier = false;
  for (const [key, val] of Object.entries(match)) {
    if (key == 'tags') {
      if (!Array.isArray(val)) {
        throw new ValidationError(
          ErrorMessage.InvalidSpecifierValueType(key, 'an array')
        );
      }

      if (val.length > MAX_SEARCHABLE_TAGS) {
        throw new ValidationError(
          ErrorMessage.TooManyItemsRequested('searchable tags')
        );
      }
    } else if (key == 'permissions') {
      throw new ValidationError(ErrorMessage.UnknownPermissionsSpecifier());
    } else if (key.startsWith('permissions.')) {
      if (sawPermissionsSpecifier) {
        throw new ValidationError(
          ErrorMessage.TooManyItemsRequested('permissions specifiers')
        );
      }
      sawPermissionsSpecifier = true;
    } else {
      if (!matchableStrings.includes(key)) {
        throw new ValidationError(ErrorMessage.UnknownSpecifier(key));
      }

      if (isPlainObject(val)) {
        let valNotEmpty = false;

        for (const [subkey, subval] of Object.entries(val)) {
          if (subkey == '$or') {
            if (!Array.isArray(subval) || subval.length != 2) {
              throw new ValidationError(ErrorMessage.InvalidOrSpecifier());
            }

            if (
              subval.every((sv, ndx) => {
                if (!isPlainObject(sv)) {
                  throw new ValidationError(
                    ErrorMessage.InvalidOrSpecifierNonObject(ndx)
                  );
                }

                const entries = Object.entries(sv);

                if (!entries.length) return false;
                if (entries.length != 1) {
                  throw new ValidationError(
                    ErrorMessage.InvalidOrSpecifierBadLength(ndx)
                  );
                }

                entries.forEach(([k, v]) => {
                  if (!matchableSubStrings.includes(k)) {
                    throw new ValidationError(
                      ErrorMessage.InvalidOrSpecifierInvalidKey(ndx, k)
                    );
                  }

                  if (typeof v != 'number') {
                    throw new ValidationError(
                      ErrorMessage.InvalidOrSpecifierInvalidValueType(ndx, k)
                    );
                  }
                });

                return true;
              })
            ) {
              valNotEmpty = true;
            }
          } else {
            valNotEmpty = true;
            if (!matchableSubStrings.includes(subkey)) {
              throw new ValidationError(ErrorMessage.UnknownSpecifier(subkey, true));
            }

            if (typeof subval != 'number') {
              throw new ValidationError(
                ErrorMessage.InvalidSpecifierValueType(subkey, 'a number', true)
              );
            }
          }
        }

        if (!valNotEmpty)
          throw new ValidationError(
            ErrorMessage.InvalidSpecifierValueType(key, 'a non-empty object')
          );
      } else if (
        val !== null &&
        !['number', 'string', 'boolean'].includes(typeof val)
      ) {
        throw new ValidationError(
          ErrorMessage.InvalidSpecifierValueType(
            key,
            'a number, string, boolean, or sub-specifier object'
          )
        );
      }
    }
  }

  // ? Validate the regexMatch object
  for (const [key, val] of Object.entries(regexMatch)) {
    if (key == 'permissions') {
      throw new ValidationError(ErrorMessage.UnknownPermissionsSpecifier());
    } else if (key.startsWith('permissions.')) {
      if (sawPermissionsSpecifier) {
        throw new ValidationError(
          ErrorMessage.TooManyItemsRequested('permissions specifiers')
        );
      }
      sawPermissionsSpecifier = true;
    } else {
      if (!regexMatchableStrings.includes(key)) {
        throw new ValidationError(ErrorMessage.UnknownSpecifier(key));
      }

      if (!val || typeof val != 'string') {
        throw new ValidationError(ErrorMessage.InvalidRegexString(key));
      }
    }
  }

  // ? Construct aggregation primitives

  const finalRegexMatch = Object.entries(regexMatch).reduce((obj, [spec, val]) => {
    obj[spec] = { $regex: val, $options: 'mi' };
    return obj;
  }, {} as Record<string, unknown>);

  const orMatcher: { [key: string]: SubSpecifierObject }[] = [];
  const tagsMatcher: { tags?: { $in: string[] } } = {};

  // ? Special handling for tags matching
  if (match.tags) {
    tagsMatcher.tags = { $in: match.tags as string[] };
    delete match.tags;
  }

  // ? Separate out the $or sub-specifiers for special treatment
  Object.entries(match).forEach(([spec, val]) => {
    if (isPlainObject(val)) {
      const obj = val as { $or?: unknown };

      if (obj.$or) {
        (obj.$or as SubSpecifierObject[]).forEach((operand) =>
          orMatcher.push({
            [spec]: operand
          })
        );
        delete obj.$or;
      }

      // ? Delete useless matchers if they've been emptied out
      if (obj && !Object.keys(obj).length) delete match[spec];
    }
  });

  const $match = {
    ...(afterId ? { _id: { $lt: afterId } } : {}),
    ...match,
    $and: [
      {
        $or: [{ owner: username }, { [`permissions.${username}`]: { $exists: true } }]
      },
      ...(orMatcher.length ? [{ $or: orMatcher }] : [])
    ],
    ...tagsMatcher,
    ...finalRegexMatch
  };

  const pipeline = [
    { $match },
    { $project: { ...publicFileNodeProjection, _id: true } },
    {
      $unionWith: {
        coll: 'meta-nodes',
        pipeline: [
          { $match },
          { $project: { ...publicMetaNodeProjection, _id: true } }
        ]
      }
    },
    { $sort: { _id: -1 } },
    { $limit: RESULTS_PER_PAGE },
    { $project: { _id: false } }
  ];

  // ? Run the aggregation and return the result
  return db.collection('file-nodes').aggregate<PublicNode>(pipeline).toArray();
}

export async function getUserQuestions({
  user_id,
  after_id
}: {
  user_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicQuestion[]> {
  // TODO
  void user_id, after_id;
  return [];
}

export async function getUserAnswers({
  user_id,
  after_id
}: {
  user_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicAnswer[]> {
  // TODO
  void user_id, after_id;
  return [];
}

export async function getQuestion({
  question_id
}: {
  question_id: string | undefined;
}): Promise<PublicQuestion> {
  // TODO
  void question_id;
  return {} as PublicQuestion;
}

export async function createQuestion({
  data
}: {
  data: NewQuestion | undefined;
}): Promise<PublicQuestion> {
  // TODO
  void data;
  return {} as PublicQuestion;
}

export async function updateQuestion({
  question_id,
  data
}: {
  question_id: string | undefined;
  data: PatchQuestion | undefined;
}): Promise<void> {
  // TODO
  void question_id, data;
}

export async function getAnswers({
  question_id,
  after_id
}: {
  question_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicAnswer[]> {
  // TODO
  void question_id, after_id;
  return [];
}

export async function createAnswer({
  question_id,
  data
}: {
  question_id: string | undefined;
  data: NewAnswer | undefined;
}): Promise<PublicAnswer> {
  // TODO
  void question_id, data;
  return {} as PublicAnswer;
}

export async function updateAnswer({
  question_id,
  answer_id,
  data
}: {
  question_id: string | undefined;
  answer_id: string | undefined;
  data: PatchAnswer | undefined;
}): Promise<void> {
  // TODO
  void question_id, answer_id, data;
}

export async function getComments({
  question_id,
  answer_id,
  after_id
}: {
  question_id: string | undefined;
  answer_id?: string | undefined;
  after_id: string | undefined;
}): Promise<PublicComment[]> {
  // TODO
  void question_id, answer_id, after_id;
  return [];
}

export async function createComment({
  question_id,
  answer_id,
  data
}: {
  question_id: string | undefined;
  answer_id?: string | undefined;
  data: NewComment | undefined;
}): Promise<PublicComment> {
  // TODO
  void question_id, answer_id, data;
  return {} as PublicComment;
}

export async function deleteComment({
  question_id,
  answer_id,
  comment_id
}: {
  question_id: string | undefined;
  answer_id?: string | undefined;
  comment_id: string | undefined;
}): Promise<void> {
  // TODO
  void question_id, answer_id, comment_id;
}

export async function applyVotesUpdateOperation({
  question_id,
  answer_id,
  comment_id,
  operation
}: {
  question_id?: string | undefined;
  answer_id?: string | undefined;
  comment_id?: string | undefined;
  operation: Partial<VotesUpdateOperation> | undefined;
}): Promise<void> {
  // TODO
  void question_id, answer_id, comment_id, operation;
}

export async function getUserMessages({
  user_id,
  after_id
}: {
  user_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicMail[]> {
  // TODO
  void user_id, after_id;
  return [];
}

export async function createMessage({
  data
}: {
  data: NewMail | undefined;
}): Promise<PublicMail> {
  // TODO
  void data;
  return {} as PublicMail;
}
