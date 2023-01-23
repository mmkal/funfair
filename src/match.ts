import {z} from 'zod'
// import type * as Either from './Either'
import {codecFromShorthand} from './shorthand'
import type {ShorthandInput, Shorthand} from './shorthand'
import {RichError} from './util'
import type {IsNeverOrAny} from './util'

/** Not a real type that anything will have at runtime. Just a way of giving helpful compiler errors. */
type UnionOfCasesDoesNotMatchExpected<InSoFar, In> = {
  /** compile time only. basically a fake property to signal at compile time that you didn't exhaustively match before calling `.get`. Don't try to use this value, it won't exist! */
  _message: 'type union of inputs for cases does not match expected input type. try adding more case statements or use .default(...)'
  /** compile time only. basically a fake property to signal at compile time that you didn't exhaustively match before calling `.get`. Don't try to use this value, it won't exist! */
  _actual: InSoFar
  /** compile time only. basically a fake property to signal at compile time that you didn't exhaustively match before calling `.get`. Don't try to use this value, it won't exist! */
  _expected: In
  /** compile time only. basically a fake property to signal at compile time that you didn't exhaustively match before calling `.get`. Don't try to use this value, it won't exist! */
  _unhandled: Exclude<In, InSoFar>
}

type Mappable<In, NextIn> = IsNeverOrAny<In> extends 1 ? NextIn : Extract<In, NextIn>

interface MatcherBuilder<In, InSoFar, Out> {
  case: {
    // refinement overload: no way to identify a refinement type in Zod!
    // <NextIn, MapperIn extends Mappable<In, NextIn>, NextOut>(
    //   type: z.ZodType<NextIn>,
    //   map: (obj: MapperIn) => NextOut,
    // ): MatcherBuilder<In, InSoFar, Out | NextOut>

    <const NextIn extends ShorthandInput, NextOut>(
      shorthand: NextIn,
      map: (obj: Mappable<In, Shorthand<NextIn>['_output']>) => NextOut,
    ): MatcherBuilder<In, InSoFar | Shorthand<NextIn>['_output'], Out | NextOut>

    <NextIn extends ShorthandInput, NextOut>(
      shorthand: NextIn,
      predicate: (value: Shorthand<NextIn>['_output']) => boolean,
      map: (obj: Mappable<In, Shorthand<NextIn>['_output']>) => NextOut,
    ): MatcherBuilder<In, InSoFar | Shorthand<NextIn>['_output'], Out | NextOut>
  }
  default: <NextOut>(map: (obj: In) => NextOut) => MatcherBuilder<In, any, Out | NextOut>
  get: IsNeverOrAny<Exclude<In, InSoFar>> extends 1
    ? (obj: InSoFar) => Out
    : UnionOfCasesDoesNotMatchExpected<InSoFar, In>
  //   tryGet: (obj: In) => Hopefully<Out>
}

interface PatternMatchBuilder<Input, InputsCovered, Output> {
  _types?: {
    Input: Input
    InputsCovered: InputsCovered
    Output: Output
    Getable: Exclude<Input, InputsCovered>
    Ready: IsNeverOrAny<Exclude<Input, InputsCovered>>
  }
  case: {
    // refinement overload
    // <NextIn, NextOut>(
    // todo: handle refinement types and don't consider them covered
    //   type: z.ZodRefinement<z.ZodType<NextIn>>,
    //   map: (obj: Mappable<Input, NextIn>) => NextOut,
    // ): PatternMatchBuilder<Input, InputsCovered | NextIn, Output | NextOut> //

    <NextIn extends ShorthandInput, NextOut>(
      shorthand: NextIn,
      map: (obj: Mappable<Input, Shorthand<NextIn>['_output']>) => NextOut,
    ): PatternMatchBuilder<Input, InputsCovered | Shorthand<NextIn>['_output'], Output | NextOut>

    // with refinement predicate overload
    <NextIn extends ShorthandInput, NextOut>(
      shorthand: NextIn,
      predicate: (value: Shorthand<NextIn>['_output']) => boolean,
      map: (obj: Mappable<Input, Shorthand<NextIn>['_output']>) => NextOut,
    ): PatternMatchBuilder<Input, InputsCovered | Shorthand<NextIn>['_output'], Output | NextOut>
  }
  default: <NextOut>(map: (obj: Input) => NextOut) => PatternMatchBuilder<Input, any, Output | NextOut>
  get: IsNeverOrAny<Exclude<Input, InputsCovered>> extends 1
    ? () => Output
    : UnionOfCasesDoesNotMatchExpected<InputsCovered, Input>
}

type UnknownFn = (obj: unknown) => unknown
type Cases = Array<[z.ZodType, UnknownFn]>

// const maybeMatchObject = (obj: any, cases: Cases) => {
//   for (const [type, map] of cases) {
//     const decoded = type.safeParse(obj)
//     if (decoded.success) {
//       return Either.right(map(decoded.data))
//     }
//   }

//   return Either.left({noMatchFoundFor: obj, types: cases.map(c => c[0])})
// }

