import { sendHttpOk } from '@-xun/respond';
import { createMessage } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/mail',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * POST
    sendHttpOk(res, {
      message: await createMessage({
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
