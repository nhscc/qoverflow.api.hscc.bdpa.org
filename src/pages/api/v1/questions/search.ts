import { sendHttpOk } from '@-xun/respond';

import { searchQuestions } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';
import { ClientValidationError, ErrorMessage } from 'universe/error';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/questions/search',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    const match = (() => {
      try {
        return JSON.parse((req.query.match || '{}').toString());
      } catch {
        throw new ClientValidationError(ErrorMessage.InvalidMatcher('match'));
      }
    })();

    const regexMatch = (() => {
      try {
        return JSON.parse((req.query.regexMatch || '{}').toString());
      } catch {
        throw new ClientValidationError(ErrorMessage.InvalidMatcher('regexMatch'));
      }
    })();

    // * GET
    sendHttpOk(res, {
      questions: await searchQuestions({
        after_id: req.query.after?.toString(),
        match,
        regexMatch,
        sort: req.query.sort?.toString()
      })
    });
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['GET'],
      apiVersion: metadata.apiVersion
    }
  }
);
