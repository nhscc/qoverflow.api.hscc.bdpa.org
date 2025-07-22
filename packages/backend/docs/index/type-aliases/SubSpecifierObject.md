[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [index](../README.md) / SubSpecifierObject

# Type Alias: SubSpecifierObject

> **SubSpecifierObject** = \{ \[subspecifier in "$gt" \| "$lt" \| "$gte" \| "$lte"\]?: number \}

Defined in: [packages/backend/src/index.ts:121](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/index.ts#L121)

Whitelisted MongoDB-esque sub-specifiers that can be used with
`searchQuestions()` via the "$or" sub-matcher.
