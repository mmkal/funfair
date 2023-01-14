import {z} from 'zod'
import {codecFromShorthand as shorthand} from '../src'
import {expectTypeOf as e} from 'expect-type'

const expectTypeRuntimeBehaviour = (inverted = false): typeof e => (actual?: any): any => {
  if (typeof actual === 'undefined') {
    return e(actual)
  }
  // eslint-disable-next-line jest/valid-expect
  const jestExpect = (inverted ? (...args) => expect(...args).not : expect) as typeof expect
  const json = (obj: unknown) => JSON.stringify(obj, null, 2)
  const assertions = {
    ...e,
    toEqualTypeOf: (...other: any[]) => {
      if (other.length === 0) {
        return
      }
      jestExpect(json(actual)).toEqual(json(other[0]))
    },
    toMatchTypeOf: (...other: any[]) => {
      if (other.length === 0) {
        return
      }
      jestExpect(json(actual)).toMatchObject(json(other[0]))
    },
    toHaveProperty: (prop: string) => {
      jestExpect(actual).toHaveProperty(prop)
      return expectTypeRuntimeBehaviour(inverted)(actual[prop])
    },
  }
  Object.defineProperty(assertions, 'not', {get: () => expectTypeRuntimeBehaviour(!inverted)(actual)})

  return assertions
}

const expectTypeOf = expectTypeRuntimeBehaviour()

test('nullish types', () => {
  expectTypeOf(shorthand()).toEqualTypeOf(z.unknown())
  expectTypeOf(shorthand(undefined)).toEqualTypeOf(z.undefined())
  expectTypeOf(shorthand(null)).toEqualTypeOf(z.null())
})

test('primitives', () => {
  expectTypeOf(shorthand(String)).toEqualTypeOf(z.string())
  expectTypeOf(shorthand(Number)).toEqualTypeOf(z.number())
  expectTypeOf(shorthand(Boolean)).toEqualTypeOf(z.boolean())
  expectTypeOf(shorthand(z.string())).toEqualTypeOf(z.string())
})

test('literals', () => {
  expectTypeOf(shorthand('hi')).toEqualTypeOf(z.literal('hi'))
  expectTypeOf(shorthand(1)).toEqualTypeOf(z.literal(1))
})

test('objects', () => {
  expectTypeOf(shorthand(Object)).toEqualTypeOf(z.object())
})

test('complex interfaces', () => {
  expectTypeOf(shorthand({foo: String, bar: {baz: Number}})).toEqualTypeOf(
    z.object({foo: z.string(), bar: z.object({baz: z.number()})})
  )
})

test('arrays', () => {
  expectTypeOf(shorthand(Array)).toEqualTypeOf(z.array(z.unknown()))
  // @ts-expect-error
  expectTypeOf(shorthand([])).toEqualTypeOf(z.array(z.unknown()))

  expectTypeOf(shorthand([String])).toEqualTypeOf(z.array(z.string()))
  expectTypeOf(shorthand([[String]])).toEqualTypeOf(z.array(z.array(z.string())))

  expectTypeOf(shorthand([{foo: String}])).toEqualTypeOf(z.array(z.object({foo: z.string()})))
  expectTypeOf(shorthand([[String]])).toEqualTypeOf(z.array(z.array(z.string())))
})

test('tuples', () => {
  expectTypeOf(shorthand([1, [String]])).toEqualTypeOf(z.tuple([z.string()]))

  expectTypeOf(shorthand([2, [String, Number]])).toEqualTypeOf(z.tuple([z.string(), z.number()]))

  expectTypeOf(shorthand([3, [String, Number, String]])).toEqualTypeOf(z.tuple([z.string(), z.number(), z.string()]))

  expectTypeOf(shorthand([4, [String, Number, String, Number]])).toEqualTypeOf(
    z.tuple([z.string(), z.number(), z.string(), z.number()])
  )

  expectTypeOf(shorthand([2, [{foo: [String]}, Number]])).toEqualTypeOf(
    z.tuple([z.object({foo: z.array(z.string())}), z.number()])
  )
})

test(`functions aren't supported`, () => {
  // @ts-expect-error
  expectTypeOf(shorthand(() => 1)).toEqualTypeOf(z.unknown())
})

test(`non-tuple arrays with length greater than one aren't supported`, () => {
  expect(() => {
    // @ts-expect-error
    expectTypeOf(shorthand([1, 2])).toEqualTypeOf(z.never())
  }).toThrowErrorMatchingInlineSnapshot(
    `"Invalid type. Arrays should be in the form \`[shorthand]\`, and tuples should be in the form \`[3, [shorthand1, shorthand2, shorthand3]]\`"`
  )
})