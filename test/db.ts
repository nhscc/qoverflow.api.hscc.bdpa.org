import { getCommonDummyData } from '@-xun/api-strategy/mongo/dummy';
import { ObjectId } from 'mongodb';

import { mockDateNowMs } from 'testverse:util.ts';

import type { DummyData } from '@-xun/mongo-test';

import type {
  InternalMail,
  InternalQuestion,
  InternalUser
} from '@nhscc/backend-qoverflow/db';

/**
 * Returns data used to hydrate databases and their collections.
 */
export function getDummyData(): DummyData {
  return getCommonDummyData({ app: dummyAppData });
}

/**
 * The shape of the application database's test data.
 */
export type DummyAppData = {
  _generatedAt: number;
  users: InternalUser[];
  mail: InternalMail[];
  questions: InternalQuestion[];
};

// ! Order matters in unit and integration tests, so APPEND ONLY
const users: InternalUser[] = [
  // ? Dummy users' passwords are the same as their usernames
  {
    _id: new ObjectId(),
    username: 'User1',
    salt: '91db41c494502f9ebb6217e4590cccc2',
    key: '17660270f4c4c1741ab9d43e6fb800bc784f0a3bc2f4cd31f0e26bf821ef2ae788f83af134d8c3824f5e0552f8cd432d6b23963d2ffbceb6a7c91b0f59533206',
    email: 'user1@fake-email.com',
    points: 1,
    questionIds: [],
    answerIds: []
  },
  {
    _id: new ObjectId(),
    username: 'User2',
    salt: 'bfe69b665a1ae64bb7d76c32347adecb',
    key: 'e71e8bbd23df52bec8af8280ad7901ddd0ecd5cc43371915f7a95cd17ce0a8515127bfcd433435425c4d245f4a18efcb08e4484682aeb53fcfce5b536d79e4e4',
    email: 'user2@fake-email.com',
    points: 1000,
    questionIds: [],
    answerIds: []
  },
  {
    _id: new ObjectId(),
    username: 'User3',
    salt: '12ef85b518da764294abf0a2095bb5ec',
    key: 'e745893e064e26d4349b1639b1596c14bc9b5d050b56bf31ff3ef0dfce6f959aef8a3722a35bc35b2d142169e75ca3e1967cd6ee4818af0813d8396a724fdd22',
    email: 'user3@fake-email.com',
    points: 100_000,
    questionIds: [],
    answerIds: []
  },
  {
    _id: new ObjectId(),
    username: 'User4',
    salt: '12ef85b518da764294abf0a2095bb5ec',
    key: 'e745893e064e26d4349b1639b1596c14bc9b5d050b56bf31ff3ef0dfce6f959aef8a3722a35bc35b2d142169e75ca3e1967cd6ee4818af0813d8396a724fdd22',
    email: 'user4@fake-email.com',
    points: 100,
    questionIds: [],
    answerIds: []
  }
];

const mail: InternalMail[] = [
  {
    _id: new ObjectId(),
    createdAt: mockDateNowMs - 10_000,
    receiver: 'User1',
    sender: 'User2',
    subject: "You've got mail!",
    text: 'This is a message for **User1**.\n\nBest,\nUser2'
  },
  {
    _id: new ObjectId(),
    createdAt: mockDateNowMs - 1000,
    receiver: 'User1',
    sender: 'User1',
    subject: 'Self-mail',
    text: 'Me? Yes. Hello. Hi.'
  },
  {
    _id: new ObjectId(),
    createdAt: mockDateNowMs - 100_000,
    receiver: 'User2',
    sender: 'User3',
    subject: 'Use snail mail lately?',
    text: 'I think I will continue our correspondence over physical mail now.'
  }
];

