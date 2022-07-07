import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { createQuestion } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    // * POST
    sendHttpOk(res, {
      question: await createQuestion({
        data: req.body
      })
    });
  },
  { options: { allowedMethods: ['POST'], apiVersion: '1' } }
);
