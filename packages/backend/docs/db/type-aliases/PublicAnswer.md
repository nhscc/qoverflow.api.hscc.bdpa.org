[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PublicAnswer

# Type Alias: PublicAnswer

> **PublicAnswer** = `Omit`\<`WithoutId`\<[`InternalAnswer`](InternalAnswer.md)\>, `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"commentItems"`\> & `object`

Defined in: [packages/backend/src/db.ts:294](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L294)

The shape of a public answer.

## Type declaration

### answer\_id

> **answer\_id**: `string`

### comments

> **comments**: `number`

### question\_id

> **question\_id**: `string`