const questions: InternalQuestion[] = [
  {
    _id: new ObjectId(),
    creator: 'User1',
    title: 'What is the best server-side language in 2022?',
    'title-lowercase': 'what is the best server-side language in 2022?',
    createdAt: mockDateNowMs - 123_456,
    text: 'There are a lot of popular server-side languages these days. Which one is the best do you think?',
    status: 'open',
    hasAcceptedAnswer: false,
    upvotes: 25,
    upvoterUsernames: [users[1]!.username],
    downvotes: 6,
    downvoterUsernames: [users[2]!.username],
    views: 1024,
    answers: 3,
    answerItems: [
      {
        _id: new ObjectId(),
        creator: 'User2',
        createdAt: mockDateNowMs - 109_584,
        text: 'It has got to be Java.',
        accepted: false,
        upvotes: 4,
        upvoterUsernames: [users[0]!.username],
        downvotes: 1,
        downvoterUsernames: [],
        commentItems: [
          {
            _id: new ObjectId(),
            creator: 'User1',
            createdAt: mockDateNowMs - 108_584,
            text: "It's been around forever though!",
            upvotes: 0,
            upvoterUsernames: [],
            downvotes: 0,
            downvoterUsernames: []
          }
        ]
      },
      {
        _id: new ObjectId(),
        creator: 'User3',
        createdAt: mockDateNowMs - 107_584,
        text: '**Fullstack JavaScript** is da way.',
        accepted: false,
        upvotes: 14,
        upvoterUsernames: [users[0]!.username],
        downvotes: 0,
        downvoterUsernames: [],
        commentItems: [
          {
            _id: new ObjectId(),
            creator: 'User1',
            createdAt: mockDateNowMs - 106_584,
            text: 'This was going to be my answer',
            upvotes: 1,
            upvoterUsernames: [users[1]!.username],
            downvotes: 0,
            downvoterUsernames: []
          },
          {
            _id: new ObjectId(),
            creator: 'User2',
            createdAt: mockDateNowMs - 105_584,
            text: 'JavaScript is just Java + carpet tho',
            upvotes: 0,
            upvoterUsernames: [],
            downvotes: 1,
            downvoterUsernames: [users[2]!.username]
          },
          {
            _id: new ObjectId(),
            creator: 'User1',
            createdAt: mockDateNowMs - 104_584,
            text: "@User2 You mean they're not related?",
            upvotes: 0,
            upvoterUsernames: [users[0]!.username],
            downvotes: 0,
            downvoterUsernames: []
          }
        ]
      },
      {
        _id: new ObjectId(),
        creator: 'User1',
        createdAt: mockDateNowMs - 19_999,
        text: 'Just to provide a potential answer to my own question here:\n\nRust, maybe? Or perhaps I should give Python or Ruby a shot. C# is pretty nice too.',
        accepted: false,
        upvotes: 0,
        upvoterUsernames: [],
        downvotes: 0,
        downvoterUsernames: [],
        commentItems: []
      }
    ],
    comments: 2,
    commentItems: [
      {
        _id: new ObjectId(),
        creator: 'User3',
        createdAt: mockDateNowMs - 103_584,
        text: 'Hmm. I might abuse my points powers and close this question as off topic.',
        upvotes: 0,
        upvoterUsernames: [],
        downvotes: 43,
        downvoterUsernames: [users[0]!.username]
      },
      {
        _id: new ObjectId(),
        creator: 'User1',
        createdAt: mockDateNowMs - 102_584,
        text: 'Please do not close my question :(',
        upvotes: 0,
        upvoterUsernames: [],
        downvotes: 0,
        downvoterUsernames: []
      }
    ],
    sorter: {
      uvc: 1051,
      uvac: 1054
    }
  },
  {
    _id: new ObjectId(),
    creator: 'User1',
    title: 'How do you (as a team) register for the conference?',
    'title-lowercase': 'how do you (as a team) register for the conference?',
    createdAt: mockDateNowMs - 98_765,
    text: 'Hello. I am trying to register for the conference but I am not sure where exactly to go (on the web) or who to talk to. So: how do you register for the conference?',
    status: 'protected',
    hasAcceptedAnswer: true,
    upvotes: 2504,
    upvoterUsernames: [users[1]!.username, users[2]!.username],
    downvotes: 11,
    downvoterUsernames: [],
    views: 8192,
    answers: 1,
    answerItems: [
      {
        _id: new ObjectId(),
        creator: 'User2',
        createdAt: mockDateNowMs - 96_765,
        text: 'Follow [this link](https://bdpa.org/event/bdpacon2022) to the BDPA conference website and you should see all the information you need to register. Is there anything else you were looking for specifically?',
        accepted: true,
        upvotes: 0,
        upvoterUsernames: [],
        downvotes: 0,
        downvoterUsernames: [],
        commentItems: []
      }
    ],
    comments: 1,
    commentItems: [
      {
        _id: new ObjectId(),
        creator: 'User2',
        createdAt: mockDateNowMs - 97_765,
        text: "Make sure to pay attention at the next coordinator's meeting!",
        upvotes: 2,
        upvoterUsernames: [users[2]!.username],
        downvotes: 0,
        downvoterUsernames: []
      }
    ],
    sorter: {
      uvc: 10_697,
      uvac: 10_698
    }
  },
  {
    _id: new ObjectId(),
    creator: 'User2',
    title: 'Where is the NHSCC GitHub page?',
    'title-lowercase': 'where is the nhscc github page?',
    createdAt: mockDateNowMs - 5000,
    text: `As the title says, I'm looking for the BDPA NHSCC GitHub page, but I can't seem to find it. Any help would be appreciated.\n\nAlso: ![XSS attack!]("onerror="alert('your app has been hacked'))`,
    status: 'open',
    hasAcceptedAnswer: false,
    upvotes: 0, // ! For testing purposes, at least 3 questions need 0 upvotes
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: [],
    views: 1,
    answers: 0,
    answerItems: [],
    comments: 0,
    commentItems: [],
    sorter: {
      uvc: 1,
      uvac: 1
    }
  },
  {
    _id: new ObjectId(),
    creator: 'User3',
    title: 'Am I in the future?',
    'title-lowercase': 'am I in the future?',
    createdAt: mockDateNowMs + 60_000,
    text: `For some reason I've created this question a few seconds from now. How is that possible? **HELP ME!**`,
    status: 'closed',
    hasAcceptedAnswer: false,
    upvotes: 0, // ! For testing purposes, at least 3 questions need 0 upvotes
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: [],
    views: 12,
    answers: 0,
    answerItems: [],
    comments: 0,
    commentItems: [],
    sorter: {
      uvc: 12,
      uvac: 12
    }
  },
  {
    _id: new ObjectId(),
    creator: 'User3',
    title: 'Am I still in the future?',
    'title-lowercase': 'am I still in the future?',
    createdAt: mockDateNowMs + 1_234_567,
    text: `### HELP ME I CAN'T GET BACK!`,
    status: 'open',
    hasAcceptedAnswer: true,
    upvotes: 2,
    upvoterUsernames: [users[0]!.username, users[1]!.username],
    downvotes: 1,
    downvoterUsernames: [],
    views: 8,
    answers: 2,
    answerItems: [
      {
        _id: new ObjectId(),
        creator: 'User2',
        createdAt: mockDateNowMs - 1000,
        text: 'You need to go back to the future, bro.',
        accepted: true,
        upvotes: 1,
        upvoterUsernames: [],
        downvotes: 0,
        downvoterUsernames: [],
        commentItems: []
      },
      {
        _id: new ObjectId(),
        creator: 'User1',
        createdAt: mockDateNowMs - 900,
        text: 'When are you?!',
        accepted: true,
        upvotes: 0,
        upvoterUsernames: [],
        downvotes: 1,
        downvoterUsernames: [],
        commentItems: [
          {
            _id: new ObjectId(),
            creator: 'User3',
            createdAt: mockDateNowMs,
            text: "I'm not sure... HALP!",
            upvotes: 0,
            upvoterUsernames: [],
            downvotes: 1,
            downvoterUsernames: []
          }
        ]
      }
    ],
    comments: 0,
    commentItems: [],
    sorter: {
      uvc: 11,
      uvac: 13
    }
  },
  {
    _id: new ObjectId(),
    creator: 'User2',
    title: 'How to export functions from a custom hook',
    'title-lowercase': 'how to export functions from a custom hook',
    createdAt: mockDateNowMs + 65_432,
    text: 'When running `yarn build`, I am faced with this error:\n\n`Objects are not valid as a React child (found: object with keys {func1, func2, func3}). If you meant to render a collection of children, use an array instead.`\n\nMy attempt at solving this was to export my custom hook functions in an array, as the error seemed to suggest.',
    status: 'open',
    hasAcceptedAnswer: false,
    upvotes: 0, // ! For testing purposes, at least 3 questions need 0 upvotes
    upvoterUsernames: [],
    downvotes: 0,
    downvoterUsernames: [],
    views: 24,
    answers: 0,
    answerItems: [],
    comments: 0,
    commentItems: [],
    sorter: {
      uvc: 24,
      uvac: 24
    }
  }
];

users[0]!.questionIds.push(questions[0]!._id, questions[1]!._id);
users[1]!.questionIds.push(questions[2]!._id, questions[5]!._id);
users[2]!.questionIds.push(questions[3]!._id, questions[4]!._id);

users[0]!.answerIds.push(
  [questions[0]!._id, questions[0]!.answerItems[2]!._id],
  [questions[4]!._id, questions[4]!.answerItems[1]!._id]
);

users[1]!.answerIds.push(
  [questions[0]!._id, questions[0]!.answerItems[0]!._id],
  [questions[1]!._id, questions[1]!.answerItems[0]!._id],
  [questions[4]!._id, questions[4]!.answerItems[0]!._id]
);

users[2]!.answerIds.push([questions[0]!._id, questions[0]!.answerItems[1]!._id]);

/**
 * Test data for the application database.
 */
export const dummyAppData: DummyAppData = {
  _generatedAt: mockDateNowMs,
  users,
  mail,
  questions
};
