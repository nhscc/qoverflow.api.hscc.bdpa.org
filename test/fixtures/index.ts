import {
  applyVotesUpdateOperation,
  authAppUser,
  createAnswer,
  createComment,
  createMessage,
  createQuestion,
  createUser,
  deleteAnswer,
  deleteComment,
  deleteMessage,
  deleteQuestion,
  deleteUser,
  getAllUsers,
  getAnswers,
  getComments,
  getHowUserVoted,
  getQuestion,
  getUser,
  getUserAnswers,
  getUserMessages,
  getUserQuestions,
  searchQuestions,
  updateAnswer,
  updateQuestion,
  updateUser
} from 'universe/backend';

import V1EndpointMail, {
  config as V1ConfigMail,
  metadata as V1MetadataMail
} from 'universe/pages/api/v1/mail';

import V1EndpointMailUsername, {
  config as V1ConfigMailUsername,
  metadata as V1MetadataMailUsername
} from 'universe/pages/api/v1/mail/[username]';

import V1EndpointQuestions, {
  config as V1ConfigQuestions,
  metadata as V1MetadataQuestions
} from 'universe/pages/api/v1/questions';

import V1EndpointQuestionsQuestionId, {
  config as V1ConfigQuestionsQuestionId,
  metadata as V1MetadataQuestionsQuestionId
} from 'universe/pages/api/v1/questions/[question_id]';

import V1EndpointQuestionsQuestionIdAnswers, {
  config as V1ConfigQuestionsQuestionIdAnswers,
  metadata as V1MetadataQuestionsQuestionIdAnswers
} from 'universe/pages/api/v1/questions/[question_id]/answers';

