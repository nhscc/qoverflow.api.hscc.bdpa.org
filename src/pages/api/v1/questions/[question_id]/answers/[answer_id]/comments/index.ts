import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { createComment, getComments } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
      sendHttpOk(res, {
        comments: await getComments({
          question_id: req.query.question_id?.toString(),
          answer_id: req.query.answer_id?.toString(),
          after_id: req.query.after?.toString()
        })
      });
    } // * POST
    else {
      sendHttpOk(res, {
        comment: await createComment({
          question_id: req.query.question_id?.toString(),
          answer_id: req.query.answer_id?.toString(),
          data: req.body
        })
      });
    }
  },
  { options: { allowedMethods: ['GET', 'POST'], apiVersion: '1' } }
);
