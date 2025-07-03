import { sendHttpOk } from '@-xun/respond';

import { createQuestion } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

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
      requiresAuth: true,
      allowedMethods: ['POST'],
      apiVersion: metadata.apiVersion
    }
  }
);
