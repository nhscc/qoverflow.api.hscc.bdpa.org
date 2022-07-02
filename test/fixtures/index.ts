import { asMockedFunction } from '@xunnamius/jest-types';

import {
  authAppUser,
  createNode,
  createUser,
  deleteNodes,
  deleteUser,
  getAllUsers,
  getNodes,
  getUser,
  searchNodes,
  updateNode,
  updateUser
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

import V1EndpointUsersUsernamePoints, {
  config as V1ConfigUsersUsernamePoints
} from 'universe/pages/api/v1/users/[username]/points';

import V1EndpointUsersUsernameQuestions, {
  config as V1ConfigUsersUsernameQuestions
} from 'universe/pages/api/v1/users/[username]/questions';

import V1EndpointUsersUsernameAnswers, {
  config as V1ConfigUsersUsernameAnswers
} from 'universe/pages/api/v1/users/[username]/answers';

import V1EndpointFilesystemUsername, {
  config as V1ConfigFilesystemUsername
} from 'universe/pages/api/v1/filesystem/[username]';

import type { NextApiHandler, PageConfig } from 'next';

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
    usersUsernamePoints: V1EndpointUsersUsernamePoints as NextApiHandlerMixin,
    usersUsernameQuestions: V1EndpointUsersUsernameQuestions as NextApiHandlerMixin,
    usersUsernameAnswers: V1EndpointUsersUsernameAnswers as NextApiHandlerMixin
  }
};

api.v1.users.config = V1ConfigUsers;
api.v1.usersUsername.config = V1ConfigUsersUsername;
api.v1.usersUsernameAuth.config = V1ConfigUsersUsernameAuth;
api.v1.usersUsernamePoints.config = V1ConfigUsersUsernamePoints;
api.v1.usersUsernameQuestions.config = V1ConfigUsersUsernameQuestions;
api.v1.usersUsernameAnswers.config = V1ConfigUsersUsernameAnswers;

api.v1.users.uri = '/users';
api.v1.usersUsername.uri = '/users/:username';
api.v1.usersUsernameAuth.uri = '/users/:username/auth';
api.v1.usersUsernamePoints.uri = '/users/:username/points';
api.v1.usersUsernameQuestions.uri = '/users/:username/questions';
api.v1.usersUsernameAnswers.uri = '/users/:username/answers';

/**
 * A convenience function that mocks the entire backend and returns the mock
 * functions. Uses `beforeEach` under the hood.
 *
 * **WARNING: YOU MUST CALL `jest.mock('universe/backend')` before calling this
 * function!**
 */
export function setupMockBackend() {
  // TODO: const mockedAuthAppUser = asMockedFunction(authAppUser);

  beforeEach(() => {
    // TODO: mockedAuthAppUser.mockReturnValue(Promise.resolve(false));
  });

  return {
    // TODO: mockedAuthAppUser,
  };
}
