import { MongoServerError, ObjectId } from 'mongodb';
import { toss } from 'toss-expression';

import { getEnv } from 'universe/backend/env';

import {
  addAnswerToDb,
  addCommentToDb,
  patchAnswerInDb,
  patchCommentInDb,
  publicAnswerMap,
  publicAnswerProjection,
  publicCommentMap,
  publicMailProjection,
  publicQuestionProjection,
  publicUserProjection,
  questionStatuses,
  removeAnswerFromDb,
  removeCommentFromDb,
  selectAnswerFromDb,
  selectCommentFromDb,
  selectResultProjection,
  toPublicAnswer,
  toPublicComment,
  toPublicMail,
  toPublicQuestion,
  toPublicUser,
  vacuousProjection,
  voterStatusProjection
} from 'universe/backend/db';

import {
  ClientValidationError,
  ErrorMessage,
  InvalidItemError,
  ItemNotFoundError,
  ValidationError,
  NotAuthorizedError
} from 'universe/error';

import type {
  AnswerId,
  CommentId,
  InternalAnswer,
  InternalComment,
  InternalMail,
  InternalQuestion,
  InternalUser,
  MailId,
  NewAnswer,
  NewComment,
  NewMail,
  NewQuestion,
  NewUser,
  PatchAnswer,
  PatchQuestion,
  PatchUser,
  PointsUpdateOperation,
  PublicAnswer,
  PublicComment,
  PublicMail,
  PublicQuestion,
  PublicUser,
  QuestionId,
  SelectResult,
  UserId,
  Username,
  VoterStatus,
  VoterStatusResult,
  VotesUpdateOperation
} from 'universe/backend/db';

import { isPlainObject } from 'multiverse/is-plain-object';
import { getDb } from 'multiverse/mongo-schema';
import { itemExists, itemToObjectId } from 'multiverse/mongo-item';

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const usernameRegex = /^[a-zA-Z0-9_-]+$/;
const hexadecimalRegex = /^[a-fA-F0-9]+$/;

/**
 * Question properties that can be matched against with `searchQuestions()`
 * matchers. Proxied properties should be listed in their final form.
 */
const matchableStrings = [
  'creator',
  'title-lowercase', // * Proxied from title
  'createdAt',
  'text',
  'status',
  'hasAcceptedAnswer',
  'upvotes',
  'downvotes',
  'answers',
  'views',
  'comments'
];

/**
 * Question properties that can be matched against with `searchQuestions()`
 * regexMatchers. Must be string fields. Proxied properties should be listed in
 * their final form.
 */
const regexMatchableStrings = [
  'creator',
  'title-lowercase', // * Proxied from title
  'text',
  'status'
];

/**
 * Whitelisted MongoDB sub-matchers that can be used with `searchQuestions()`,
 * not including the special "$or" sub-matcher.
 */
const matchableSubStrings = ['$gt', '$lt', '$gte', '$lte'];

/**
 * Whitelisted MongoDB-esque sub-specifiers that can be used with
 * `searchQuestions()` via the "$or" sub-matcher.
 */
type SubSpecifierObject = {
  [subspecifier in '$gt' | '$lt' | '$gte' | '$lte']?: number;
};

/**
 * The shape of a specification used to construct $inc update operations to feed
 * directly to MongoDB. Used for complex updates involving the `sorter.uvc` and
 * `sorter.uvac` fields.
 */
type SorterUpdateAggregationOp = {
  $add: [
    original: string,
    nUpdate: number,
    ...sUpdates: { $subtract: (string | number)[] }[]
  ];
};

/**
 * Validate a vote update operation object for correctness.
 */
function validateVotesUpdateOperation(
  operation: unknown
): asserts operation is VotesUpdateOperation {
  const rawOperation = operation as VotesUpdateOperation;

  if (!rawOperation.op || !['increment', 'decrement'].includes(rawOperation.op)) {
    throw new ValidationError(
      ErrorMessage.InvalidFieldValue('op', rawOperation.op, [
        'increment',
        'decrement'
      ])
    );
  }

  if (
    !rawOperation.target ||
    !['upvotes', 'downvotes'].includes(rawOperation.target)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidFieldValue('target', rawOperation.target, [
        'upvotes',
        'downvotes'
      ])
    );
  }
}

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
  if (!isPlainObject(data)) {
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

/**
 * Validate a new or patch question data object.
 */
function validateQuestionData(
  data: NewQuestion | PatchQuestion | undefined,
  { required }: { required: boolean }
): asserts data is NewQuestion | PatchQuestion {
  if (!isPlainObject(data)) {
    throw new ValidationError(ErrorMessage.InvalidJSON());
  }

  const {
    MAX_QUESTION_TITLE_LENGTH: maxTitleLen,
    MAX_QUESTION_BODY_LENGTH_BYTES: maxBodyLen
  } = getEnv();

  if (
    (required || (!required && data.title !== undefined)) &&
    (typeof data.title != 'string' ||
      data.title.length < 1 ||
      data.title.length > maxTitleLen)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('title', 1, maxTitleLen, 'string')
    );
  }

  if (
    (required || (!required && data.text !== undefined)) &&
    (typeof data.text != 'string' ||
      data.text.length < 1 ||
      data.text.length > maxBodyLen)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
    );
  }
}

