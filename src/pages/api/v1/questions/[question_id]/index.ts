import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { getQuestion, updateQuestion } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
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
  { options: { allowedMethods: ['GET', 'PATCH'], apiVersion: '1' } }
);
