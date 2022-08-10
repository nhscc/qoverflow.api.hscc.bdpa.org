export const STACKX_API_URI = 'https://api.stackexchange.com/2.3';
//export const STACKX_API_URI = 'http://0.0.0.0:8000';
export const STACKX_API_SHARED_PARAMS = 'site=stackoverflow&filter=withbody';

const uriBuilder = (endpoint: string, params: string) =>
  `${STACKX_API_URI}/${endpoint}?${STACKX_API_SHARED_PARAMS}&${params}`;

/**
 * Represents the StackExchange API interface.
 */
export type Api = {
  questions: {
    (params: { page: number; pageSize: number }): string;
    answers: (params: {
      question_id: number;
      page: number;
      pageSize: number;
    }) => string;
    comments: (params: {
      question_id: number;
      page: number;
      pageSize: number;
    }) => string;
  };

  answers: {
    (params: { page: number; pageSize: number }): string;
    comments: (params: {
      answer_id: number;
      page: number;
      pageSize: number;
    }) => string;
  };

  comments: (params: { page: number; pageSize: number }) => string;
};

/**
 * Get StackExchange API endpoint URIs with respect to authentication
 * credentials and pagination parameters.
 */
export const getApi = (stackExAuthKey: string) => {
  const api: Api = {
    questions: (({ page, pageSize }) =>
      uriBuilder(
        'questions',
        `sort=votes&order=desc&tagged=javascript&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
      )) as Api['questions'],
    answers: (({ page, pageSize }) =>
      uriBuilder(
        'answers',
        `sort=votes&order=desc&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
      )) as Api['answers'],
    comments: ({ page, pageSize }) =>
      uriBuilder(
        'comments',
        `sort=votes&order=desc&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
      )
  };

  api.questions.answers = ({ question_id, page, pageSize }) =>
    uriBuilder(
      `questions/${question_id}/answers`,
      `sort=creation&order=asc&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
    );

  api.questions.comments = ({ question_id, page, pageSize }) =>
    uriBuilder(
      `questions/${question_id}/comments`,
      `sort=creation&order=asc&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
    );

  api.answers.comments = ({ answer_id, page, pageSize }) =>
    uriBuilder(
      `answers/${answer_id}/comments`,
      `sort=creation&order=asc&page=${page}&pagesize=${pageSize}&key=${stackExAuthKey}`
    );

  return api;
};
