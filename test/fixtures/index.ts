import { asMockedFunction } from '@xunnamius/jest-types';

import {
  applyVotesUpdateOperation,
  authAppUser,
  createAnswer,
  createComment,
  createMessage,
  createQuestion,
  createUser,
  deleteComment,
  deleteUser,
  getAllUsers,
  getAnswers,
  getComments,
  getQuestion,
  getUser,
  getUserAnswers,
  getUserMessages,
  getUserQuestions,
  searchQuestions,
  updateAnswer,
  updateQuestion,
  updateUser,
  deleteAnswer,
  deleteMessage,
  deleteQuestion,
  getHowUserVoted
} from 'universe/backend';

import V1EndpointUsers, {
  config as V1ConfigUsers
} from 'universe/pages/api/v1/users';

import V1EndpointUsersUsername, {
  config as V1ConfigUsersUsername
} from 'universe/pages/api/v1/users/[username]';

import V1EndpointUsersUsernameAuth, {
  config as V1ConfigUsersUsernameAuth
} from 'universe/pages/api/v1/users/[username]/auth';

import V1EndpointUsersUsernameQuestions, {
  config as V1ConfigUsersUsernameQuestions
} from 'universe/pages/api/v1/users/[username]/questions';

import V1EndpointUsersUsernameAnswers, {
  config as V1ConfigUsersUsernameAnswers
} from 'universe/pages/api/v1/users/[username]/answers';

import V1EndpointUsersUsernamePoints, {
  config as V1ConfigUsersUsernamePoints
} from 'universe/pages/api/v1/users/[username]/points';

import V1EndpointMail, { config as V1ConfigMail } from 'universe/pages/api/v1/mail';

import V1EndpointMailUsername, {
  config as V1ConfigMailUsername
} from 'universe/pages/api/v1/mail/[username]';

import V1EndpointQuestionsSearch, {
  config as V1ConfigQuestionsSearch
} from 'universe/pages/api/v1/questions/search';

import V1EndpointQuestions, {
  config as V1ConfigQuestions
} from 'universe/pages/api/v1/questions';

import V1EndpointQuestionsQuestionId, {
  config as V1ConfigQuestionsQuestionId
} from 'universe/pages/api/v1/questions/[question_id]';

import V1EndpointQuestionsQuestionIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdComments, {
  config as V1ConfigQuestionsQuestionIdComments
} from 'universe/pages/api/v1/questions/[question_id]/comments';

import V1EndpointQuestionsQuestionIdCommentsCommentId, {
  config as V1ConfigQuestionsQuestionIdCommentsCommentId
} from 'universe/pages/api/v1/questions/[question_id]/comments/[comment_id]';

