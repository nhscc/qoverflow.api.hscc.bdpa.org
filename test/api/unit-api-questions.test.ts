/* eslint-disable @typescript-eslint/no-explicit-any */
import { testApiHandler } from 'next-test-api-route-handler';

import { api, setupMockBackend } from 'testverse/fixtures';

jest.mock('universe/backend');
jest.mock<typeof import('universe/backend/middleware')>(
  'universe/backend/middleware',
  () => {
    const { middlewareFactory } = require('@-xun/api') as typeof import('@-xun/api');
    const { makeMiddleware: makeErrorHandlingMiddleware } =
      require('@-xun/api/middleware/handle-error') as typeof import('@-xun/api/middleware/handle-error');

    return {
      withMiddleware: jest.fn().mockImplementation(
        middlewareFactory({
          use: [],
          useOnError: [makeErrorHandlingMiddleware()],
          options: { legacyMode: true }
        })
      )
    } as unknown as typeof import('universe/backend/middleware');
  }
);

const { mockedGetHowUserVoted } = setupMockBackend();

describe('api/v1/questions', () => {
  describe('/ [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questions,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.question).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/search [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsSearch,
        params: { username: 'User1' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.questions).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });

      await testApiHandler({
        pagesHandler: api.v1.questionsSearch,
        params: {
          username: 'User1',
          after: 'id',
          match: '{"a":1}',
          regexMatch: '{"b":1}'
        },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.questions).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });

      await testApiHandler({
        pagesHandler: api.v1.questionsSearch,
        params: { username: 'User1', match: 'x' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(400);
          expect(json.success).toBeFalse();
          expect(json.error).toBeString();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });

      await testApiHandler({
        pagesHandler: api.v1.questionsSearch,
        params: { username: 'User1', regexMatch: 'x' },
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(400);
          expect(json.success).toBeFalse();
          expect(json.error).toBeString();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionId,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.question).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionId,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/vote/:username [GET]', () => {
    it('accepts GET requests and responds with 200 or 404', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdVoteUsername,
        test: async ({ fetch }) => {
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve(null));
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve('upvoted'));

          const [status1, json1] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          const [status2, json2] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status1).toBe(404);
          expect(json1.success).toBeTrue();
          expect(json1.error).toBeString();
          expect(Object.keys(json1)).toHaveLength(2);

          expect(status2).toBe(200);
          expect(json2.success).toBeTrue();
          expect(json2.vote).toBeString();
          expect(Object.keys(json2)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/vote/:username [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdVoteUsername,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/comments [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdComments,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.comments).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/comments [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdComments,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.comment).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/comments/:comment_id [DELETE]', () => {
    it('accepts DELETE requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdCommentsCommentId,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'DELETE' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/comments/:comment_id/vote/:username [GET]', () => {
    it('accepts GET requests and responds with 200 or 404', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdCommentsCommentIdVoteUsername,
        test: async ({ fetch }) => {
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve(null));
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve('upvoted'));

          const [status1, json1] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          const [status2, json2] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status1).toBe(404);
          expect(json1.success).toBeTrue();
          expect(json1.error).toBeString();
          expect(Object.keys(json1)).toHaveLength(2);

          expect(status2).toBe(200);
          expect(json2.success).toBeTrue();
          expect(json2.vote).toBeString();
          expect(Object.keys(json2)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/comments/:comment_id/vote/:username [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdCommentsCommentIdVoteUsername,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/answers [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswers,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.answers).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswers,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.answer).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerId,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/vote/:username [GET]', () => {
    it('accepts GET requests and responds with 200 or 404', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerIdVoteUsername,
        test: async ({ fetch }) => {
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve(null));
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve('upvoted'));

          const [status1, json1] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          const [status2, json2] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status1).toBe(404);
          expect(json1.success).toBeTrue();
          expect(json1.error).toBeString();
          expect(Object.keys(json1)).toHaveLength(2);

          expect(status2).toBe(200);
          expect(json2.success).toBeTrue();
          expect(json2.vote).toBeString();
          expect(Object.keys(json2)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/vote/:username [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerIdVoteUsername,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/comments [GET]', () => {
    it('accepts GET requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerIdComments,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.comments).toBeArray();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/comments [POST]', () => {
    it('accepts POST requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerIdComments,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'POST' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(json.comment).toBeObject();
          expect(Object.keys(json)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/comments/:comment_id [DELETE]', () => {
    it('accepts DELETE requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler: api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentId,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'DELETE' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/comments/:comment_id/vote/:username [GET]', () => {
    it('accepts GET requests and responds with 200 or 404', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler:
          api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername,
        test: async ({ fetch }) => {
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve(null));
          mockedGetHowUserVoted.mockReturnValueOnce(Promise.resolve('upvoted'));

          const [status1, json1] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          const [status2, json2] = await fetch({ method: 'GET' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status1).toBe(404);
          expect(json1.success).toBeTrue();
          expect(json1.error).toBeString();
          expect(Object.keys(json1)).toHaveLength(2);

          expect(status2).toBe(200);
          expect(json2.success).toBeTrue();
          expect(json2.vote).toBeString();
          expect(Object.keys(json2)).toHaveLength(2);
        }
      });
    });
  });

  describe('/:question_id/answers/:answer_id/comments/:comment_id/vote/:username [PATCH]', () => {
    it('accepts PATCH requests', async () => {
      expect.hasAssertions();

      await testApiHandler({
        pagesHandler:
          api.v1.questionsQuestionIdAnswersAnswerIdCommentsCommentIdVoteUsername,
        test: async ({ fetch }) => {
          const [status, json] = await fetch({ method: 'PATCH' }).then(
            async (r) => [r.status, await r.json()] as [status: number, json: any]
          );

          expect(status).toBe(200);
          expect(json.success).toBeTrue();
          expect(Object.keys(json)).toHaveLength(1);
        }
      });
    });
  });
});
