import {expectTypeOf} from 'expect-type'
import * as fp from 'lodash/fp'
import {z} from 'zod'
import {match, matcher} from '../src'

// import './either-serializer'

describe('case matching', () => {
  const Email = z.object({sender: z.string(), subject: z.string(), body: z.string()})
  const SMS = z.object({from: z.string(), content: z.string()})
  const Message = z.union([Email, SMS])
  type MessageType = typeof Message._output

  test('matches', () => {
    const content = match({from: '123', content: 'hello'} as MessageType)
      .case(SMS, s => s.content)
      .case(Email, e => e.subject + '\n\n' + e.body)
      .get()

    expect(content).toEqual('hello')
  })

  test('can use shorthand', () => {
    const inputs = ['hi', {message: 'how are you'}, 'hello', 'bonjour', 37, [1, 2] as [number, number]]
    const content = inputs.map(i =>
      match(i)
        .case('hi', () => 'you just said hi')
        .case(String, fp.startsWith('h'), s => `greeting: ${s}`)
        .case(String, s => `custom greeting: ${s}`)
        .case({message: String}, m => {
          expectTypeOf(m).toMatchTypeOf<{message: string}>()
          return `you left a message: ${m.message}`
        })
        .case({message: {}}, m => `invalid message type: ${typeof m.message}`)
        .case(Number, n => `number: ${n}`)
        .case([2, [Number, Number]], ns => `two numbers: ${ns}`)
        .get(),
    )

    expectTypeOf(content).items.toBeString()
    expect(content).toMatchInlineSnapshot(`
      Array [
        "you just said hi",
        "you left a message: how are you",
        "greeting: hello",
        "custom greeting: bonjour",
        "number: 37",
        "two numbers: 1,2",
      ]
    `)
  })

  test('can use shorthand with matcher', () => {
    const inputs = ['hi', 'hello', 'how are you?', `what's going on?`, 'abcdef', 37]

    const content = inputs.map(
      matcher<typeof inputs[number]>()
        .case(String, fp.startsWith('h'), s => `greeting: ${s}`)
        .case(/\?$/, s => `question: ${s}`)
        .case(String, s => `custom message: ${s}`)
        .case(Number, n => `number: ${n}`).get,
    )

    expect(content).toMatchInlineSnapshot(`
      Array [
        "greeting: hi",
        "greeting: hello",
        "greeting: how are you?",
        "question: what's going on?",
        "custom message: abcdef",
        "number: 37",
      ]
    `)
  })

  test('can use shorthand with matcher + narrowing', () => {
    type PersonAttributes = {name: string; age: number}
    type Employee = PersonAttributes & {type: 'Employee'; employeeId: string}
    type Customer = PersonAttributes & {type: 'Customer'; orders: string[]}
    type Person = Employee | Customer

    matcher<Person>()
      .case({type: 'Employee'}, e => expectTypeOf(e.employeeId).toBeString())
      .case({type: 'Customer'}, e => expectTypeOf(e.orders).toEqualTypeOf<string[]>())
  })

  test('can use default', () => {
    const sound = match<MessageType>({from: '123', content: 'hello'})
      .case(Email, e => e.body)
      .default(JSON.stringify)
      .get()

    expect(sound).toEqual(`{"from":"123","content":"hello"}`)
  })

  test('can build matchers', () => {
    const sound = matcher<MessageType>()
      .case(SMS, s => s.content)
      .case(Email, e => e.body)
      .get({from: '123', content: 'hello'})

    expect(sound).toEqual('hello')
  })

  test('can refine', () => {
    const getSenderType = matcher<MessageType>()
      .case(
        Email.refine(e => e.sender.startsWith('mailing')),
        () => 'mailer',
      )
      .case(Email, e => 'personal contact: ' + e.sender)
      .case(SMS, s => s.from).get

    expectTypeOf(getSenderType).parameter(0).toEqualTypeOf<MessageType>()
    expectTypeOf(getSenderType).returns.toEqualTypeOf('')

    expect(getSenderType({sender: 'mailing@abc.com', subject: 'hi', body: 'pls buy product'})).toEqual('mailer')
    expect(getSenderType({sender: 'bob@xyz.com', subject: 'hi', body: 'how are you'})).toEqual(
      'personal contact: bob@xyz.com',
    )
    expect(getSenderType({from: '+123', content: 'hello'})).toEqual('+123')
  })

  test('uses default for matcher', () => {
    const number = matcher()
      .case(z.boolean(), () => 123)
      .default(Number)
      .get('456')

    expect(number).toEqual(456)
  })

  test('throws when no match found', () => {
    const doubleNumber = matcher().case(z.number(), n => n * 2).get

    expect(() => doubleNumber('hello' as any)).toThrowErrorMatchingInlineSnapshot(`
      "{
        \\"noMatchFoundFor\\": \\"hello\\",
        \\"types\\": [
          {
            \\"_def\\": {
              \\"checks\\": [],
              \\"typeName\\": \\"ZodNumber\\",
              \\"coerce\\": false
            }
          }
        ]
      }"
    `)
  })

  test('discriminated unions', () => {
    type SMS = {kind: 'SMS'; content: string}
    type Email = {kind: 'Email'; subject: string; body: string}
    type Message = SMS | Email

    const {get} = matcher<Message>()
      .case({kind: 'SMS'}, sms => sms.content)
      .case({kind: 'Email'}, email => email.subject + '\n\n' + email.body)

    expect(get({kind: 'SMS', content: 'hello'})).toEqual('hello')
    expect(get({kind: 'Email', subject: 'Hi', body: 'How are you'})).toEqual('Hi\n\nHow are you')
  })

  test('discriminated unions - types', () => {
    type SMS = {kind: 'SMS'; content: string}
    type Email = {kind: 'Email'; subject: string; body: string}
    type Message = SMS | Email

    const {get} = matcher<Message>()
      .case({kind: 'SMS'}, sms => expectTypeOf(sms).toEqualTypeOf<SMS>())
      .case({kind: 'Email'}, email => expectTypeOf(email).toEqualTypeOf<Email>())

    expectTypeOf(get).toEqualTypeOf<(input: Message) => true>()
  })

  // test('collects', () => {
  //   const VoiceMemo = z.object({recorder: z.string(), link: z.string()})
  //   const MixedMedia = z.union([Email, SMS, VoiceMemo])
  //   type MixedMedia = typeof MixedMedia._A

  //   const animals: MixedMedia[] = [
  //     {recorder: 'bob', link: 'voicememo.mp3'},
  //     {sender: 'a@b.com', subject: 'abc', body: 'email body'},
  //     {from: '+123', content: 'sms content'},
  //   ]
  //   const petSounds = collect(
  //     animals,
  //     matcher()
  //       .case(Email, e => e.body)
  //       .case(SMS, s => s.content).tryGet,
  //   )
  //   expect(petSounds).toMatchInlineSnapshot(`
  //     Array [
  //       "email body",
  //       "sms content",
  //     ]
  //   `)
  // })
})

