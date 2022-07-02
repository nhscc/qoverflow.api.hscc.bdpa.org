import { getCommonSchemaConfig } from 'multiverse/mongo-common';

import type { ObjectId, WithId, WithoutId } from 'mongodb';
import type { UnixEpochMs } from '@xunnamius/types';
import type { DbSchema } from 'multiverse/mongo-schema';
import type { Simplify } from 'type-fest';

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
              { spec: { createdAt: -1 } },
              { spec: 'status' },
              { spec: 'upvotes' },
              { spec: 'upvoteIds' },
              { spec: 'downvotes' },
              { spec: 'downvoteIds' },
              { spec: 'answers' },
              { spec: 'answerItems._id' },
              { spec: 'answerItems.upvoteIds' },
              { spec: 'answerItems.downvoteIds' },
              { spec: 'answerItems.commentItems._id' },
              { spec: 'answerItems.commentItems.upvoteIds' },
              { spec: 'answerItems.commentItems.downvoteIds' },
              { spec: 'comments' },
              { spec: 'commentItems._id' },
              { spec: 'commentItems.upvoteIds' },
              { spec: 'commentItems.downvoteIds' },
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
 * The shape of a simple update operation.
 */
export type SimpleUpdateOperation = {
  operation: 'increment' | 'decrement';
};

/**
 * The shape of an update operation on upvotes/downvotes.
 */
export type VotesUpdateOperation = Simplify<
  SimpleUpdateOperation & {
    target: 'upvotes' | 'downvotes';
  }
>;

/**
 * The shape of an update operation on a user's points total.
 */
export type PointsUpdateOperation = Simplify<
  SimpleUpdateOperation & {
    amount: number;
  }
>;

/**
 * The shape of an internal application user.
 */
export type InternalUser = Simplify<
  WithId<{
    username: Username;
    salt: string;
    email: string;
    key: string;
    points: number;
    questionIds: QuestionId[];
    answerIds: AnswerId[];
  }>
>;

/**
 * The shape of a public application user.
 */
export type PublicUser = Simplify<
  Omit<WithoutId<InternalUser>, 'key' | 'questionIds' | 'answerIds'> & {
    user_id: string;
    questions: number;
    answers: number;
  }
>;

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
  Omit<WithoutId<InternalUser>, 'username' | 'questionIds' | 'answerIds'>
>;

/**
 * The shape of internal mail.
 */
export type InternalMail = Simplify<
  WithId<{
    sender: Username;
    receiver: Username;
    createdAt: UnixEpochMs;
    subject: string;
    text: string;
  }>
>;

/**
 * The shape of public mail.
 */
export type PublicMail = Simplify<
  WithoutId<InternalMail> & {
    mail_id: string;
  }
>;

/**
 * The shape of new mail.
 */
export type NewMail = Partial<Omit<WithoutId<InternalMail>, 'createdAt'>>;

/**
 * The shape of an internal question.
 */
export type InternalQuestion = Simplify<
  WithId<{
    creator: Username;
    title: string;
    'title-lowercase': string;
    createdAt: UnixEpochMs;
    text: string;
    status: 'open' | 'closed' | 'protected';
    hasAcceptedAnswer: boolean;
    upvotes: number;
    upvoteIds: UserId[];
    downvotes: number;
    downvoteIds: UserId[];
    answers: number;
    answerItems: InternalAnswer[];
    views: number;
    comments: number;
    commentItems: InternalComment[];
    sorter: {
      uvc: number;
      uvac: number;
    };
  }>
>;

/**
 * The shape of a public question.
 */
export type PublicQuestion = Simplify<
  Omit<
    WithoutId<InternalQuestion>,
    | 'title-lowercase'
    | 'upvoteIds'
    | 'downvoteIds'
    | 'answerItems'
    | 'commentItems'
    | 'sorter'
  > & {
    question_id: string;
  }
>;

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
  | 'upvoteIds'
  | 'downvotes'
  | 'downvoteIds'
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
export type PatchQuestion = Simplify<
  Omit<
    WithoutId<InternalQuestion>,
    | 'creator'
    | 'title-lowercase'
    | 'createdAt'
    | 'hasAcceptedAnswer'
    | 'upvoteIds'
    | 'downvoteIds'
    | 'answers'
    | 'answerItems'
    | 'comments'
    | 'commentItems'
    | 'views'
    | 'sorter'
  > & { view: SimpleUpdateOperation }
>;

/**
 * The shape of an internal answer.
 */
export type InternalAnswer = Simplify<
  WithId<{
    creator: Username;
    createdAt: UnixEpochMs;
    text: string;
    accepted: boolean;
    upvotes: number;
    upvoteIds: UserId[];
    downvotes: number;
    downvoteIds: UserId[];
    commentItems: InternalComment[];
  }>
>;

/**
 * The shape of a public answer.
 */
export type PublicAnswer = Simplify<
  Omit<WithoutId<InternalAnswer>, 'upvoteIds' | 'downvoteIds' | 'commentItems'> & {
    answer_id: string;
    comments: number;
  }
>;

/**
 * The shape of a new answer.
 */
export type NewAnswer = Omit<
  WithoutId<InternalAnswer>,
  | 'createdAt'
  | 'accepted'
  | 'upvotes'
  | 'upvoteIds'
  | 'downvotes'
  | 'downvoteIds'
  | 'commentItems'
>;

/**
 * The shape of a patch answer.
 */
export type PatchAnswer = Omit<
  WithoutId<InternalAnswer>,
  'createdAt' | 'upvoteIds' | 'downvoteIds' | 'commentItems'
>;

/**
 * The shape of an internal comment.
 */
export type InternalComment = Simplify<
  WithId<{
    creator: Username;
    createdAt: UnixEpochMs;
    text: string;
    upvotes: number;
    upvoteIds: UserId[];
    downvotes: number;
    downvoteIds: UserId[];
  }>
>;

/**
 * The shape of a public comment.
 */
export type PublicComment = Simplify<
  Omit<WithoutId<InternalComment>, 'upvoteIds' | 'downvoteIds'> & {
    comment_id: string;
  }
>;

/**
 * The shape of a new comment.
 */
export type NewComment = Omit<
  WithoutId<InternalComment>,
  'createdAt' | 'upvotes' | 'upvoteIds' | 'downvotes' | 'downvoteIds'
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
  answers: true,
  questions: true
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
  comments: true
} as const;

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
