import { GuruMeditationError } from 'named-app-errors';
import { toss } from 'toss-expression';

import type { RequestInspector } from 'multiverse/throttled-fetch';

type RequestLike = { url: string | URL };

const idToInt = (id: string) => {
  return Number.parseInt(
    id
      .split('-')
      .at(-1)!
      .replace(/[^0-9]/g, '')
  );
};

const reqParamToNumber = (req: RequestLike, parameter: string) => {
  return Number.parseInt(
    new URL(req.url).searchParams.get(parameter) ||
      toss(new GuruMeditationError(`missing ${parameter} parameter`))
  );
};

export const dummyRequestInspector: RequestInspector = ({ requestInfo }) => {
  const url = new URL(requestInfo.toString());

  if (/\/questions\//.test(url.pathname)) {
    if (/\/answers/.test(url.pathname)) {
      return getDummyQuestionAnswers({ url });
    } else {
      return getDummyQuestionComments({ url });
    }
  } else if (/\/answers\//.test(url.pathname)) {
    return getDummyAnswerComments({ url });
  } else if (/\/questions/.test(url.pathname)) {
    return getDummyQuestions({ url });
  } else if (/\/answers/.test(url.pathname)) {
    return getDummyAnswers({ url });
  } else if (/\/comments/.test(url.pathname)) {
    return getDummyComments({ url });
  } else {
    throw new GuruMeditationError('unknown request url');
  }
};

export const getDummyQuestionAnswers = (req: RequestLike) => {
  const question_id =
    req.url.toString().match(/questions\/([^/]+)\/answers/)?.[1] ||
    toss(new GuruMeditationError('id not found'));

  const idInt = idToInt(question_id);
  const numPages = idInt % 75 == 0 ? 3 : idInt % 50 == 0 ? 2 : 1;
  const pageParam = reqParamToNumber(req, 'page');
  const pageSizeParam = reqParamToNumber(req, 'pagesize');

  const startCount = (pageParam - 1) * pageSizeParam;
  const has_more = pageParam < numPages;

  return {
    items: Array.from({
      length: has_more ? pageSizeParam : (idInt % pageSizeParam) + 1
    }).map((_, ndx) => {
      const count = startCount + ndx;
      const answer_id = `${question_id}-a${count}`;

      return {
        owner: {
          display_name: `user-a${count}`,
          reputation: count
        },
        is_accepted: count % 2 ? true : false,
        score: count % 2 ? count : -count,
        creation_date: count,
        answer_id,
        question_id,
        body: `body-${answer_id}`
      };
    }),
    has_more
  };
};

export const getDummyQuestionComments = (req: RequestLike) => {
  const question_id =
    req.url.toString().match(/questions\/([^/]+)\/comments/)?.[1] ||
    toss(new GuruMeditationError('id not found'));

  const idInt = idToInt(question_id);
  const numPages = idInt % 25 == 0 ? 2 : 1;
  const pageParam = reqParamToNumber(req, 'page');
  const pageSizeParam = reqParamToNumber(req, 'pagesize');

  const startCount = (pageParam - 1) * pageSizeParam;
  const has_more = pageParam < numPages;

  return {
    items: Array.from({
      length: has_more ? pageSizeParam : (idInt % pageSizeParam) - 1
    }).map((_, ndx) => {
      const count = startCount + ndx;
      const comment_id = `${question_id}-c${count}`;

      return {
        owner: {
          display_name: `user-${question_id}`,
          reputation: count
        },
        score: count % 2 ? count : -count,
        creation_date: count,
        comment_id,
        body: `body-${comment_id}`
      };
    }),
    has_more
  };
};

export const getDummyAnswerComments = (req: RequestLike) => {
  const answer_id =
    req.url.toString().match(/answers\/([^/]+)\/comments/)?.[1] ||
    toss(new GuruMeditationError('id not found'));

  const idInt = idToInt(answer_id);
  const numPages = 1;
  const pageParam = reqParamToNumber(req, 'page');
  const pageSizeParam = reqParamToNumber(req, 'pagesize');

  const startCount = (pageParam - 1) * pageSizeParam;
  const has_more = pageParam < numPages;

  return {
    items: Array.from({
      length: has_more ? pageSizeParam : (idInt % pageSizeParam) - 1
    }).map((_, ndx) => {
      const count = startCount + ndx;
      const comment_id = `${answer_id}-c${count}`;

      return {
        owner: {
          display_name: `user-${answer_id}`,
          reputation: count
        },
        score: count % 2 ? count : -count,
        creation_date: count,
        comment_id,
        body: `body-${comment_id}`
      };
    }),
    has_more
  };
};

export const getDummyQuestions = (req: RequestLike) => {
  const pageSizeParam = reqParamToNumber(req, 'pagesize');
  const startCount = (reqParamToNumber(req, 'page') - 1) * pageSizeParam;

  return {
    items: Array.from({ length: pageSizeParam }).map((_, ndx) => {
      const count = startCount + ndx;
      const question_id = `q${count}`;

      return {
        owner: { display_name: `user-${question_id}`, reputation: count },
        is_answered: count % 2 ? true : false,
        view_count: count,
        answer_count: count,
        score: count % 2 ? count : -count,
        creation_date: count,
        question_id,
        title: `title-${question_id}`,
        body: `body-${question_id}`
      };
    }),
    has_more: true
  };
};

export const getDummyAnswers = (req: RequestLike) => {
  const pageSizeParam = reqParamToNumber(req, 'pagesize');
  const startCount = (reqParamToNumber(req, 'page') - 1) * pageSizeParam;

  return {
    items: Array.from({ length: pageSizeParam }).map((_, ndx) => {
      const count = startCount + ndx;
      const answer_id = `a${count}`;

      return {
        owner: { display_name: `user-${answer_id}`, reputation: count },
        is_accepted: count % 2 ? true : false,
        score: count % 2 ? count : -count,
        creation_date: count,
        answer_id,
        question_id: count,
        body: `body-${answer_id}`
      };
    }),
    has_more: true
  };
};

export const getDummyComments = (req: RequestLike) => {
  const pageSizeParam = reqParamToNumber(req, 'pagesize');
  const startCount = (reqParamToNumber(req, 'page') - 1) * pageSizeParam;

  return {
    items: Array.from({ length: pageSizeParam }).map((_, ndx) => {
      const count = startCount + ndx;
      const comment_id = `c${count}`;

      return {
        owner: { display_name: `user-${comment_id}`, reputation: count },
        score: count % 2 ? count : -count,
        creation_date: count,
        comment_id,
        body: `body-${comment_id}`
      };
    }),
    has_more: true
  };
};
