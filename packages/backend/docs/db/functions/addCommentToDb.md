[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / addCommentToDb

# Function: addCommentToDb()

> **addCommentToDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:758](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L758)

Adds a nested comment object to a question document.

## Parameters

### \_\_namedParameters

#### answerId?

[`AnswerId`](../interfaces/AnswerId.md)

#### comment

[`InternalComment`](../type-aliases/InternalComment.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>
