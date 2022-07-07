import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { deleteComment } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    // * DELETE
    await deleteComment({
      question_id: req.query.question_id?.toString(),
      answer_id: undefined,
      comment_id: req.query.comment_id?.toString()
    });

    sendHttpOk(res);
  },
  { options: { allowedMethods: ['DELETE'], apiVersion: '1' } }
);
