[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PublicQuestion

# Type Alias: PublicQuestion

> **PublicQuestion** = `Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"title-lowercase"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"answerItems"` \| `"commentItems"` \| `"sorter"`\> & `object`

Defined in: [packages/backend/src/db.ts:222](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L222)

The shape of a public question.

## Type declaration

### question\_id

> **question\_id**: `string`
