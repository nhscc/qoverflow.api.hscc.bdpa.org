[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [index](../README.md) / updateAnswer

# Function: updateAnswer()

> **updateAnswer**(`__namedParameters`): `Promise`\<`void`\>

Defined in: [packages/backend/src/index.ts:1412](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/index.ts#L1412)

## Parameters

### \_\_namedParameters

#### answer_id

`undefined` \| `string`

#### data

`undefined` \| `Partial`\<`Omit`\<`WithoutId`\<[`InternalAnswer`](../../db/type-aliases/InternalAnswer.md)\>, `"createdAt"` \| `"creator"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"commentItems"`\>\>

#### question_id

`undefined` \| `string`

## Returns

`Promise`\<`void`\>
