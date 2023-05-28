import { ErrorMessage as NamedErrorMessage } from 'named-app-errors';

export * from 'named-app-errors';

/**
 * A collection of possible error and warning messages.
 */
/* istanbul ignore next */
export const ErrorMessage = {
  ...NamedErrorMessage,
  DuplicateFieldValue: (property: string) =>
    `an item with that "${property}" already exists`,
  InvalidFieldValue: (
    property: string,
    value?: string,
    validValues?: readonly string[]
  ) =>
    `\`${property}\` field has ${
      value
        ? `invalid or illegal value "${value}"`
        : 'a missing, invalid, or illegal value'
    }${validValues ? `. Valid values: ${validValues.join(', ')}` : ''}`,
  InvalidArrayValue: (
    property: string,
    value: string,
    validValues?: readonly string[]
  ) =>
    `the \`${property}\` array element "${value}" is invalid or illegal${
      validValues ? `. Valid values: ${validValues.join(', ')}` : ''
    }`,
  InvalidObjectKeyValue: (
    property: string,
    value?: string,
    validValues?: readonly string[]
  ) =>
    `a \`${property}\` object key has ${
      value
        ? `invalid or illegal value "${value}"`
        : 'a missing, invalid, or illegal value'
    }${validValues ? `. Valid values: ${validValues.join(', ')}` : ''}`,
  InvalidJSON: () => 'encountered invalid JSON',
  InvalidNumberValue: (
    property: string,
    min: number | string,
    max: number | string | null,
    type: 'number' | 'integer',
    nullable = false,
    isArray = false
  ) =>
    `${isArray ? `each \`${property}\` element` : `\`${property}\``} must be a${
      type == 'integer' ? 'n integer' : ' number'
    } ${max ? `between ${min} and ${max} (inclusive)` : `>= ${min}`}${
      nullable ? ' or null' : ''
    }`,
  InvalidStringLength: (
    property: string,
    min: number | string,
    max: number | string | null,
    syntax: 'string' | 'alphanumeric' | 'hexadecimal' | 'bytes',
    nullable = false,
    isArray = false
  ) =>
    `${isArray ? `each \`${property}\` element` : `\`${property}\``} must be a${
      syntax == 'alphanumeric'
        ? 'n alphanumeric'
        : syntax == 'hexadecimal'
        ? ' hexadecimal'
        : ''
    } ${
      max
        ? `string between ${min} and ${max} ${
            syntax == 'bytes' ? 'byte' : 'character'
          }s (inclusive)`
        : `${min} ${syntax == 'bytes' ? 'byte' : 'character'} string`
    }${nullable ? ' or null' : ''}`,
  InvalidObjectId: (id: string) => `invalid id "${id}"`,
  UnknownField: (property: string) =>
    `encountered unknown or illegal field \`${property}\``,
  UnknownSpecifier: (property: string, sub = false) =>
    `encountered unknown or illegal ${sub ? 'sub-' : ''}specifier \`${property}\``,
  InvalidSpecifierValueType: (property: string, type: string, sub = false) =>
    `\`${property}\` has invalid ${
      sub ? 'sub-' : ''
    }specifier value type (must be ${type})`,
  InvalidRegexString: (property: string) =>
    `\`${property}\` has invalid or illegal regex value`,
  InvalidMatcher: (property: string) => `invalid \`${property}\`: must be object`,
  InvalidOrSpecifier: () =>
    'invalid "$or" sub-specifier: must be array with exactly two elements',
  InvalidOrSpecifierNonObject: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: all array elements must be objects`,
  InvalidOrSpecifierBadLength: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: only one sub-specifier allowed per array element`,
  InvalidOrSpecifierInvalidKey: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: invalid sub-key "${key}"`,
  InvalidOrSpecifierInvalidValueType: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: sub-key "${key}" has invalid value type (must be number)`,
  UserAlreadyAnswered: () => 'cannot answer the same question more than once',
  QuestionAlreadyAcceptedAnswer: () => 'question already has an accepted answer',
  DuplicateIncrementOperation: () =>
    'cannot execute duplicate increment without preceding decrement',
  InvalidDecrementOperation: () =>
    'cannot execute decrement on this target without preceding increment',
  MultipleIncrementTargets: () =>
    'cannot execute increment without preceding decrement on other target',
  MultitargetDecrement: () =>
    'cannot execute decrement while other target is incremented',
  IllegalOperation: () =>
    'this user is not authorized to execute operations on this item'
};
