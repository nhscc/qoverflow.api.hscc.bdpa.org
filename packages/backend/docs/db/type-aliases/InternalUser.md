[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalUser

# Type Alias: InternalUser

> **InternalUser** = `WithId`\<\{ `answerIds`: \[[`QuestionId`](../interfaces/QuestionId.md), [`AnswerId`](../interfaces/AnswerId.md)\][]; `email`: `string`; `key`: `string`; `points`: `number`; `questionIds`: [`QuestionId`](../interfaces/QuestionId.md)[]; `salt`: `string`; `username`: [`Username`](Username.md); \}\>

Defined in: [packages/backend/src/db.ts:121](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/7f72ded3e1b4a649a6466e0d002164176291fadc/packages/backend/src/db.ts#L121)

The shape of an internal application user.