describe('type-level tests', () => {
  test('match conditions narrow type', () => {
    const inputs = [{foo: 'bar'}, 123]

    const results = inputs.map(i =>
      match(i)
        .case(z.record(z.unknown()), o => expectTypeOf(o).toEqualTypeOf({foo: 'bar'}))
        .case(z.number(), n => expectTypeOf(n).toBeNumber())
        .get(),
    )

    expectTypeOf(results).items.toEqualTypeOf<true>()
  })

  test(`match conditions don't narrow any or never`, () => {
    match({} as any).case(z.object({}), o => {
      expectTypeOf(o).not.toBeAny()
      expectTypeOf(o).toEqualTypeOf<object>()
    })
    match({} as never).case(z.object({}), o => {
      expectTypeOf(o).not.toBeAny()
      expectTypeOf(o).not.toBeNever()
      expectTypeOf(o).toEqualTypeOf<object>()
    })
  })

  test('matcher conditions narrow type', () => {
    const inputs = [{foo: 'bar'}, 123]

    const mapper = matcher<typeof inputs[number]>()
      .case(z.record(z.unknown()), o => expectTypeOf(o).toEqualTypeOf({foo: 'bar'}))
      .case(z.number(), n => expectTypeOf(n).toBeNumber())

    const results = inputs.map(mapper.get)

    expectTypeOf(results).items.toEqualTypeOf<true>()
  })

  test(`matcher conditions don't narrow any or never`, () => {
    // eslint-disable-next-line mmkal/@typescript-eslint/no-unnecessary-type-arguments
    matcher<any>().case(z.object({}), o => {
      expectTypeOf(o).not.toBeAny()
      expectTypeOf(o).toEqualTypeOf<object>()
    })
    matcher<never>().case(z.object({}), o => {
      expectTypeOf(o).not.toBeAny()
      expectTypeOf(o).toEqualTypeOf<object>()
    })
  })
})
