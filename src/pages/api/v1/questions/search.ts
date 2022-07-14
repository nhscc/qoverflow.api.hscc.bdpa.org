import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { searchQuestions } from 'universe/backend';
import { ErrorMessage, ValidationError } from 'universe/error';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/questions/search'
};

export default withMiddleware(
  async (req, res) => {
    const match = (() => {
      try {
        return JSON.parse((req.query.match || '{}').toString());
      } catch {
        throw new ValidationError(ErrorMessage.InvalidMatcher('match'));
      }
    })();

    const regexMatch = (() => {
      try {
        return JSON.parse((req.query.regexMatch || '{}').toString());
      } catch {
        throw new ValidationError(ErrorMessage.InvalidMatcher('regexMatch'));
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
    options: { allowedMethods: ['GET'], apiVersion: '1' }
  }
);
