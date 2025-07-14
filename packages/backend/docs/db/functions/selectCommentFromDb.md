[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / selectCommentFromDb

# Function: selectCommentFromDb()

> **selectCommentFromDb**\<`T`\>(`__namedParameters`): `Promise`\<`T`\>

Defined in: [packages/backend/src/db.ts:715](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L715)

Returns a nested comment object via aggregation pipeline, optionally applying
a projection to the result.

## Type Parameters

### T

`T` = `null` \| [`InternalComment`](../type-aliases/InternalComment.md)

## Parameters

### \_\_namedParameters

#### answerId?

[`AnswerId`](../interfaces/AnswerId.md)

#### commentId

[`CommentId`](../interfaces/CommentId.md)

#### projection?

[`Projection`](../type-aliases/Projection.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`Promise`\<`T`\>
