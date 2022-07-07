import { getCommonSchemaConfig } from 'multiverse/mongo-common';

import type { Document, ObjectId, WithId, WithoutId } from 'mongodb';
import type { UnixEpochMs } from '@xunnamius/types';
import { DbSchema, getDb } from 'multiverse/mongo-schema';
import { GuruMeditationError } from 'named-app-errors';

/**
 * A generic projection specification.
 */
type Projection = { [key in keyof InternalAnswer]?: unknown } & Document;

/**
 * A JSON representation of the backend Mongo database structure. This is used
 * for consistent app-wide db access across projects and to generate transient
 * versions of the db during testing.
 */
export function getSchemaConfig(): DbSchema {
  return getCommonSchemaConfig({
    databases: {
      'hscc-api-qoverflow': {
        collections: [
          {
            name: 'users',
            // ? Collation allows for case-insensitive searching. See:
            // ? https://stackoverflow.com/a/40914924/1367414
            createOptions: { collation: { locale: 'en', strength: 2 } },
            indices: [
              { spec: 'key' },
              {
                spec: 'username',
                options: { unique: true }
              },
              {
                spec: 'email',
                options: { unique: true }
              }
            ]
          },
          {
            name: 'mail',
            indices: [{ spec: 'sender' }, { spec: 'receiver' }]
          },
          {
            name: 'questions',
            indices: [
              { spec: 'creator' },
              { spec: 'title-lowercase' },
              { spec: 'createdAt' },
              { spec: 'status' },
              { spec: 'upvotes' },
              { spec: 'upvoterUsernames' },
              { spec: 'downvotes' },
              { spec: 'downvoterUsernames' },
              { spec: 'answers' },
              { spec: 'answerItems._id' },
              { spec: 'answerItems.upvoterUsernames' },
              { spec: 'answerItems.downvoterUsernames' },
              { spec: 'answerItems.commentItems._id' },
              { spec: 'answerItems.commentItems.upvoterUsernames' },
              { spec: 'answerItems.commentItems.downvoterUsernames' },
              { spec: 'comments' },
              { spec: 'commentItems._id' },
              { spec: 'commentItems.upvoterUsernames' },
              { spec: 'commentItems.downvoterUsernames' },
              { spec: 'views' },
              { spec: 'sorter.uvc' },
              { spec: 'sorter.uvac' }
            ]
          }
        ]
      }
    },
    aliases: {}
  });
}

