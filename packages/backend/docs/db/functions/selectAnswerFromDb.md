[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / selectAnswerFromDb

# Function: selectAnswerFromDb()

> **selectAnswerFromDb**\<`T`\>(`__namedParameters`): `Promise`\<`T`\>

Defined in: [packages/backend/src/db.ts:691](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L691)

Returns a nested answer object via aggregation pipeline, optionally applying
a projection to the result.

## Type Parameters

### T

`T` = `null` \| [`InternalAnswer`](../type-aliases/InternalAnswer.md)

## Parameters

### \_\_namedParameters

#### answer_creator?

`string`

#### answerId?

[`AnswerId`](../interfaces/AnswerId.md)

#### projection?

[`Projection`](../type-aliases/Projection.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`Promise`\<`T`\>
