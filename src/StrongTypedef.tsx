// See https://evertpot.com/opaque-ts-types/
// or  https://stackoverflow.com/questions/61295715/typedef-equivalent-for-typescript

declare const secret: unique symbol;

/** 
 * Defines a type which is equivalent to `T`, but instances of `T`
 * cannot be assigned to it except via the `castToTypedef` function.
 */
export type StrongTypedef<T> = T & {[secret]:true};

export function castToTypedef<T>(instance: T): StrongTypedef<T> {
  return instance as StrongTypedef<T>;
}