/**
 * Validate a new or patch answer data object.
 */
function validateAnswerData(
  data: NewAnswer | PatchAnswer | undefined,
  { required }: { required: boolean }
): asserts data is NewAnswer | PatchAnswer {
  if (!isPlainObject(data)) {
    throw new ValidationError(ErrorMessage.InvalidJSON());
  }

  const { MAX_ANSWER_BODY_LENGTH_BYTES: maxBodyLen } = getEnv();

  if (
    (required || (!required && data.text !== undefined)) &&
    (typeof data.text != 'string' ||
      data.text.length < 1 ||
      data.text.length > maxBodyLen)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
    );
  }
}

export async function getAllUsers({
  after_id
}: {
  after_id: string | undefined;
}): Promise<PublicUser[]> {
  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const afterId = after_id ? itemToObjectId<UserId>(after_id) : undefined;

  if (afterId && !(await itemExists(userDb, afterId))) {
    throw new ItemNotFoundError(after_id, 'user_id');
  }

  return userDb
    .find<PublicUser>(afterId ? { _id: { $lt: afterId } } : {}, {
      projection: publicUserProjection,
      limit: getEnv().RESULTS_PER_PAGE,
      sort: { _id: -1 }
    })
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
  const userDb = db.collection<InternalUser>('users');

  return (
    (await userDb
      .find<PublicUser>({ username }, { projection: publicUserProjection })
      .next()) || toss(new ItemNotFoundError(username, 'user'))
  );
}

export async function getUserQuestions({
  username,
  after_id
}: {
  username: string | undefined;
  after_id: string | undefined;
}): Promise<PublicQuestion[]> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const afterId = after_id ? itemToObjectId<QuestionId>(after_id) : undefined;
  const questionDb = db.collection<InternalQuestion>('questions');

  const { questionIds } =
    (await userDb
      .find<{ questionIds: InternalUser['questionIds'] }>(
        { username },
        { projection: { questionIds: true } }
      )
      .next()) || toss(new ItemNotFoundError(username, 'user'));

  let offset: number | null = null;

  if (afterId) {
    const afterIdIndex = questionIds.findIndex((q) => q.equals(afterId));

    if (afterIdIndex < 0) {
      throw new ItemNotFoundError(afterId, 'question_id');
    }

    offset = afterIdIndex;
  }

  return questionDb
    .find<PublicQuestion>(
      {
        _id: {
          $in:
            offset !== null
              ? questionIds.slice(-getEnv().RESULTS_PER_PAGE + offset, offset)
              : questionIds.slice(-getEnv().RESULTS_PER_PAGE)
        }
      },
      { projection: publicQuestionProjection, sort: { _id: -1 } }
    )
    .toArray();
}

export async function getUserAnswers({
  username,
  after_id
}: {
  username: string | undefined;
  after_id: string | undefined;
}): Promise<PublicAnswer[]> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const afterId = after_id ? itemToObjectId<AnswerId>(after_id) : undefined;

  const { answerIds: answerIdTuples } =
    (await userDb
      .find<{ answerIds: InternalUser['answerIds'] }>(
        { username },
        { projection: { answerIds: true } }
      )
      .next()) || toss(new ItemNotFoundError(username, 'user'));

  let offset: number | null = null;

  if (afterId) {
    const afterIdIndex = answerIdTuples.findIndex(([, a]) => a.equals(afterId));

    if (afterIdIndex < 0) {
      throw new ItemNotFoundError(afterId, 'answer_id');
    }

    offset = afterIdIndex;
  }

  const targetIdTuples =
    offset !== null
      ? answerIdTuples.slice(-getEnv().RESULTS_PER_PAGE + offset, offset)
      : answerIdTuples.slice(-getEnv().RESULTS_PER_PAGE);

  return (
    await Promise.all(
      targetIdTuples.map(async ([question_id, answer_id]) => {
        return selectAnswerFromDb<PublicAnswer>({
          question_id,
          answer_id,
          projection: publicAnswerProjection
        });
      })
    )
  ).sort((a, b) => b.createdAt - a.createdAt);
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
        MAX_USER_NAME_LENGTH,
        'alphanumeric'
      )
    );
  }

  const { email, username, key, salt, ...rest } = data as Required<NewUser>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');

  const newUser = {
    _id: new ObjectId(),
    username,
    email,
    salt: salt.toLowerCase(),
    key: key.toLowerCase(),
    points: 1,
    answerIds: [],
    questionIds: []
  };

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...
  try {
    await userDb.insertOne(newUser);
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

  return toPublicUser(newUser);
}

