[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [index](../README.md) / searchQuestions

# Function: searchQuestions()

> **searchQuestions**(`__namedParameters`): `Promise`\<[`PublicQuestion`](../../db/type-aliases/PublicQuestion.md)[]\>

Defined in: [packages/backend/src/index.ts:768](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/index.ts#L768)

## Parameters

### \_\_namedParameters

#### after_id

`undefined` \| `string`

#### match

\{[`specifier`: `string`]: `null` \| `string` \| `number` \| `boolean` \| [`SubSpecifierObject`](../type-aliases/SubSpecifierObject.md) \| \{ `$or`: [`SubSpecifierObject`](../type-aliases/SubSpecifierObject.md)[]; \}; \}

#### regexMatch

\{[`specifier`: `string`]: `string`; \}

#### sort

`undefined` \| `string`

## Returns

`Promise`\<[`PublicQuestion`](../../db/type-aliases/PublicQuestion.md)[]\>
