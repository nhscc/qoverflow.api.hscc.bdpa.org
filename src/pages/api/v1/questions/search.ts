import { sendHttpOk } from '@-xun/respond';
import { searchQuestions } from '@nhscc/backend-qoverflow~npm';

import { ClientValidationError, ErrorMessage } from 'multiverse+shared:error.ts';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
      allowedMethods: ['GET'],
      apiVersion: metadata.apiVersion
    }
  }
);