export async function updateUser({
  username,
  data
}: {
  username: Username | undefined;
  data: PatchUser | undefined;
}): Promise<void> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  // ? Optimization
  if (data && !Object.keys(data).length) return;

  validateUserData(data, { required: false });

  const { email, key, salt, points, ...rest } = data as Required<PatchUser>;
  const restKeys = Object.keys(rest);
  let pointsUpdateOp: PointsUpdateOperation | null = null;

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (points !== undefined) {
    if (isPlainObject(points)) {
      if (typeof points.amount != 'number' || points.amount < 0) {
        throw new ValidationError(
          ErrorMessage.InvalidNumberValue('points.amount', 0, null, 'integer')
        );
      } else if (!['increment', 'decrement'].includes(points.op)) {
        throw new ValidationError(
          ErrorMessage.InvalidFieldValue('points.operation', 'decrement', [
            'increment',
            'decrement'
          ])
        );
      }

      const { amount: _, op: __, ...restOp } = points;
      const restOpKeys = Object.keys(restOp);

      if (restOpKeys.length != 0) {
        throw new ValidationError(ErrorMessage.UnknownField(restOpKeys[0]));
      }

      pointsUpdateOp = points;
    } else if (typeof points != 'number' || points < 0) {
      throw new ValidationError(
        ErrorMessage.InvalidNumberValue('points', 0, null, 'integer')
      );
    }
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...
  try {
    const result = await userDb.updateOne(
      { username },
      {
        $set: {
          ...(email ? { email } : {}),
          ...(salt ? { salt: salt.toLowerCase() } : {}),
          ...(key ? { key: key.toLowerCase() } : {}),
          ...(typeof points == 'number' ? { points } : {})
        },
        ...(pointsUpdateOp
          ? {
              $inc: {
                points:
                  pointsUpdateOp.op == 'decrement'
                    ? -pointsUpdateOp.amount
                    : pointsUpdateOp.amount
              }
            }
          : {})
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
  const userDb = db.collection<InternalUser>('users');
  const result = await userDb.deleteOne({ username });

  if (!result.deletedCount) {
    throw new ItemNotFoundError(username, 'user');
  }
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
  const userDb = db.collection<InternalUser>('users');

  return !!(await userDb.countDocuments({ username, key }));
}

export async function getUserMessages({
  username,
  after_id
}: {
  username: string | undefined;
  after_id: string | undefined;
}): Promise<PublicMail[]> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const mailDb = db.collection<InternalMail>('mail');
  const afterId = after_id ? itemToObjectId<MailId>(after_id) : undefined;

  if (!(await itemExists(userDb, { key: 'username', id: username }))) {
    throw new ItemNotFoundError(username, 'user');
  }

  if (afterId && !(await itemExists(mailDb, afterId))) {
    throw new ItemNotFoundError(after_id, 'mail_id');
  }

  return mailDb
    .find<PublicMail>(
      {
        ...(afterId ? { _id: { $lt: afterId } } : {}),
        receiver: username
      },
      {
        sort: { _id: -1 },
        limit: getEnv().RESULTS_PER_PAGE,
        projection: publicMailProjection
      }
    )
    .toArray();
}

export async function createMessage({
  data
}: {
  data: NewMail | undefined;
}): Promise<PublicMail> {
  if (!isPlainObject(data)) {
    throw new ValidationError(ErrorMessage.InvalidJSON());
  }

  const { sender, receiver, subject, text, ...rest } = data as Required<NewMail>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (!receiver) {
    throw new ValidationError(ErrorMessage.InvalidFieldValue('receiver'));
  }

  if (!sender) {
    throw new ValidationError(ErrorMessage.InvalidFieldValue('sender'));
  }

  const {
    MAX_MAIL_SUBJECT_LENGTH: maxSubjectLen,
    MAX_MAIL_BODY_LENGTH_BYTES: maxBodyLen
  } = getEnv();

  if (typeof subject != 'string' || !subject || subject.length > maxSubjectLen) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('subject', 1, maxSubjectLen, 'string')
    );
  }

  if (typeof text != 'string' || !text || text.length > maxBodyLen) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('text', 1, maxBodyLen, 'string')
    );
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const mailDb = db.collection<InternalMail>('mail');
  const userDb = db.collection<InternalUser>('users');

  if (!(await itemExists(userDb, { key: 'username', id: receiver }))) {
    throw new ItemNotFoundError(receiver, 'user');
  }

  if (!(await itemExists(userDb, { key: 'username', id: sender }))) {
    throw new ItemNotFoundError(sender, 'user');
  }

  const newMail: InternalMail = {
    _id: new ObjectId(),
    createdAt: Date.now(),
    sender,
    receiver,
    subject,
    text
  };

  // * At this point, we can finally trust this data is valid and not malicious
  await mailDb.insertOne(newMail);

  return toPublicMail(newMail);
}

