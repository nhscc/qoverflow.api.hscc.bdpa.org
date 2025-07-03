import { sendHttpOk } from '@-xun/respond';

import { updateAnswer } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id/answers/:answer_id',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * PATCH
    await updateAnswer({
      question_id: req.query.question_id?.toString(),
      answer_id: req.query.answer_id?.toString(),
      data: req.body
    });

    sendHttpOk(res);
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);
