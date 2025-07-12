import { sendHttpOk } from '@-xun/respond';
import { createQuestion } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/questions',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * POST
    sendHttpOk(res, {
      question: await createQuestion({
        data: req.body
      })
    });
  },
  {
    descriptor: metadata.descriptor,
    options: {
      allowedMethods: ['POST'],
      apiVersion: metadata.apiVersion
    }
  }
);