import V1EndpointQuestionsQuestionIdAnswersAnswerId, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerId,
  metadata as V1MetadataQuestionsQuestionIdAnswersAnswerId
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdComments, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdComments,
  metadata as V1MetadataQuestionsQuestionIdAnswersAnswerIdComments
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentId, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentId,
  metadata as V1MetadataQuestionsQuestionIdAnswersAnswerIdCommentsCommentId
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments/[comment_id]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername,
  metadata as V1MetadataQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/comments/[comment_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdAnswersAnswerIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdAnswersAnswerIdVoteUsername,
  metadata as V1MetadataQuestionsQuestionIdAnswersAnswerIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/answers/[answer_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdComments, {
  config as V1ConfigQuestionsQuestionIdComments,
  metadata as V1MetadataQuestionsQuestionIdComments
} from 'universe/pages/api/v1/questions/[question_id]/comments';

import V1EndpointQuestionsQuestionIdCommentsCommentId, {
  config as V1ConfigQuestionsQuestionIdCommentsCommentId,
  metadata as V1MetadataQuestionsQuestionIdCommentsCommentId
} from 'universe/pages/api/v1/questions/[question_id]/comments/[comment_id]';

import V1EndpointQuestionsQuestionIdCommentsCommentIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdCommentsCommentIdVoteUsername,
  metadata as V1MetadataQuestionsQuestionIdCommentsCommentIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/comments/[comment_id]/vote/[username]';

import V1EndpointQuestionsQuestionIdVoteUsername, {
  config as V1ConfigQuestionsQuestionIdVoteUsername,
  metadata as V1MetadataQuestionsQuestionIdVoteUsername
} from 'universe/pages/api/v1/questions/[question_id]/vote/[username]';

import V1EndpointQuestionsSearch, {
  config as V1ConfigQuestionsSearch,
  metadata as V1MetadataQuestionsSearch
} from 'universe/pages/api/v1/questions/search';

import V1EndpointUsers, {
  config as V1ConfigUsers,
  metadata as V1MetadataUsers
} from 'universe/pages/api/v1/users';

import V1EndpointUsersUsername, {
  config as V1ConfigUsersUsername,
  metadata as V1MetadataUsersUsername
} from 'universe/pages/api/v1/users/[username]';

import V1EndpointUsersUsernameAnswers, {
  config as V1ConfigUsersUsernameAnswers,
  metadata as V1MetadataUsersUsernameAnswers
} from 'universe/pages/api/v1/users/[username]/answers';

import V1EndpointUsersUsernameAuth, {
  config as V1ConfigUsersUsernameAuth,
  metadata as V1MetadataUsersUsernameAuth
} from 'universe/pages/api/v1/users/[username]/auth';

import V1EndpointUsersUsernamePoints, {
  config as V1ConfigUsersUsernamePoints,
  metadata as V1MetadataUsersUsernamePoints
} from 'universe/pages/api/v1/users/[username]/points';

import V1EndpointUsersUsernameQuestions, {
  config as V1ConfigUsersUsernameQuestions,
  metadata as V1MetadataUsersUsernameQuestions
} from 'universe/pages/api/v1/users/[username]/questions';

import { asMocked } from 'testverse/util';

import type { NextApiHandler, PageConfig } from 'next';

import type {
  PublicAnswer,
  PublicComment,
  PublicMail,
  PublicQuestion,
  PublicUser
} from 'universe/backend/db';

export type NextApiHandlerMixin = NextApiHandler & {
  config?: PageConfig;
  uri: string;
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
api.v1.questionsQuestionIdVoteUsername.config = V1ConfigQuestionsQuestionIdVoteUsername;
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

api.v1.users.uri = V1MetadataUsers.descriptor;
api.v1.usersUsername.uri = V1MetadataUsersUsername.descriptor;
api.v1.usersUsernameAuth.uri = V1MetadataUsersUsernameAuth.descriptor;
api.v1.usersUsernameQuestions.uri = V1MetadataUsersUsernameQuestions.descriptor;
api.v1.usersUsernameAnswers.uri = V1MetadataUsersUsernameAnswers.descriptor;
api.v1.usersUsernamePoints.uri = V1MetadataUsersUsernamePoints.descriptor;
api.v1.mail.uri = V1MetadataMail.descriptor;
api.v1.mailUsername.uri = V1MetadataMailUsername.descriptor;
api.v1.questions.uri = V1MetadataQuestions.descriptor;
api.v1.questionsSearch.uri = V1MetadataQuestionsSearch.descriptor;
api.v1.questionsQuestionId.uri = V1MetadataQuestionsQuestionId.descriptor;
api.v1.questionsQuestionIdVoteUsername.uri =
  V1MetadataQuestionsQuestionIdVoteUsername.descriptor;
api.v1.questionsQuestionIdComments.uri =
  V1MetadataQuestionsQuestionIdComments.descriptor;
api.v1.questionsQuestionIdCommentsCommentId.uri =
  V1MetadataQuestionsQuestionIdCommentsCommentId.descriptor;
api.v1.questionsQuestionIdCommentsCommentIdVoteUsername.uri =
  V1MetadataQuestionsQuestionIdCommentsCommentIdVoteUsername.descriptor;
api.v1.questionsQuestionIdAnswers.uri = V1MetadataQuestionsQuestionIdAnswers.descriptor;
api.v1.questionsQuestionIdAnswersAnswerId.uri =
  V1MetadataQuestionsQuestionIdAnswersAnswerId.descriptor;
api.v1.questionsQuestionIdAnswersAnswerIdVoteUsername.uri =
  V1MetadataQuestionsQuestionIdAnswersAnswerIdVoteUsername.descriptor;
api.v1.questionsQuestionIdAnswersAnswerIdComments.uri =
  V1MetadataQuestionsQuestionIdAnswersAnswerIdComments.descriptor;
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentId.uri =
  V1MetadataQuestionsQuestionIdAnswersAnswerIdCommentsCommentId.descriptor;
api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername.uri =
  V1MetadataQuestionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername.descriptor;

/**
 * A convenience function that mocks the entire backend and returns the mock
 * functions. Uses `beforeEach` under the hood.
 *
 * **WARNING: YOU MUST CALL `jest.mock('universe/backend')` before calling this
 * function!**
 */
export function setupMockBackend() {
  const mockedApplyVotesUpdateOperation = asMocked(applyVotesUpdateOperation);
  const mockedAuthAppUser = asMocked(authAppUser);
  const mockedCreateAnswer = asMocked(createAnswer);
  const mockedCreateComment = asMocked(createComment);
  const mockedCreateMessage = asMocked(createMessage);
  const mockedCreateQuestion = asMocked(createQuestion);
  const mockedCreateUser = asMocked(createUser);
  const mockedDeleteComment = asMocked(deleteComment);
  const mockedDeleteUser = asMocked(deleteUser);
  const mockedGetAllUsers = asMocked(getAllUsers);
  const mockedGetAnswers = asMocked(getAnswers);
  const mockedGetComments = asMocked(getComments);
  const mockedGetQuestion = asMocked(getQuestion);
  const mockedGetUser = asMocked(getUser);
  const mockedGetUserAnswers = asMocked(getUserAnswers);
  const mockedGetUserMessages = asMocked(getUserMessages);
  const mockedGetUserQuestions = asMocked(getUserQuestions);
  const mockedSearchQuestions = asMocked(searchQuestions);
  const mockedUpdateAnswer = asMocked(updateAnswer);
  const mockedUpdateQuestion = asMocked(updateQuestion);
  const mockedUpdateUser = asMocked(updateUser);
  const mockedDeleteAnswer = asMocked(deleteAnswer);
  const mockedDeleteMessage = asMocked(deleteMessage);
  const mockedDeleteQuestion = asMocked(deleteQuestion);
  const mockedGetHowUserVoted = asMocked(getHowUserVoted);

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
