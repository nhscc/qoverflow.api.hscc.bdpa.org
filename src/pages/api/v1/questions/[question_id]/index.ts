import { sendHttpOk } from '@-xun/respond';

import { getQuestion, updateQuestion } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      sendHttpOk(res, {
        question: await getQuestion({
          question_id: req.query.question_id?.toString()
        })
      });
    } // * PATCH
    else {
      await updateQuestion({
        question_id: req.query.question_id?.toString(),
        data: req.body
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
