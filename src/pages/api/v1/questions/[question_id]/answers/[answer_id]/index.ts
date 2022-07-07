import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { updateAnswer } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

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
  { options: { allowedMethods: ['PATCH'], apiVersion: '1' } }
);
