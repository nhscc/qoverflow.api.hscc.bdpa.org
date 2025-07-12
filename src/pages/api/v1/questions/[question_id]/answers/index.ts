import { sendHttpOk } from '@-xun/respond';
import { createAnswer, getAnswers } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
      allowedMethods: ['GET', 'POST'],
      apiVersion: metadata.apiVersion
    }
  }
);
