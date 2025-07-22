[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalComment

# Type Alias: InternalComment

> **InternalComment** = `WithId`\<\{ `createdAt`: `UnixEpochMs`; `creator`: [`Username`](Username.md); `downvoterUsernames`: [`Username`](Username.md)[]; `downvotes`: `number`; `text`: `string`; `upvoterUsernames`: [`Username`](Username.md)[]; `upvotes`: `number`; \}\>

Defined in: [packages/backend/src/db.ts:330](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L330)

The shape of an internal comment.