import V1EndpointQuestionsQuestionIdCommentsCommentIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdCommentsCommentIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/comments/[comment_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdAnswers, {
  config as V1ConfigQuestionsQuestionIdAnswers
} from 'universe/pages/api/v1/questions/[question_id]/answers';

import V1EndpointQuestionsQuestionIdAnswersAnswerId, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerId
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdComments, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdComments
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentId, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentId
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments/[comment_id]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments/[comment_id]/vote/[username]';

import type { NextApiHandler, PageConfig } from 'next';
import {
  PublicAnswer,
  PublicComment,
  PublicMail,
  PublicQuestion,
  PublicUser
} from 'universe/backend/db';

export type NextApiHandlerMixin = NextApiHandler & {
  config?: PageConfig;
  uri?: string;
};

/**
 * The entire live API topology gathered together into one convenient object.
 */
export const api = {
  v1: {
    users: V1EndpointUsers as NextApiHandlerMixin,
    usersUsername: V1EndpointUsersUsername as NextApiHandlerMixin,
    usersUsernameAuth: V1EndpointUsersUsernameAuth as NextApiHandlerMixin,
    usersUsernameQuestions: V1EndpointUsersUsernameQuestions as NextApiHandlerMixin,
    usersUsernameAnswers: V1EndpointUsersUsernameAnswers as NextApiHandlerMixin,
    usersUsernamePoints: V1EndpointUsersUsernamePoints as NextApiHandlerMixin,
    mail: V1EndpointMail as NextApiHandlerMixin,
    mailUsername: V1EndpointMailUsername as NextApiHandlerMixin,
    questions: V1EndpointQuestions as NextApiHandlerMixin,
    questionsSearch: V1EndpointQuestionsSearch as NextApiHandlerMixin,
    questionsQuestionId: V1EndpointQuestionsQuestionId as NextApiHandlerMixin,
    questionsQuestionIdVoteUsername:
      V1EndpointQuestionsQuestionIdVoteUsername as NextApiHandlerMixin,
    questionsQuestionIdComments:
      V1EndpointQuestionsQuestionIdComments as NextApiHandlerMixin,
    questionsQuestionIdCommentsCommentId:
      V1EndpointQuestionsQuestionIdCommentsCommentId as NextApiHandlerMixin,
    questionsQuestionIdCommentsCommentIdVoteUsername:
      V1EndpointQuestionsQuestionIdCommentsCommentIdVoteUsername as NextApiHandlerMixin,
    questionsQuestionIdAnswers:
      V1EndpointQuestionsQuestionIdAnswers as NextApiHandlerMixin,
    questionsQuestionIdAnswersAnswerId:
      V1EndpointQuestionsQuestionIdAnswersAnswerId as NextApiHandlerMixin,
    questionsQuestionIdAnswersAnswerIdVoteUsername:
      V1EndpointQuestionsQuestionIdAnswersAnswerIdVoteUsername as NextApiHandlerMixin,
    questionsQuestionIdAnswersAnswerIdComments:
      V1EndpointQuestionsQuestionIdAnswersAnswerIdComments as NextApiHandlerMixin,
    questionsQuestionIdAnswersAnswerIdCommentsCommentId:
      V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentId as NextApiHandlerMixin,
    questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername:
      V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername as NextApiHandlerMixin
  }
};

api.v1.users.config = V1ConfigUsers;
api.v1.usersUsername.config = V1ConfigUsersUsername;
api.v1.usersUsernameAuth.config = V1ConfigUsersUsernameAuth;
api.v1.usersUsernameQuestions.config = V1ConfigUsersUsernameQuestions;
api.v1.usersUsernameAnswers.config = V1ConfigUsersUsernameAnswers;
api.v1.usersUsernamePoints.config = V1ConfigUsersUsernamePoints;
api.v1.mail.config = V1ConfigMail;
api.v1.mailUsername.config = V1ConfigMailUsername;
api.v1.questions.config = V1ConfigQuestions;
api.v1.questionsSearch.config = V1ConfigQuestionsSearch;
api.v1.questionsQuestionId.config = V1ConfigQuestionsQuestionId;
api.v1.questionsQuestionIdVoteUsername.config =
  V1ConfigQuestionsQuestionIdVoteUsername;
api.v1.questionsQuestionIdComments.config = V1ConfigQuestionsQuestionIdComments;
api.v1.questionsQuestionIdCommentsCommentId.config =
  V1ConfigQuestionsQuestionIdCommentsCommentId;
api.v1.questionsQuestionIdCommentsCommentIdVoteUsername.config =
  V1ConfigQuestionsQuestionIdCommentsCommentIdVoteUsername;
api.v1.questionsQuestionIdAnswers.config = V1ConfigQuestionsQuestionIdAnswers;
api.v1.questionsQuestionIdAnswersAnswerId.config =
  V1ConfigQuestionsQuestionIdAnswersAnswerId;
api.v1.questionsQuestionIdAnswersAnswerIdVoteUsername.config =
  V1ConfigQuestionsQuestionIdAnswersAnswerIdVoteUsername;
api.v1.questionsQuestionIdAnswersAnswerIdComments.config =
  V1ConfigQuestionsQuestionIdAnswersAnswerIdComments;
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentId.config =
  V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentId;
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername.config =
  V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername;

api.v1.users.uri = '/users';
api.v1.usersUsername.uri = '/users/:username';
api.v1.usersUsernameAuth.uri = '/users/:username/auth';
api.v1.usersUsernameQuestions.uri = '/users/:username/questions';
api.v1.usersUsernameAnswers.uri = '/users/:username/answers';
api.v1.usersUsernamePoints.uri = '/users/:username/points';
api.v1.mail.uri = '/mail';
api.v1.mailUsername.uri = '/mail/:username';
api.v1.questions.uri = '/questions';
api.v1.questionsSearch.uri = '/questions/search';
api.v1.questionsQuestionId.uri = '/questions/:question_id';
api.v1.questionsQuestionIdVoteUsername.uri = '/questions/:question_id/vote/:username';
api.v1.questionsQuestionIdComments.uri = '/questions/:question_id/comments';
api.v1.questionsQuestionIdCommentsCommentId.uri =
  '/questions/:question_id/comments/:comment_id';
api.v1.questionsQuestionIdCommentsCommentIdVoteUsername.uri =
  '/questions/:question_id/comments/:comment_id/vote/:username';
api.v1.questionsQuestionIdAnswers.uri = '/questions/:question_id/answers';
api.v1.questionsQuestionIdAnswersAnswerId.uri =
  '/questions/:question_id/answers/:answer_id';
api.v1.questionsQuestionIdAnswersAnswerIdVoteUsername.uri =
  '/questions/:question_id/answers/:answer_id/vote/:username';
api.v1.questionsQuestionIdAnswersAnswerIdComments.uri =
  '/questions/:question_id/answers/:answer_id/comments';
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentId.uri =
  '/questions/:question_id/answers/:answer_id/comments/:comment_id';
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername.uri =
  '/questions/:question_id/answers/:answer_id/comments/:comment_id/vote/:username';

/**
 * A convenience function that mocks the entire backend and returns the mock
 * functions. Uses `beforeEach` under the hood.
 *
 * **WARNING: YOU MUST CALL `jest.mock('universe/backend')` before calling this
 * function!**
 */
export function setupMockBackend() {
  const mockedApplyVotesUpdateOperation = asMockedFunction(applyVotesUpdateOperation);
  const mockedAuthAppUser = asMockedFunction(authAppUser);
  const mockedCreateAnswer = asMockedFunction(createAnswer);
  const mockedCreateComment = asMockedFunction(createComment);
  const mockedCreateMessage = asMockedFunction(createMessage);
  const mockedCreateQuestion = asMockedFunction(createQuestion);
  const mockedCreateUser = asMockedFunction(createUser);
  const mockedDeleteComment = asMockedFunction(deleteComment);
  const mockedDeleteUser = asMockedFunction(deleteUser);
  const mockedGetAllUsers = asMockedFunction(getAllUsers);
  const mockedGetAnswers = asMockedFunction(getAnswers);
  const mockedGetComments = asMockedFunction(getComments);
  const mockedGetQuestion = asMockedFunction(getQuestion);
  const mockedGetUser = asMockedFunction(getUser);
  const mockedGetUserAnswers = asMockedFunction(getUserAnswers);
  const mockedGetUserMessages = asMockedFunction(getUserMessages);
  const mockedGetUserQuestions = asMockedFunction(getUserQuestions);
  const mockedSearchQuestions = asMockedFunction(searchQuestions);
  const mockedUpdateAnswer = asMockedFunction(updateAnswer);
  const mockedUpdateQuestion = asMockedFunction(updateQuestion);
  const mockedUpdateUser = asMockedFunction(updateUser);
  const mockedDeleteAnswer = asMockedFunction(deleteAnswer);
  const mockedDeleteMessage = asMockedFunction(deleteMessage);
  const mockedDeleteQuestion = asMockedFunction(deleteQuestion);
  const mockedGetHowUserVoted = asMockedFunction(getHowUserVoted);

  beforeEach(() => {
    mockedApplyVotesUpdateOperation.mockReturnValue(Promise.resolve());
    mockedAuthAppUser.mockReturnValue(Promise.resolve(false));
    mockedCreateAnswer.mockReturnValue(Promise.resolve({} as PublicAnswer));
    mockedCreateComment.mockReturnValue(Promise.resolve({} as PublicComment));
    mockedCreateMessage.mockReturnValue(Promise.resolve({} as PublicMail));
    mockedCreateQuestion.mockReturnValue(Promise.resolve({} as PublicQuestion));
    mockedCreateUser.mockReturnValue(Promise.resolve({} as PublicUser));
    mockedDeleteComment.mockReturnValue(Promise.resolve());
    mockedDeleteUser.mockReturnValue(Promise.resolve());
    mockedGetAllUsers.mockReturnValue(Promise.resolve([]));
    mockedGetAnswers.mockReturnValue(Promise.resolve([]));
    mockedGetComments.mockReturnValue(Promise.resolve([]));
    mockedGetQuestion.mockReturnValue(Promise.resolve({} as PublicQuestion));
    mockedGetUser.mockReturnValue(Promise.resolve({} as PublicUser));
    mockedGetUserAnswers.mockReturnValue(Promise.resolve([]));
    mockedGetUserMessages.mockReturnValue(Promise.resolve([]));
    mockedGetUserQuestions.mockReturnValue(Promise.resolve([]));
    mockedSearchQuestions.mockReturnValue(Promise.resolve([]));
    mockedUpdateAnswer.mockReturnValue(Promise.resolve());
    mockedUpdateQuestion.mockReturnValue(Promise.resolve());
    mockedUpdateUser.mockReturnValue(Promise.resolve());
    mockedDeleteAnswer.mockReturnValue(Promise.resolve());
    mockedDeleteMessage.mockReturnValue(Promise.resolve());
    mockedDeleteQuestion.mockReturnValue(Promise.resolve());
    mockedGetHowUserVoted.mockReturnValue(Promise.resolve(null));
  });

  return {
    mockedApplyVotesUpdateOperation,
    mockedAuthAppUser,
    mockedCreateAnswer,
    mockedCreateComment,
    mockedCreateMessage,
    mockedCreateQuestion,
    mockedCreateUser,
    mockedDeleteComment,
    mockedDeleteUser,
    mockedGetAllUsers,
    mockedGetAnswers,
    mockedGetComments,
    mockedGetQuestion,
    mockedGetUser,
    mockedGetUserAnswers,
    mockedGetUserMessages,
    mockedGetUserQuestions,
    mockedSearchQuestions,
    mockedUpdateAnswer,
    mockedUpdateQuestion,
    mockedUpdateUser,
    mockedDeleteAnswer,
    mockedDeleteMessage,
    mockedDeleteQuestion,
    mockedGetHowUserVoted
  };
}