export async function deleteMessage({
  mail_id
}: {
  mail_id: string | undefined;
}): Promise<void> {
  if (!mail_id) {
    throw new InvalidItemError('mail_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const mailDb = db.collection<InternalMail>('mail');
  const result = await mailDb.deleteOne({ _id: itemToObjectId(mail_id) });

  if (!result.deletedCount) {
    throw new ItemNotFoundError(mail_id, 'mail message');
  }
}

export async function searchQuestions({
  after_id,
  match,
  regexMatch,
  sort
}: {
  after_id: string | undefined;
  match: {
    [specifier: string]:
      | string
      | number
      | boolean
      | SubSpecifierObject
      | { $or: SubSpecifierObject[] };
  };
  regexMatch: {
    [specifier: string]: string;
  };
  sort: string | undefined;
}): Promise<PublicQuestion[]> {
  // ? Validate sort parameter
  if (
    sort !== undefined &&
    (typeof sort != 'string' || !['u', 'uvc', 'uvac'].includes(sort))
  ) {
    throw new ValidationError(ErrorMessage.InvalidItem('nope', 'sort parameter'));
  }

  const { RESULTS_PER_PAGE } = getEnv();
  const afterId = after_id ? itemToObjectId<QuestionId>(after_id) : undefined;

  // ? Initial matcher validation
  if (!isPlainObject(match)) {
    throw new ValidationError(ErrorMessage.InvalidMatcher('match'));
  } else if (!isPlainObject(regexMatch)) {
    throw new ValidationError(ErrorMessage.InvalidMatcher('regexMatch'));
  }

  // ? Handle aliasing/proxying
  [regexMatch, match].forEach((matchSpec) => {
    if (typeof matchSpec.title == 'string') {
      matchSpec['title-lowercase'] = matchSpec.title.toLowerCase();
      delete matchSpec.title;
    }
  });

  // ? Validate username and after_id

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');

  if (afterId && !(await itemExists(questionDb, afterId))) {
    throw new ItemNotFoundError(after_id, 'question_id');
  }

  // ? Validate the match object
  for (const [key, val] of Object.entries(match)) {
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

  // ? Validate the regexMatch object
  for (const [key, val] of Object.entries(regexMatch)) {
    if (!regexMatchableStrings.includes(key)) {
      throw new ValidationError(ErrorMessage.UnknownSpecifier(key));
    }

    if (!val || typeof val != 'string') {
      throw new ValidationError(ErrorMessage.InvalidRegexString(key));
    }
  }

  // ? Construct aggregation primitives

  const finalRegexMatch = Object.entries(regexMatch).reduce((obj, [spec, val]) => {
    obj[spec] = { $regex: val, $options: 'mi' };
    return obj;
  }, {} as Record<string, unknown>);

  const orMatcher: { [key: string]: SubSpecifierObject }[] = [];

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
    ...(orMatcher.length ? { $or: orMatcher } : {}),
    ...finalRegexMatch
  };

  const pipeline = [
    { $match },
    {
      $sort:
        sort === undefined
          ? { _id: -1 }
          : sort == 'u'
          ? { upvotes: -1 }
          : sort == 'uvc'
          ? { 'sorter.uvc': -1 }
          : { 'sorter.uvac': -1 }
    },
    { $limit: RESULTS_PER_PAGE },
    { $project: publicQuestionProjection }
  ];

  // ? Run the aggregation and return the result
  return db.collection('questions').aggregate<PublicQuestion>(pipeline).toArray();
}

export async function getQuestion({
  question_id
}: {
  question_id: string | undefined;
}): Promise<PublicQuestion> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');

  return (
    (await questionDb
      .find<PublicQuestion>(
        { _id: itemToObjectId<QuestionId>(question_id) },
        { projection: publicQuestionProjection }
      )
      .next()) || toss(new ItemNotFoundError(question_id, 'question'))
  );
}

export async function createQuestion({
  data
}: {
  data: NewQuestion | undefined;
}): Promise<PublicQuestion> {
  validateQuestionData(data, { required: true });

  const { creator, title, text, ...rest } = data as Required<NewQuestion>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (!creator) {
    throw new ValidationError(ErrorMessage.InvalidFieldValue('creator'));
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionDb = db.collection<InternalQuestion>('questions');

  if (!(await itemExists(userDb, { key: 'username', id: creator }))) {
    throw new ItemNotFoundError(creator, 'user');
  }

  const newQuestion: InternalQuestion = {
    _id: new ObjectId(),
    creator,
    title,
    'title-lowercase': title.toLowerCase(),
    createdAt: Date.now(),
    text,
    status: 'open',
    hasAcceptedAnswer: false,
    upvotes: 0,
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: [],
    answers: 0,
    answerItems: [],
    views: 0,
    comments: 0,
    commentItems: [],
    sorter: { uvc: 0, uvac: 0 }
  };

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...

  await questionDb.insertOne(newQuestion);

  await userDb.updateOne(
    { username: creator },
    { $push: { questionIds: newQuestion._id } }
  );

  return toPublicQuestion(newQuestion);
}

export async function updateQuestion({
  question_id,
  data
}: {
  question_id: string | undefined;
  data: PatchQuestion | undefined;
}): Promise<void> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  // ? Optimization
  if (data && !Object.keys(data).length) return;

  validateQuestionData(data, { required: false });

  const { title, text, status, upvotes, downvotes, views, ...rest } =
    data as Required<PatchQuestion>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (status !== undefined && !questionStatuses.includes(status)) {
    throw new ValidationError(
      ErrorMessage.InvalidFieldValue('status', undefined, questionStatuses)
    );
  }

  if (upvotes !== undefined && (typeof upvotes != 'number' || upvotes < 0)) {
    throw new ValidationError(
      ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
    );
  }

  if (downvotes !== undefined && (typeof downvotes != 'number' || downvotes < 0)) {
    throw new ValidationError(
      ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
    );
  }

  if (
    views !== undefined &&
    views !== 'increment' &&
    (typeof views != 'number' || views < 0)
  ) {
    throw new ValidationError(
      ErrorMessage.InvalidNumberValue('views', 0, null, 'integer')
    );
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...

  const incrementor: {
    upvotes?: number;
    views?: number | SorterUpdateAggregationOp;
    'sorter.uvc'?: SorterUpdateAggregationOp;
    'sorter.uvac'?: SorterUpdateAggregationOp;
  } = {};

  if (views !== undefined || upvotes !== undefined) {
    Object.assign(incrementor, {
      'sorter.uvc': { $add: ['$$ROOT.sorter.uvc', 0] },
      'sorter.uvac': { $add: ['$$ROOT.sorter.uvac', 0] }
    });

    if (views === 'increment') {
      incrementor.views = { $add: ['$$ROOT.views', 1] };
      incrementor['sorter.uvc']!.$add[1]++;
      incrementor['sorter.uvac']!.$add[1]++;
    } else if (typeof views == 'number') {
      incrementor.views = views;

      incrementor['sorter.uvc']!.$add.push({
        $subtract: [views, '$$ROOT.views']
      });

      incrementor['sorter.uvac']!.$add.push({
        $subtract: [views, '$$ROOT.views']
      });
    }

    if (typeof upvotes == 'number') {
      incrementor.upvotes = upvotes;

      incrementor['sorter.uvc']!.$add.push({
        $subtract: [upvotes, '$$ROOT.upvotes']
      });

      incrementor['sorter.uvac']!.$add.push({
        $subtract: [upvotes, '$$ROOT.upvotes']
      });
    }
  }

  const result = await questionDb.updateOne(
    { _id: itemToObjectId<QuestionId>(question_id) },
    [
      {
        $set: {
          ...(title ? { title, 'title-lowercase': title.toLowerCase() } : {}),
          ...(text ? { text } : {}),
          ...(status ? { status } : {}),
          ...(typeof downvotes == 'number' ? { downvotes } : {}),
          ...incrementor
        }
      }
    ]
  );

  if (!result.matchedCount) {
    throw new ItemNotFoundError(question_id, 'question');
  }
}

export async function deleteQuestion({
  question_id
}: {
  question_id: string | undefined;
}): Promise<void> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionDb = db.collection<InternalQuestion>('questions');
  const questionId = itemToObjectId<QuestionId>(question_id);

  const { value: deletedQuestion } = await questionDb.findOneAndDelete(
    { _id: questionId },
    { projection: { creator: true } }
  );

  if (!deletedQuestion) {
    throw new ItemNotFoundError(questionId, 'question');
  }

  await userDb.updateOne(
    { username: deletedQuestion.creator },
    { $pull: { questionIds: questionId } }
  );

  await userDb.updateMany(
    { answerIds: { $elemMatch: { $elemMatch: { $in: [questionId] } } } },
    // @ts-expect-error: work around MongoDB driver bug
    { $pull: { answerIds: { $in: [questionId] } } }
  );
}

export async function getAnswers({
  question_id,
  after_id
}: {
  question_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicAnswer[]> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  const afterId = after_id ? itemToObjectId<AnswerId>(after_id) : undefined;
  const questionId = itemToObjectId<QuestionId>(question_id);

  // ? Ensure after_id exists
  if (afterId) {
    try {
      void (await selectAnswerFromDb({
        question_id: questionId,
        answer_id: afterId,
        projection: vacuousProjection
      }));
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(afterId, 'answer_id');
      }

      throw e;
    }
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');

  const pipeline = [
    { $match: { _id: questionId } },
    {
      $project: {
        answers: {
          $map: {
            input: {
              $slice: [
                afterId
                  ? {
                      $filter: {
                        input: '$answerItems',
                        as: 'this',
                        cond: { $gt: ['$$this._id', afterId] }
                      }
                    }
                  : '$answerItems',
                getEnv().RESULTS_PER_PAGE
              ]
            },
            as: 'answer',
            in: publicAnswerMap('answer')
          }
        }
      }
    }
  ];

  const { answers } =
    (await questionDb.aggregate<{ answers: PublicAnswer[] }>(pipeline).next()) ||
    toss(new ItemNotFoundError(question_id, 'question'));

  return answers;
}

export async function createAnswer({
  question_id,
  data
}: {
  question_id: string | undefined;
  data: NewAnswer | undefined;
}): Promise<PublicAnswer> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  validateAnswerData(data, { required: true });

  const { creator, text, ...rest } = data as Required<NewAnswer>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (!creator) {
    throw new ValidationError(ErrorMessage.InvalidFieldValue('creator'));
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionId = itemToObjectId<QuestionId>(question_id);

  if (!(await itemExists(userDb, { key: 'username', id: creator }))) {
    throw new ItemNotFoundError(creator, 'user');
  }

  try {
    if (
      await selectAnswerFromDb({
        question_id: questionId,
        answer_creator: creator,
        projection: vacuousProjection
      })
    ) {
      throw new ClientValidationError(ErrorMessage.UserAlreadyAnswered());
    }
  } catch (e) {
    if (e instanceof ClientValidationError) {
      throw e;
    }
  }

  const newAnswer: InternalAnswer = {
    _id: new ObjectId(),
    creator,
    createdAt: Date.now(),
    text,
    accepted: false,
    upvotes: 0,
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: [],
    commentItems: []
  };

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...

  const result = await addAnswerToDb({ question_id: questionId, answer: newAnswer });

  if (!result.matchedCount) {
    throw new ItemNotFoundError(question_id, 'question');
  }

  await userDb.updateOne(
    { username: creator },
    { $push: { answerIds: [questionId, newAnswer._id] } }
  );

  return toPublicAnswer(newAnswer);
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
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  if (!answer_id) {
    throw new InvalidItemError('answer_id', 'parameter');
  }

  // ? Optimization
  if (data && !Object.keys(data).length) return;

  validateAnswerData(data, { required: false });

  const { text, accepted, upvotes, downvotes, ...rest } =
    data as Required<PatchAnswer>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (accepted !== undefined && !accepted) {
    throw new ValidationError(
      ErrorMessage.InvalidFieldValue('accepted', undefined, ['true'])
    );
  }

  if (upvotes !== undefined && (typeof upvotes != 'number' || upvotes < 0)) {
    throw new ValidationError(
      ErrorMessage.InvalidNumberValue('upvotes', 0, null, 'integer')
    );
  }

  if (downvotes !== undefined && (typeof downvotes != 'number' || downvotes < 0)) {
    throw new ValidationError(
      ErrorMessage.InvalidNumberValue('downvotes', 0, null, 'integer')
    );
  }

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');
  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = itemToObjectId<AnswerId>(answer_id);

  if (
    accepted &&
    (await questionDb.countDocuments({ _id: questionId, hasAcceptedAnswer: true })) !=
      0
  ) {
    throw new ClientValidationError(ErrorMessage.QuestionAlreadyAcceptedAnswer());
  }

  try {
    void (await selectAnswerFromDb({
      question_id: questionId,
      answer_id: answerId,
      projection: vacuousProjection
    }));
  } catch (e) {
    if (e instanceof MongoServerError) {
      throw new ItemNotFoundError(answerId, 'answer');
    }

    throw e;
  }

  const result = await patchAnswerInDb({
    question_id: questionId,
    answer_id: answerId,
    updateOps: {
      $set: {
        ...(text ? { text } : {}),
        ...(accepted ? { accepted } : {}),
        ...(typeof upvotes == 'number' ? { upvotes } : {}),
        ...(typeof downvotes == 'number' ? { downvotes } : {})
      }
    }
  });

  if (!result.matchedCount) {
    throw new ItemNotFoundError(question_id, 'question');
  }

  if (accepted) {
    await questionDb.updateOne(
      { _id: questionId },
      { $set: { hasAcceptedAnswer: true } }
    );
  }
}

export async function deleteAnswer({
  question_id,
  answer_id
}: {
  question_id: string | undefined;
  answer_id: string | undefined;
}): Promise<void> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  if (!answer_id) {
    throw new InvalidItemError('answer_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = itemToObjectId<AnswerId>(answer_id);

  const { creator } = await (async () => {
    try {
      const result = await selectAnswerFromDb<{ creator: Username } | null>({
        question_id: questionId,
        answer_id: answerId,
        projection: { creator: true }
      });

      return result || { creator: null };
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  })();

  if (!creator) {
    throw new ItemNotFoundError(question_id, 'question');
  }

  await removeAnswerFromDb({
    question_id: questionId,
    answer_id: answerId
  });

  await userDb.updateOne(
    { username: creator },
    { $pull: { answerIds: [questionId, answerId] } }
  );
}

export async function getComments({
  question_id,
  answer_id,
  after_id
}: {
  question_id: string | undefined;
  answer_id: string | undefined;
  after_id: string | undefined;
}): Promise<PublicComment[]> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const questionDb = db.collection<InternalQuestion>('questions');
  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = answer_id ? itemToObjectId<AnswerId>(answer_id) : undefined;
  const afterId = after_id ? itemToObjectId<AnswerId>(after_id) : undefined;

  if (answerId) {
    try {
      void (await selectAnswerFromDb({
        question_id: questionId,
        answer_id: answerId,
        projection: vacuousProjection
      }));
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  }

  // ? Ensure after_id exists
  if (afterId) {
    try {
      await selectCommentFromDb({
        question_id: questionId,
        answer_id: answerId,
        comment_id: afterId,
        projection: vacuousProjection
      });
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(afterId, 'comment_id');
      }

      throw e;
    }
  }

  const pipeline = [
    { $match: { _id: questionId } },
    ...(answerId
      ? [
          {
            $project: {
              answer: {
                $first: {
                  $filter: {
                    input: '$answerItems',
                    as: 'answer',
                    cond: { $eq: ['$$answer._id', answerId] }
                  }
                }
              }
            }
          },
          {
            $replaceWith: '$answer'
          }
        ]
      : []),
    {
      $project: {
        comments: {
          $map: {
            input: {
              $slice: [
                afterId
                  ? {
                      $filter: {
                        input: '$commentItems',
                        as: 'this',
                        cond: { $gt: ['$$this._id', afterId] }
                      }
                    }
                  : '$commentItems',
                getEnv().RESULTS_PER_PAGE
              ]
            },
            as: 'comment',
            in: publicCommentMap('comment')
          }
        }
      }
    }
  ];

  const { comments } =
    (await questionDb.aggregate<{ comments: PublicComment[] }>(pipeline).next()) ||
    toss(new ItemNotFoundError(question_id, 'question'));

  return comments;
}

export async function createComment({
  question_id,
  answer_id,
  data
}: {
  question_id: string | undefined;
  answer_id: string | undefined;
  data: NewComment | undefined;
}): Promise<PublicComment> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  if (!isPlainObject(data)) {
    throw new ValidationError(ErrorMessage.InvalidJSON());
  }

  const { creator, text, ...rest } = data as Required<NewComment>;
  const restKeys = Object.keys(rest);

  if (restKeys.length != 0) {
    throw new ValidationError(ErrorMessage.UnknownField(restKeys[0]));
  }

  if (!creator) {
    throw new ValidationError(ErrorMessage.InvalidFieldValue('creator'));
  }

  const { MAX_COMMENT_LENGTH: maxTextLen } = getEnv();

  if (typeof text != 'string' || !text || text.length > maxTextLen) {
    throw new ValidationError(
      ErrorMessage.InvalidStringLength('text', 1, maxTextLen, 'string')
    );
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionDb = db.collection<InternalQuestion>('questions');
  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = answer_id ? itemToObjectId<AnswerId>(answer_id) : undefined;

  if (!(await itemExists(userDb, { key: 'username', id: creator }))) {
    throw new ItemNotFoundError(creator, 'user');
  }

  if ((await questionDb.countDocuments({ _id: questionId })) == 0) {
    throw new ItemNotFoundError(questionId, 'question');
  }

  if (answerId) {
    try {
      await selectAnswerFromDb({
        question_id: questionId,
        answer_id: answerId,
        projection: vacuousProjection
      });
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  }

  const newComment: InternalComment = {
    _id: new ObjectId(),
    creator,
    createdAt: Date.now(),
    text,
    upvotes: 0,
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: []
  };

  // * At this point, we can finally trust this data is not malicious, but not
  // * necessarily valid...

  const result = await addCommentToDb({
    question_id: questionId,
    ...(answerId ? { answer_id: answerId } : {}),
    comment: newComment
  });

  if (!result.matchedCount) {
    throw new ItemNotFoundError(question_id, 'question');
  }

  return toPublicComment(newComment);
}

export async function deleteComment({
  question_id,
  answer_id,
  comment_id
}: {
  question_id: string | undefined;
  answer_id: string | undefined;
  comment_id: string | undefined;
}): Promise<void> {
  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  if (!comment_id) {
    throw new InvalidItemError('comment_id', 'parameter');
  }

  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = answer_id ? itemToObjectId<AnswerId>(answer_id) : undefined;
  const commentId = itemToObjectId<CommentId>(comment_id);

  if (answerId) {
    try {
      void (await selectAnswerFromDb({
        question_id: questionId,
        answer_id: answerId,
        projection: vacuousProjection
      }));
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  }

  try {
    void (await selectCommentFromDb({
      question_id: questionId,
      answer_id: answerId,
      comment_id: commentId,
      projection: vacuousProjection
    }));
  } catch (e) {
    if (e instanceof MongoServerError) {
      throw new ItemNotFoundError(commentId, 'comment');
    }

    throw e;
  }

  const result = await removeCommentFromDb({
    question_id: questionId,
    answer_id: answerId,
    comment_id: commentId
  });

  if (!result.matchedCount) {
    throw new ItemNotFoundError(question_id, 'question');
  }
}

export async function getHowUserVoted({
  username,
  question_id,
  answer_id,
  comment_id
}: {
  username: string | undefined;
  question_id: string | undefined;
  answer_id: string | undefined;
  comment_id: string | undefined;
}): Promise<VoterStatus> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionDb = db.collection<InternalQuestion>('questions');

  if (!(await itemExists(userDb, { key: 'username', id: username }))) {
    throw new ItemNotFoundError(username, 'user');
  }

  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = answer_id ? itemToObjectId<AnswerId>(answer_id) : undefined;
  const commentId = comment_id ? itemToObjectId<AnswerId>(comment_id) : undefined;

  if (answerId) {
    try {
      const result = await selectAnswerFromDb<VoterStatusResult>({
        question_id: questionId,
        answer_id: answerId,
        // ? If we're interested in a comment, only do an existence check
        projection: commentId ? vacuousProjection : voterStatusProjection(username)
      });

      if (!result) {
        throw new ItemNotFoundError(questionId, 'question');
      }

      if (!commentId) {
        return result.voterStatus;
      }
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  }

  if (commentId) {
    try {
      const result = await selectCommentFromDb<VoterStatusResult>({
        question_id: questionId,
        answer_id: answerId,
        comment_id: commentId,
        projection: voterStatusProjection(username)
      });

      if (!result) {
        throw new ItemNotFoundError(questionId, 'question');
      }

      return result.voterStatus;
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(commentId, 'comment');
      }

      throw e;
    }
  }

  // ? If we've come this far, then we must only be interested in a question!

  const result = await questionDb.findOne<VoterStatusResult>(
    { _id: questionId },
    { projection: voterStatusProjection(username) }
  );

  if (!result) {
    throw new ItemNotFoundError(questionId, 'question');
  }

  return result.voterStatus;
}

export async function applyVotesUpdateOperation({
  username,
  question_id,
  answer_id,
  comment_id,
  operation
}: {
  username: string | undefined;
  question_id: string | undefined;
  answer_id: string | undefined;
  comment_id: string | undefined;
  operation: Partial<VotesUpdateOperation> | undefined;
}): Promise<void> {
  if (!username) {
    throw new InvalidItemError('username', 'parameter');
  }

  if (!question_id) {
    throw new InvalidItemError('question_id', 'parameter');
  }

  if (!operation) {
    throw new InvalidItemError('operation', 'parameter');
  }

  validateVotesUpdateOperation(operation);

  const db = await getDb({ name: 'hscc-api-qoverflow' });
  const userDb = db.collection<InternalUser>('users');
  const questionDb = db.collection<InternalQuestion>('questions');

  if (!(await itemExists(userDb, { key: 'username', id: username }))) {
    throw new ItemNotFoundError(username, 'user');
  }

  const questionId = itemToObjectId<QuestionId>(question_id);
  const answerId = answer_id ? itemToObjectId<AnswerId>(answer_id) : undefined;
  const commentId = comment_id ? itemToObjectId<AnswerId>(comment_id) : undefined;

  const validateOperationAuthorization = (
    selectResult: SelectResult,
    { skip }: { skip: boolean }
  ) => {
    if (!selectResult) {
      throw new ItemNotFoundError(questionId, 'question');
    }

    if (!skip) {
      if (selectResult.isCreator) {
        throw new NotAuthorizedError(ErrorMessage.IllegalOperation());
      }

      if (selectResult.voterStatus !== null) {
        if (operation.op == 'increment') {
          if (
            (operation.target == 'upvotes' &&
              selectResult.voterStatus == 'upvoted') ||
            (operation.target == 'downvotes' &&
              selectResult.voterStatus == 'downvoted')
          ) {
            throw new NotAuthorizedError(ErrorMessage.DuplicateIncrementOperation());
          }

          throw new NotAuthorizedError(ErrorMessage.MultipleIncrementTargets());
        }

        if (operation.op == 'decrement') {
          if (
            !(
              (operation.target == 'upvotes' &&
                selectResult.voterStatus == 'upvoted') ||
              (operation.target == 'downvotes' &&
                selectResult.voterStatus == 'downvoted')
            )
          ) {
            throw new NotAuthorizedError(ErrorMessage.InvalidDecrementOperation());
          }
        }
      } else if (operation.op == 'decrement') {
        throw new NotAuthorizedError(ErrorMessage.InvalidDecrementOperation());
      }
    }
  };

  const calculateUpdateOps = ({ includeSorter }: { includeSorter: boolean }) => {
    const { op, target } = operation;
    const delta = op == 'increment' ? 1 : -1;

    return {
      $inc: {
        [target]: delta,
        ...(includeSorter && target == 'upvotes'
          ? { 'sorter.uvc': delta, 'sorter.uvac': delta }
          : {})
      },
      [op == 'increment' ? '$push' : '$pull']: {
        [`${target.slice(0, -1)}rUsernames`]: username
      }
    };
  };

  // ? Ensure answer_id is legit
  if (answerId) {
    try {
      const result = await selectAnswerFromDb<SelectResult>({
        question_id: questionId,
        answer_id: answerId,
        projection: selectResultProjection(username)
      });

      validateOperationAuthorization(result, {
        // ? If we're actually interested in a comment, defer authorization
        skip: !!commentId
      });

      if (!commentId) {
        return void (await patchAnswerInDb({
          question_id: questionId,
          answer_id: answerId,
          updateOps: calculateUpdateOps({ includeSorter: false })
        }));
      }
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(answerId, 'answer');
      }

      throw e;
    }
  }

  // ? Ensure comment_id is legit
  if (commentId) {
    try {
      const result = await selectCommentFromDb<SelectResult>({
        question_id: questionId,
        answer_id: answerId,
        comment_id: commentId,
        projection: selectResultProjection(username)
      });

      validateOperationAuthorization(result, { skip: false });

      return void (await patchCommentInDb({
        question_id: questionId,
        answer_id: answerId,
        comment_id: commentId,
        updateOps: calculateUpdateOps({ includeSorter: false })
      }));
    } catch (e) {
      if (e instanceof MongoServerError) {
        throw new ItemNotFoundError(commentId, 'comment');
      }

      throw e;
    }
  }

  // ? If we've come this far, then we must only be interested in a question!
  const result = await questionDb.findOne<SelectResult>(
    { _id: questionId },
    { projection: selectResultProjection(username) }
  );

  validateOperationAuthorization(result, { skip: false });

  await questionDb.updateOne(
    { _id: questionId },
    calculateUpdateOps({ includeSorter: true })
  );
}
