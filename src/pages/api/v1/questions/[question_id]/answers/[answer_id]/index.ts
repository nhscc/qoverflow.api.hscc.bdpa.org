import { sendHttpOk } from '@-xun/respond';
import { updateAnswer } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
      allowedMethods: ['PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);
