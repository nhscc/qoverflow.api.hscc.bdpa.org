import { sendHttpOk } from '@-xun/respond';

import { createComment, getComments } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id/comments',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      sendHttpOk(res, {
        comments: await getComments({
          question_id: req.query.question_id?.toString(),
          answer_id: undefined,
          after_id: req.query.after?.toString()
        })
      });
    } // * POST
    else {
      sendHttpOk(res, {
        comment: await createComment({
          question_id: req.query.question_id?.toString(),
          answer_id: undefined,
          data: req.body
        })
      });
    }
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['GET', 'POST'],
      apiVersion: metadata.apiVersion
    }
  }
);
