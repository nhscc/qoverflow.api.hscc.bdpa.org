[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / NewQuestion

# Type Alias: NewQuestion

> **NewQuestion** = `Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"createdAt"` \| `"title-lowercase"` \| `"status"` \| `"hasAcceptedAnswer"` \| `"upvotes"` \| `"upvoterUsernames"` \| `"downvotes"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"comments"` \| `"commentItems"` \| `"views"` \| `"sorter"`\>

Defined in: [packages/backend/src/db.ts:237](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L237)

The shape of a new question.
