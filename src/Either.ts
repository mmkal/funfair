// export type Left<L> = {
//   success: false
//   left: L
// }
// export type Right<R> = {
//   success: true
//   right: R
// }

// export type Either<L, R> = Left<L> | Right<R>

// export const right = <R>(_right: R): Right<R> => ({success: true, right: _right})
// export const left = <L>(error: L): Left<L> => ({success: false, left: error})

export type TupleError<L> = [L] & {option: []}
export type TupleData<R> = [null, R] & {option: [R]}
export type TupleEither<L, R> = TupleError<L> | TupleData<R>
export type TupleOption<R> = [] | [R]

export const right = <R>(value: R): TupleData<R> => Object.assign([null, value] as [null, R], {option: [value] as [R]})
export const left = <L>(value: L) => Object.assign([value] as [L], {option: [] as []})
export const isRight = <L, R>(tupleEither: TupleEither<L, R>): tupleEither is TupleData<R> => tupleEither.length === 2
export const toOption = <L, R>(tupleEither: TupleEither<L, R>): TupleOption<R> =>
  isRight(tupleEither) ? [tupleEither[1]] : []
export const invert = <L, R>(tupleEither: TupleEither<L, R>): TupleEither<R, L> =>
  isRight(tupleEither) ? [tupleEither[1]] : [null, tupleEither[0]]

export class Result<L, R> {
  private constructor(private tupleEither: TupleEither<L, R>) {}
  option = toOption(this.tupleEither)
  isRight = isRight(this.tupleEither)
  get inverse(): Result<R, L> {
    return new Result<R, L>(invert(this.tupleEither))
  }
}
