import { sendHttpOk } from '@-xun/respond';

import { createAnswer, getAnswers } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id/answers',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      sendHttpOk(res, {
        answers: await getAnswers({
          question_id: req.query.question_id?.toString(),
          after_id: req.query.after?.toString()
        })
      });
    } // * POST
    else {
      sendHttpOk(res, {
        answer: await createAnswer({
          question_id: req.query.question_id?.toString(),
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
