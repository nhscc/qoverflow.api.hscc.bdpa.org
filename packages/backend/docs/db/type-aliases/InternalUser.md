[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalUser

# Type Alias: InternalUser

> **InternalUser** = `WithId`\<\{ `answerIds`: \[[`QuestionId`](../interfaces/QuestionId.md), [`AnswerId`](../interfaces/AnswerId.md)\][]; `email`: `string`; `key`: `string`; `points`: `number`; `questionIds`: [`QuestionId`](../interfaces/QuestionId.md)[]; `salt`: `string`; `username`: [`Username`](Username.md); \}\>

Defined in: [packages/backend/src/db.ts:121](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L121)

The shape of an internal application user.
