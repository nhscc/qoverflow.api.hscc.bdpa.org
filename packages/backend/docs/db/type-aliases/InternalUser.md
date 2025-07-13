[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalUser

# Type Alias: InternalUser

> **InternalUser** = `WithId`\<\{ `answerIds`: \[[`QuestionId`](../interfaces/QuestionId.md), [`AnswerId`](../interfaces/AnswerId.md)\][]; `email`: `string`; `key`: `string`; `points`: `number`; `questionIds`: [`QuestionId`](../interfaces/QuestionId.md)[]; `salt`: `string`; `username`: [`Username`](Username.md); \}\>

Defined in: [packages/backend/src/db.ts:121](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L121)

The shape of an internal application user.
