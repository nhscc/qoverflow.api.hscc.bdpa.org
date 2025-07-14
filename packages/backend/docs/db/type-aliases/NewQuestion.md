[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / NewQuestion

# Type Alias: NewQuestion

> **NewQuestion** = `Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"createdAt"` \| `"title-lowercase"` \| `"status"` \| `"hasAcceptedAnswer"` \| `"upvotes"` \| `"upvoterUsernames"` \| `"downvotes"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"comments"` \| `"commentItems"` \| `"views"` \| `"sorter"`\>

Defined in: [packages/backend/src/db.ts:237](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L237)

The shape of a new question.
