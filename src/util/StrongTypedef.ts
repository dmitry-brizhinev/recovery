// See https://evertpot.com/opaque-ts-types/
// or  https://stackoverflow.com/questions/61295715/typedef-equivalent-for-typescript

/**
 * Defines a type which is equivalent to `T`, but instances of `T`
 * cannot be assigned to it except via the `castToTypedef` function.
 * Requires defining a symbol, see below.
 */
export type StrongTypedef<T, S extends symbol> = T & {[key in S]: true};

export function castToTypedef<S extends symbol, T>(i: T): StrongTypedef<T, S> {
  return i as StrongTypedef<T, S>;
}

declare const example: unique symbol;
type Example = StrongTypedef<string, typeof example>;
export function test(): Example {
  const x = castToTypedef<typeof example, string>('string');
  return x;
}
