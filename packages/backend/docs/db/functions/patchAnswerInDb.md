[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / patchAnswerInDb

# Function: patchAnswerInDb()

> **patchAnswerInDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:808](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L808)

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