const matchObject = (obj: any, cases: Cases) => {
  //   const either = maybeMatchObject(obj, cases)
  //   if (either._tag === 'Right') {
  //     return either.right
  //   }
  for (const [type, map] of cases) {
    const decoded = type.safeParse(obj)
    if (decoded.success) {
      return map(decoded.data)
    }
  }

  RichError.throw({noMatchFoundFor: obj, types: cases.map(c => c[0])})
}

const patternMatcher = <In = any, InSoFar = never, Out = never>(
  cases: Cases,
  obj: In,
): PatternMatchBuilder<In, InSoFar, Out> =>
  ({
    case(type: z.ZodType<unknown>, ...fns: UnknownFn[]) {
      const codec = codecFromShorthand(type)
      const refined = fns.length > 1 ? codec.refine(fns[0] as any) : codec
      return patternMatcher(cases.concat([[refined, fns[fns.length - 1]]]), obj)
    },
    default: (map: UnknownFn) => patternMatcher(cases.concat([[z.any(), map]]), obj),
    get: () => matchObject(obj, cases),
  } as any)

/**
 * Match an object against a number of cases. Loosely based on Scala's pattern matching.
 *
 * @example
 * // get a value which could be a string or a number:
 * const value = Math.random() < 0.5 ? 'foo' : Math.random() * 10
 * const stringified = match(value)
 *  .case(String, s => `the message is ${s}`)
 *  .case(7, () => 'exactly seven')
 *  .case(Number, n => `the number is ${n}`)
 *  .get()
 *
 * @description
 * Under the hood, io-ts is used for validation. The first argument can be a "shorthand" for a type,
 * but you can also pass in io-ts codecs directly for more complex types:
 *
 * @example
 * // get a value which could be a string or a number:
 * const value = Math.random() < 0.5 ? 'foo' : 123
 * const stringified = match(value)
 *  .case(t.number, n => `the number is ${n}`)
 *  .case(t.string, s => `the message is ${s}`)
 *  .get()
 *
 * @description
 * you can use a predicate function or `t.refinement` for the equivalent of scala's `case x: Int if x > 2`:
 *
 * @example
 * // value which could be a string, or a real number in [0, 10):
 * const value = Math.random() < 0.5 ? 'foo' : Math.random() * 10
 * const stringified = match(value)
 *  .case(Number, n => n > 2, n => `big number: ${n}`)
 *  .case(Number, n => `small number: ${n}`)
 *  .default(x => `not a number: ${x}`)
 *  .get()
 *
 * @example
 * // value which could be a string, or a real number in [0, 10):
 * const value = Math.random() < 0.5 ? 'foo' : Math.random() * 10
 * const stringified = match(value)
 *  .case(t.refinement(t.number, n => n > 2), n => `big number: ${n}`)
 *  .case(t.number, n => `small number: ${n}`)
 *  .default(x => `not a number: ${x}`)
 *  .get()
 *
 * @description
 *
 * note: when using predicates or `t.refinement`, the type being refined is not considered exhaustively matched,
 * so you'll usually need to add a non-refined option, or you can also use `.default` as a fallback
 * case (the equivalent of `.case(t.any, ...)`)
 *
 * @param obj the object to be pattern-matched
 */
export const match = <Input>(obj: Input) => patternMatcher([], obj)

/**
 * Like @see match but no object is passed in when constructing the case statements.
 * Instead `.get` is a function into which a value should be passed.
 *
 * @example
 * const Email = t.type({sender: t.string, subject: t.string, body: t.string})
 * const SMS = t.type({from: t.string, content: t.string})
 * const Message = t.union([Email, SMS])
 * type Message = typeof Message._A
 *
 * const content = matcher<MessageType>()
 *   .case(SMS, s => s.content)
 *   .case(Email, e => e.subject + '\n\n' + e.body)
 *   .get({from: '123', content: 'hello'})
 *
 * expect(content).toEqual('hello')
 *
 * @description
 * The function returned by `.get` is stateless and has no `this` context,
 * you can store it in a variable and pass it around:
 *
 * @example
 * const getContent = matcher<Message>()
 *   .case(SMS, s => s.content)
 *   .case(Email, e => e.subject + '\n\n' + e.body)
 *   .get
 *
 * const allMessages: Message[] = getAllMessages();
 * const contents = allMessages.map(getContent);
 */
export const matcher = <In = any>(): MatcherBuilder<In, never, never> => matcherRecursive([])

const matcherRecursive = <In = any, InSoFar = never, Out = never>(cases: Cases): MatcherBuilder<In, InSoFar, Out> =>
  ({
    case(type: z.ZodType<unknown>, ...fns: UnknownFn[]) {
      const codec = codecFromShorthand(type)
      const refined = fns.length > 1 ? codec.refine(fns[0] as any) : codec
      return matcherRecursive(cases.concat([[refined, fns[fns.length - 1]]]))
    },
    default: (map: UnknownFn) => matcherRecursive(cases.concat([[z.any(), map]])),
    get: (obj: unknown) => matchObject(obj, cases),
    // tryGet: (obj: unknown) => maybeMatchObject(obj, cases),
  } as any)

// export const collect = <T, U>(items: T[], partialFunc: (t: T) => Hopefully<U>) =>
//   items
//     .map(partialFunc)
//     .filter((o): o is Either.Right<U> => o.success)
//     .map(o => o.right)

// export type Hopefully<T> = Either.Either<unknown, T>
