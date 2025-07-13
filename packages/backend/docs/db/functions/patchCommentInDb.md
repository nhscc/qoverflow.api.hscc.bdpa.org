[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / patchCommentInDb

# Function: patchCommentInDb()

> **patchCommentInDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:829](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L829)

Patches a nested comment object in a question document.

## Parameters

### \_\_namedParameters

#### answerId?

[`AnswerId`](../interfaces/AnswerId.md)

#### commentId

[`CommentId`](../interfaces/CommentId.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

#### updateOps

`Document`

## Returns

`Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>