export type Username = string;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UserId extends ObjectId {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MailId extends ObjectId {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QuestionId extends ObjectId {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AnswerId extends ObjectId {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CommentId extends ObjectId {}

/**
 * The shape of an update operation on a question's views total.
 */
export type ViewsUpdateOperation = 'increment';

/**
 * The shape of an update operation on a question or comment's
 * upvotes/downvotes.
 */
export type VotesUpdateOperation = {
  op: 'increment' | 'decrement';
  target: 'upvotes' | 'downvotes';
};

/**
 * The shape of an update operation on a user's points total.
 */
export type PointsUpdateOperation = {
  op: 'increment' | 'decrement';
  amount: number;
};

/**
 * The shape of an internal application user.
 */
export type InternalUser = WithId<{
  username: Username;
  salt: string;
  email: string;
  key: string;
  points: number;
  questionIds: QuestionId[];
  answerIds: [question_id: QuestionId, answer_id: AnswerId][];
}>;

/**
 * The shape of a public application user.
 */
export type PublicUser = Omit<
  WithoutId<InternalUser>,
  'key' | 'questionIds' | 'answerIds'
> & {
  user_id: string;
  questions: number;
  answers: number;
};

/**
 * The shape of a new application user.
 */
export type NewUser = Partial<
  Omit<WithoutId<InternalUser>, 'points' | 'questionIds' | 'answerIds'>
>;

/**
 * The shape of a patch application user.
 */
export type PatchUser = Partial<
  Omit<
    WithoutId<InternalUser>,
    'username' | 'questionIds' | 'answerIds' | 'points'
  > & { points: InternalUser['points'] | PointsUpdateOperation }
>;

/**
 * The shape of internal mail.
 */
export type InternalMail = WithId<{
  sender: Username;
  receiver: Username;
  createdAt: UnixEpochMs;
  subject: string;
  text: string;
}>;

/**
 * The shape of public mail.
 */
export type PublicMail = WithoutId<InternalMail> & {
  mail_id: string;
};

/**
 * The shape of new mail.
 */
export type NewMail = Partial<Omit<WithoutId<InternalMail>, 'createdAt'>>;

/**
 * Valid internal question statuses.
 */
export const questionStatuses = ['open', 'closed', 'protected'] as const;

/**
 * The shape of an internal question.
 */
export type InternalQuestion = WithId<{
  creator: Username;
  title: string;
  'title-lowercase': string;
  createdAt: UnixEpochMs;
  text: string;
  status: typeof questionStatuses[number];
  hasAcceptedAnswer: boolean;
  upvotes: number;
  upvoterUsernames: Username[];
  downvotes: number;
  downvoterUsernames: Username[];
  answers: number;
  answerItems: InternalAnswer[];
  views: number;
  comments: number;
  commentItems: InternalComment[];
  sorter: {
    uvc: number;
    uvac: number;
  };
}>;

/**
 * The shape of a public question.
 */
export type PublicQuestion = Omit<
  WithoutId<InternalQuestion>,
  | 'title-lowercase'
  | 'upvoterUsernames'
  | 'downvoterUsernames'
  | 'answerItems'
  | 'commentItems'
  | 'sorter'
> & {
  question_id: string;
};

/**
 * The shape of a new question.
 */
export type NewQuestion = Omit<
  WithoutId<InternalQuestion>,
  | 'createdAt'
  | 'title-lowercase'
  | 'createdAt'
  | 'status'
  | 'hasAcceptedAnswer'
  | 'upvotes'
  | 'upvoterUsernames'
  | 'downvotes'
  | 'downvoterUsernames'
  | 'answers'
  | 'answerItems'
  | 'comments'
  | 'commentItems'
  | 'views'
  | 'sorter'
>;

/**
 * The shape of a patch question.
 */
export type PatchQuestion = Partial<
  Omit<
    WithoutId<InternalQuestion>,
    | 'creator'
    | 'title-lowercase'
    | 'createdAt'
    | 'hasAcceptedAnswer'
    | 'upvoterUsernames'
    | 'downvoterUsernames'
    | 'answers'
    | 'answerItems'
    | 'comments'
    | 'commentItems'
    | 'views'
    | 'sorter'
  > & { views: InternalQuestion['views'] | ViewsUpdateOperation }
>;

/**
 * The shape of an internal answer.
 */
export type InternalAnswer = WithId<{
  creator: Username;
  createdAt: UnixEpochMs;
  text: string;
  accepted: boolean;
  upvotes: number;
  upvoterUsernames: Username[];
  downvotes: number;
  downvoterUsernames: Username[];
  commentItems: InternalComment[];
}>;

/**
 * The shape of a public answer.
 */
export type PublicAnswer = Omit<
  WithoutId<InternalAnswer>,
  'upvoterUsernames' | 'downvoterUsernames' | 'commentItems'
> & {
  answer_id: string;
  comments: number;
};

/**
 * The shape of a new answer.
 */
export type NewAnswer = Omit<
  WithoutId<InternalAnswer>,
  | 'createdAt'
  | 'accepted'
  | 'upvotes'
  | 'upvoterUsernames'
  | 'downvotes'
  | 'downvoterUsernames'
  | 'commentItems'
>;

/**
 * The shape of a patch answer.
 */
export type PatchAnswer = Partial<
  Omit<
    WithoutId<InternalAnswer>,
    | 'creator'
    | 'createdAt'
    | 'upvoterUsernames'
    | 'downvoterUsernames'
    | 'commentItems'
  >
>;

/**
 * The shape of an internal comment.
 */
export type InternalComment = WithId<{
  creator: Username;
  createdAt: UnixEpochMs;
  text: string;
  upvotes: number;
  upvoterUsernames: Username[];
  downvotes: number;
  downvoterUsernames: Username[];
}>;

/**
 * The shape of a public comment.
 */
export type PublicComment = Omit<
  WithoutId<InternalComment>,
  'upvoterUsernames' | 'downvoterUsernames'
> & {
  comment_id: string;
};

/**
 * The shape of a new comment.
 */
export type NewComment = Omit<
  WithoutId<InternalComment>,
  'createdAt' | 'upvotes' | 'upvoterUsernames' | 'downvotes' | 'downvoterUsernames'
>;

/**
 * Transforms an internal user into a public user.
 */
export function toPublicUser(internalUser: InternalUser): PublicUser {
  return {
    user_id: internalUser._id.toString(),
    username: internalUser.username,
    email: internalUser.email,
    salt: internalUser.salt,
    points: internalUser.points,
    answers: internalUser.answerIds.length,
    questions: internalUser.questionIds.length
  };
}

/**
 * Transforms internal mail into a public mail.
 */
export function toPublicMail(internalMail: InternalMail): PublicMail {
  return {
    mail_id: internalMail._id.toString(),
    sender: internalMail.sender,
    receiver: internalMail.receiver,
    createdAt: internalMail.createdAt,
    subject: internalMail.subject,
    text: internalMail.text
  };
}

/**
 * Transforms an internal question into a public question.
 */
export function toPublicQuestion(internalQuestion: InternalQuestion): PublicQuestion {
  return {
    question_id: internalQuestion._id.toString(),
    creator: internalQuestion.creator,
    createdAt: internalQuestion.createdAt,
    title: internalQuestion.title,
    text: internalQuestion.text,
    status: internalQuestion.status,
    answers: internalQuestion.answerItems.length,
    comments: internalQuestion.commentItems.length,
    upvotes: internalQuestion.upvotes,
    downvotes: internalQuestion.downvotes,
    views: internalQuestion.views,
    hasAcceptedAnswer: internalQuestion.hasAcceptedAnswer
  };
}

/**
 * Transforms an internal answer into a public answer.
 */
export function toPublicAnswer(internalAnswer: InternalAnswer): PublicAnswer {
  return {
    answer_id: internalAnswer._id.toString(),
    creator: internalAnswer.creator,
    createdAt: internalAnswer.createdAt,
    accepted: internalAnswer.accepted,
    text: internalAnswer.text,
    upvotes: internalAnswer.upvotes,
    downvotes: internalAnswer.downvotes,
    comments: internalAnswer.commentItems.length
  };
}

/**
 * Transforms an internal comment into a public comment.
 */
export function toPublicComment(internalComment: InternalComment): PublicComment {
  return {
    comment_id: internalComment._id.toString(),
    creator: internalComment.creator,
    createdAt: internalComment.createdAt,
    text: internalComment.text,
    upvotes: internalComment.upvotes,
    downvotes: internalComment.downvotes
  };
}

/**
 * A MongoDB cursor projection that transforms an internal user into a public
 * user.
 */
export const publicUserProjection = {
  _id: false,
  user_id: { $toString: '$_id' },
  username: true,
  salt: true,
  email: true,
  points: true,
  answers: { $size: '$answerIds' },
  questions: { $size: '$questionIds' }
} as const;

/**
 * A MongoDB cursor projection that transforms internal mail into public mail.
 */
export const publicMailProjection = {
  _id: false,
  mail_id: { $toString: '$_id' },
  sender: true,
  receiver: true,
  createdAt: true,
  subject: true,
  text: true
} as const;

/**
 * A MongoDB cursor projection that transforms an internal question into a
 * public question.
 */
export const publicQuestionProjection = {
  _id: false,
  question_id: { $toString: '$_id' },
  creator: true,
  createdAt: true,
  title: true,
  text: true,
  status: true,
  answers: true,
  comments: true,
  upvotes: true,
  downvotes: true,
  views: true,
  hasAcceptedAnswer: true
} as const;

/**
 * A MongoDB cursor projection that transforms an internal answer into a public
 * answer.
 */
export const publicAnswerProjection = {
  _id: false,
  answer_id: { $toString: '$_id' },
  creator: true,
  createdAt: true,
  accepted: true,
  text: true,
  upvotes: true,
  downvotes: true,
  comments: { $size: '$commentItems' }
} as const;

/**
 * A MongoDB aggregation expression that maps an internal answer into a public
 * answer.
 */
export const publicAnswerMap = (variable: string) =>
  ({
    answer_id: { $toString: `$$${variable}._id` },
    creator: `$$${variable}.creator`,
    createdAt: `$$${variable}.createdAt`,
    accepted: `$$${variable}.accepted`,
    text: `$$${variable}.text`,
    upvotes: `$$${variable}.upvotes`,
    downvotes: `$$${variable}.downvotes`,
    comments: { $size: `$$${variable}.commentItems` }
  } as const);

/**
 * A MongoDB cursor projection that transforms an internal comment into a public
 * comment.
 */
export const publicCommentProjection = {
  _id: false,
  comment_id: { $toString: '$_id' },
  creator: true,
  createdAt: true,
  text: true,
  upvotes: true,
  downvotes: true
} as const;

/**
 * A MongoDB aggregation expression that maps an internal comment into a public
 * comment.
 */
export const publicCommentMap = (variable: string) =>
  ({
    comment_id: { $toString: `$$${variable}._id` },
    creator: `$$${variable}.creator`,
    createdAt: `$$${variable}.createdAt`,
    text: `$$${variable}.text`,
    upvotes: `$$${variable}.upvotes`,
    downvotes: `$$${variable}.downvotes`
  } as const);

/**
 * A meaningless MongoDB cursor projection used for existence checking without
 * wasting the bandwidth to pull down all of the data that might be embedded
 * within an object's fields.
 */
export const vacuousProjection = { exists: { $literal: true } };

/**
 * A MongoDB cursor projection that evaluates an internal question, answer, or
 * comment and returns how the specified user voted on said item.
 */
export const voterStatusProjection = (username: Username) => ({
  voterStatus: {
    $switch: {
      branches: [
        {
          case: { $in: [username, '$upvoterUsernames'] },
          then: 'upvoted'
        },
        {
          case: { $in: [username, '$downvoterUsernames'] },
          then: 'downvoted'
        }
      ],
      default: null
    }
  }
});

async function genericSelectAggregation<T>({
  question_id,
  answer_id,
  answer_creator,
  comment_id,
  projection
}: {
  question_id: QuestionId | undefined;
  answer_id: AnswerId | undefined;
  answer_creator?: Username | undefined;
  comment_id: CommentId | undefined;
  projection: Projection | undefined;
}): Promise<T> {
  if (
    (!answer_id && !answer_creator && !comment_id) ||
    (answer_id && answer_creator)
  ) {
    throw new GuruMeditationError('illegal parameter combination');
  }

  return (await getDb({ name: 'hscc-api-qoverflow' }))
    .collection<InternalQuestion>('questions')
    .aggregate([
      { $match: { _id: question_id } },
      ...(answer_id || answer_creator
        ? [
            {
              $project: {
                answer: {
                  $first: {
                    $filter: {
                      input: '$answerItems',
                      as: 'answer',
                      cond: answer_creator
                        ? { $eq: ['$$answer.creator', answer_creator] }
                        : { $eq: ['$$answer._id', answer_id] }
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
      ...(comment_id
        ? [
            {
              $project: {
                comment: {
                  $first: {
                    $filter: {
                      input: '$commentItems',
                      as: 'comment',
                      cond: { $eq: ['$$comment._id', comment_id] }
                    }
                  }
                }
              }
            },
            {
              $replaceWith: '$comment'
            }
          ]
        : []),
      ...(projection ? [{ $project: projection }] : [])
    ])
    .next() as Promise<T>;
}

/**
 * Returns a nested answer object via aggregation pipeline, optionally applying
 * a projection to the result.
 */
export async function selectAnswerFromDb<T = InternalAnswer | null>({
  question_id,
  answer_id,
  answer_creator,
  projection
}: {
  question_id: QuestionId;
  answer_id?: AnswerId;
  answer_creator?: Username;
  projection?: Projection;
}): Promise<T> {
  return genericSelectAggregation<T>({
    question_id,
    answer_id,
    answer_creator,
    comment_id: undefined,
    projection
  });
}

/**
 * Returns a nested comment object via aggregation pipeline, optionally applying
 * a projection to the result.
 */
export async function selectCommentFromDb<T = InternalComment | null>({
  question_id,
  answer_id,
  comment_id,
  projection
}: {
  question_id: QuestionId;
  answer_id?: AnswerId;
  comment_id: CommentId;
  projection?: Projection;
}): Promise<T> {
  return genericSelectAggregation<T>({
    question_id,
    answer_id,
    comment_id,
    projection
  });
}

/**
 * Adds a nested answer object to a question document.
 */
export async function addAnswerToDb({
  question_id,
  answer
}: {
  question_id: QuestionId;
  answer: InternalAnswer;
}) {
  return (await getDb({ name: 'hscc-api-qoverflow' }))
    .collection<InternalQuestion>('questions')
    .updateOne(
      { _id: question_id },
      {
        $inc: { answers: 1, 'sorter.uvac': 1 },
        $push: { answerItems: answer }
      }
    );
}

/**
 * Adds a nested comment object to a question document.
 */
export async function addCommentToDb({
  question_id,
  answer_id,
  comment
}: {
  question_id: QuestionId;
  answer_id?: AnswerId;
  comment: InternalComment;
}) {
  const db = (
    await getDb({ name: 'hscc-api-qoverflow' })
  ).collection<InternalQuestion>('questions');

  if (answer_id) {
    return db.updateOne(
      { _id: question_id },
      { $push: { 'answerItems.$[answer].commentItems': comment } },
      { arrayFilters: [{ 'answer._id': answer_id }] }
    );
  } else {
    return db.updateOne(
      { _id: question_id },
      {
        $inc: { comments: 1, 'sorter.uvc': 1, 'sorter.uvac': 1 },
        $push: { commentItems: comment }
      }
    );
  }
}

/**
 * Helper function that flattens an update specification for a sub-object so
 * that it may be used in a MongoDB update function.
 *
 * `updateOps` must be a valid MongoDB update document, e.g. `{ $set: ... }`.
 */
function updateOpsToFullSchema(updateOps: Document, predicate: string) {
  return Object.entries(updateOps).reduce((newUpdateOps, [updateOp, opSpec]) => {
    newUpdateOps[updateOp] ??= {};

    Object.entries(opSpec).forEach(([targetField, updateVal]) => {
      newUpdateOps[updateOp][`${predicate}.${targetField}`] = updateVal;
    });

    return newUpdateOps;
  }, {} as Document);
}

/**
 * Patches a nested answer object in a question document.
 */
export async function patchAnswerInDb({
  question_id,
  answer_id,
  updateOps
}: {
  question_id: QuestionId;
  answer_id: AnswerId;
  updateOps: Document;
}) {
  return (await getDb({ name: 'hscc-api-qoverflow' }))
    .collection<InternalQuestion>('questions')
    .updateOne(
      { _id: question_id },
      updateOpsToFullSchema(updateOps, 'answerItems.$[answer]'),
      { arrayFilters: [{ 'answer._id': answer_id }] }
    );
}

/**
 * Patches a nested comment object in a question document.
 */
export async function patchCommentInDb({
  question_id,
  answer_id,
  comment_id,
  updateOps
}: {
  question_id: QuestionId;
  answer_id?: AnswerId;
  comment_id: CommentId;
  updateOps: Document;
}) {
  const db = (
    await getDb({ name: 'hscc-api-qoverflow' })
  ).collection<InternalQuestion>('questions');

  if (answer_id) {
    return db.updateOne(
      { _id: question_id },
      updateOpsToFullSchema(
        updateOps,
        'answerItems.$[answer].commentItems.$[comment]'
      ),
      { arrayFilters: [{ 'answer._id': answer_id }, { 'comment._id': comment_id }] }
    );
  } else {
    return db.updateOne(
      { _id: question_id },
      updateOpsToFullSchema(updateOps, 'commentItems.$[comment]'),
      { arrayFilters: [{ 'comment._id': comment_id }] }
    );
  }
}

/**
 * Deletes a nested answer object from a question document.
 */
export async function removeAnswerFromDb({
  question_id,
  answer_id
}: {
  question_id: QuestionId;
  answer_id: AnswerId;
}) {
  return (await getDb({ name: 'hscc-api-qoverflow' }))
    .collection<InternalQuestion>('questions')
    .updateOne(
      { _id: question_id },
      {
        $inc: { answers: -1, 'sorter.uvac': -1 },
        $pull: { answerItems: { _id: answer_id } }
      }
    );
}

/**
 * Deletes a nested comment object from a question document.
 */
export async function removeCommentFromDb({
  question_id,
  answer_id,
  comment_id
}: {
  question_id: QuestionId;
  answer_id?: AnswerId;
  comment_id: CommentId;
}) {
  const db = (
    await getDb({ name: 'hscc-api-qoverflow' })
  ).collection<InternalQuestion>('questions');

  if (answer_id) {
    return db.updateOne(
      { _id: question_id },
      { $pull: { 'answerItems.$[answer].commentItems': { _id: comment_id } } },
      { arrayFilters: [{ 'answer._id': answer_id }] }
    );
  } else {
    return db.updateOne(
      { _id: question_id },
      {
        $inc: { comments: -1, 'sorter.uvc': -1, 'sorter.uvac': -1 },
        $pull: { commentItems: { _id: comment_id } }
      }
    );
  }
}
