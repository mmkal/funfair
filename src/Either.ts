export type {SafeParseReturnType} from 'zod'
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
