import { sendHttpOk } from '@-xun/respond';
import { deleteComment } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/questions/:question_id/answers/:answer_id/comments/:comment_id',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * DELETE
    await deleteComment({
      question_id: req.query.question_id?.toString(),
      answer_id: req.query.answer_id?.toString(),
      comment_id: req.query.comment_id?.toString()
    });

    sendHttpOk(res);
  },
  {
    descriptor: metadata.descriptor,
    options: {
      allowedMethods: ['DELETE'],
      apiVersion: metadata.apiVersion
    }
  }
);
