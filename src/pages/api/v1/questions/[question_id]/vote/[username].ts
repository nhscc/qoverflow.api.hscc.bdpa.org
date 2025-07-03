import { sendHttpNotFound, sendHttpOk } from '@-xun/respond';

import { applyVotesUpdateOperation, getHowUserVoted } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id/vote/:username',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      const vote = await getHowUserVoted({
        username: req.query.username?.toString(),
        question_id: req.query.question_id?.toString(),
        answer_id: undefined,
        comment_id: undefined
      });

      if (!vote) {
        sendHttpNotFound(res, {
          success: true,
          error: 'a vote matching this user was not found on this question'
        });
      } else {
        sendHttpOk(res, { vote });
      }
    } // * PATCH
    else {
      await applyVotesUpdateOperation({
        username: req.query.username?.toString(),
        question_id: req.query.question_id?.toString(),
        answer_id: undefined,
        comment_id: undefined,
        operation: {
          op: req.body.operation,
          target: req.body.target
        }
      });

      sendHttpOk(res);
    }
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['GET', 'PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);
