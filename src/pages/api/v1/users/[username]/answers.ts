import { sendHttpOk } from '@-xun/respond';
import { getUserAnswers } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/users/:username/answers',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * GET
    sendHttpOk(res, {
      answers: await getUserAnswers({
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
