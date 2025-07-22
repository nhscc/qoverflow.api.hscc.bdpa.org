[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchUser

# Type Alias: PatchUser

> **PatchUser** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalUser`](InternalUser.md)\>, `"username"` \| `"questionIds"` \| `"answerIds"` \| `"points"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:153](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L153)

The shape of a patch application user.
