import {z} from 'zod'

export type ShorthandPrimitive = typeof String | typeof Number | typeof Boolean
export type ShorthandLiteral = string | number | boolean | null | undefined
export type ShorthandInput =
  | ShorthandPrimitive
  | ShorthandLiteral
  | RegExp
  | typeof Array
  | typeof Object
  | [ShorthandInput]
  | [1, [ShorthandInput]]
  | [2, [ShorthandInput, ShorthandInput]]
  | [3, [ShorthandInput, ShorthandInput, ShorthandInput]]
  | [4, [ShorthandInput, ShorthandInput, ShorthandInput, ShorthandInput]]
  | {[K in string]: ShorthandInput}
  | z.ZodType
z.string().safeParse('')
export type Shorthand<V extends ShorthandInput> = V extends string | number | boolean
  ? z.ZodLiteral<V>
  : V extends null
  ? z.ZodNull
  : V extends undefined
  ? z.ZodUndefined
  : V extends typeof String
  ? z.ZodString
  : V extends typeof Number
  ? z.ZodNumber
  : V extends typeof Boolean
  ? z.ZodBoolean
  : V extends typeof Array
  ? z.ZodArray<z.ZodUnknown>
  : V extends typeof Object
  ? z.ZodRecord<z.KeySchema, z.ZodUnknown>
  : V extends RegExp
  ? z.ZodString
  : V extends [ShorthandInput]
  ? z.ZodArray<Shorthand<V[0]>>
  : V extends [1, [ShorthandInput]]
  ? z.ZodTuple<[Shorthand<V[1][0]>]>
  : V extends [2, [ShorthandInput, ShorthandInput]]
  ? z.ZodTuple<[Shorthand<V[1][0]>, Shorthand<V[1][1]>]>
  : V extends [3, [ShorthandInput, ShorthandInput, ShorthandInput]]
  ? z.ZodTuple<[Shorthand<V[1][0]>, Shorthand<V[1][1]>, Shorthand<V[1][2]>]>
  : V extends [4, [ShorthandInput, ShorthandInput, ShorthandInput, ShorthandInput]]
  ? z.ZodTuple<[Shorthand<V[1][0]>, Shorthand<V[1][1]>, Shorthand<V[1][2]>, Shorthand<V[1][3]>]>
  : V extends z.ZodTypeAny
  ? V
  : V extends Record<string, any>
  ? z.ZodType<{[K in keyof V]: Shorthand<V[K]>['_output']}>
  : never

export type CodecFromShorthand = {
  (): z.ZodUnknown
  <V extends ShorthandInput>(v: V): Shorthand<V>
}

/* eslint-disable complexity */

/**
 * Gets an zod type from a shorthand input:
 *
 * |shorthand|zod type|
 * |-|-|
 * |`String`, `Number`, `Boolean`|`t.string`, `t.number`, `t.boolean`|
 * |Literal raw strings, numbers and booleans e.g. `7` or `'foo'`|`t.literal(7)`, `t.literal('foo')` etc.|
 * |Regexes e.g. `/^foo/`|see [regexp](#regexp)|
 * |`null` and `undefined`|`t.null` and `t.undefined`|
 * |No input (_not_ the same as explicitly passing `undefined`)|`t.unknown`|
 * |Objects e.g. `{ foo: String, bar: { baz: Number } }`|`t.type(...)` e.g. `t.type({foo: t.string, bar: t.type({ baz: t.number }) })`
 * |`Array`|`t.unknownArray`|
 * |`Object`|`t.object`|
 * |One-element arrays e.g. `[String]`|`t.array(...)` e.g. `t.array(t.string)`|
 * |Tuples with explicit length e.g. `[2, [String, Number]]`|`t.tuple` e.g. `t.tuple([t.string, t.number])`|
 * |zod types|unchanged|
 * |Unions, intersections, partials, tuples with more than 3 elements, and other complex types|not supported, except by passing in an zod type|
 */
export const codecFromShorthand: CodecFromShorthand = (...args: unknown[]): any => {
  if (args.length === 0) {
    return z.unknown()
  }

  const v = args[0]
  if (v === String) {
    return z.string()
  }

  if (v === Number) {
    return z.number()
  }

  if (v === Boolean) {
    return z.boolean()
  }

  if (v === Array) {
    return z.array(z.unknown())
  }

  if (v === Object) {
    return z.object({}).passthrough()
  }

  if (v === null) {
    return z.null()
  }

  if (typeof v === 'undefined') {
    return z.undefined()
  }

  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return z.literal(v)
  }

  if (v instanceof RegExp) {
    return z.string().regex(v)
  }

  if (Array.isArray(v) && v.length === 0) {
    return z.array(z.unknown())
  }

  if (Array.isArray(v) && v.length === 1) {
    return z.array(codecFromShorthand(v[0]))
  }

  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && Array.isArray(v[1])) {
    return z.tuple(v[1].map(codecFromShorthand) as any)
  }

  if (Array.isArray(v)) {
    throw new TypeError(
      `Invalid type. Arrays should be in the form \`[shorthand]\`, and tuples should be in the form \`[3, [shorthand1, shorthand2, shorthand3]]\``,
    )
  }

  if (v instanceof z.ZodType) {
    return v
  }

  if (typeof v === 'object' && v) {
    return z.object(
      Object.entries(v).reduce((acc, [prop, val]) => {
        return {...acc, [prop]: codecFromShorthand(val)}
      }, {}),
    )
  }

  return z.unknown()
}
