[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [index](../README.md) / updateQuestion

# Function: updateQuestion()

> **updateQuestion**(`__namedParameters`): `Promise`\<`void`\>

Defined in: [packages/backend/src/index.ts:1098](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/index.ts#L1098)

## Parameters

### \_\_namedParameters

#### data

`undefined` \| `Partial`\<`Omit`\<`WithoutId`\<[`InternalQuestion`](../../db/type-aliases/InternalQuestion.md)\>, `"createdAt"` \| `"creator"` \| `"title-lowercase"` \| `"hasAcceptedAnswer"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"views"` \| `"comments"` \| `"commentItems"` \| `"sorter"`\> & `object`\>

#### question_id

`undefined` \| `string`

## Returns

`Promise`\<`void`\>
