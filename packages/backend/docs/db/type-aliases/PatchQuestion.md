[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchQuestion

# Type Alias: PatchQuestion

> **PatchQuestion** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"creator"` \| `"title-lowercase"` \| `"createdAt"` \| `"hasAcceptedAnswer"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"comments"` \| `"commentItems"` \| `"views"` \| `"sorter"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:258](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L258)

The shape of a patch question.
