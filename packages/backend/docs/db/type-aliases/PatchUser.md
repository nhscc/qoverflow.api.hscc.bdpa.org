[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchUser

# Type Alias: PatchUser

> **PatchUser** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalUser`](InternalUser.md)\>, `"username"` \| `"questionIds"` \| `"answerIds"` \| `"points"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:153](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L153)

The shape of a patch application user.
