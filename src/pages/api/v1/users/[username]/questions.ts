import { sendHttpOk } from '@-xun/respond';
import { getUserQuestions } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/users/:username/questions',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * GET
    sendHttpOk(res, {
      questions: await getUserQuestions({
        username: req.query.username?.toString(),
        after_id: req.query.after?.toString()
      })
    });
  },
  {
    descriptor: metadata.descriptor,
    options: {
      allowedMethods: ['GET'],
      apiVersion: metadata.apiVersion
    }
  }
);
