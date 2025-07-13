[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / removeCommentFromDb

# Function: removeCommentFromDb()

> **removeCommentFromDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:882](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L882)

Deletes a nested comment object from a question document.

## Parameters

### \_\_namedParameters

#### answerId?

[`AnswerId`](../interfaces/AnswerId.md)

#### commentId

[`CommentId`](../interfaces/CommentId.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>
