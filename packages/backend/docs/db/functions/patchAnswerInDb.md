[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / patchAnswerInDb

# Function: patchAnswerInDb()

> **patchAnswerInDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:808](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L808)

Patches a nested answer object in a question document.

## Parameters

### \_\_namedParameters

#### answerId

[`AnswerId`](../interfaces/AnswerId.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

#### updateOps

`Document`

## Returns

`Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>
