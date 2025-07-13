[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / addAnswerToDb

# Function: addAnswerToDb()

> **addAnswerToDb**(`__namedParameters`): `Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>

Defined in: [packages/backend/src/db.ts:737](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L737)

Adds a nested answer object to a question document.

## Parameters

### \_\_namedParameters

#### answer

[`InternalAnswer`](../type-aliases/InternalAnswer.md)

#### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`Promise`\<`UpdateResult`\<[`InternalQuestion`](../type-aliases/InternalQuestion.md)\>\>
