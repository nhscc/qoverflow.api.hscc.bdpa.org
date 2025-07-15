[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / VotesUpdateOperation

# Type Alias: VotesUpdateOperation

> **VotesUpdateOperation** = `object`

Defined in: [packages/backend/src/db.ts:105](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/7f72ded3e1b4a649a6466e0d002164176291fadc/packages/backend/src/db.ts#L105)

The shape of an update operation on a question or comment's
upvotes/downvotes.

## Properties

### op

> **op**: `"increment"` \| `"decrement"`

Defined in: [packages/backend/src/db.ts:106](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/7f72ded3e1b4a649a6466e0d002164176291fadc/packages/backend/src/db.ts#L106)

***

### target

> **target**: `"upvotes"` \| `"downvotes"`

Defined in: [packages/backend/src/db.ts:107](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/7f72ded3e1b4a649a6466e0d002164176291fadc/packages/backend/src/db.ts#L107)
