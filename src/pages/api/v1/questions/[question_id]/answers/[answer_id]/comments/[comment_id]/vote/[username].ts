import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpNotFound, sendHttpOk } from 'multiverse/next-api-respond';
import { applyVotesUpdateOperation, getHowUserVoted } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor:
    '/questions/:question_id/answers/:answer_id/comments/:comment_id/vote/:username'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
      const vote = await getHowUserVoted({
        username: req.query.username?.toString(),
        question_id: req.query.question_id?.toString(),
        answer_id: req.query.answer_id?.toString(),
        comment_id: req.query.comment_id?.toString()
      });

      if (!vote) {
        sendHttpNotFound(res, {
          success: true,
          error: 'a vote matching this user was not found on this comment'
        });
      } else {
        sendHttpOk(res, { vote });
      }
    } // * PATCH
    else {
      await applyVotesUpdateOperation({
        username: req.query.username?.toString(),
        question_id: req.query.question_id?.toString(),
        answer_id: req.query.answer_id?.toString(),
        comment_id: req.query.comment_id?.toString(),
        operation: {
          op: req.body.operation,
          target: req.body.target
        }
      });

      sendHttpOk(res);
    }
  },
  {
    descriptor: metadata.descriptor,
    options: { allowedMethods: ['GET', 'PATCH'], apiVersion: '1' }
  }
);
