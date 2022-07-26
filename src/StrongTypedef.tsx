// See https://evertpot.com/opaque-ts-types/
// or  https://stackoverflow.com/questions/61295715/typedef-equivalent-for-typescript

/** 
 * Defines a type which is equivalent to `T`, but instances of `T`
 * cannot be assigned to it except via the `castToTypedef` function.
 * Requires defining a symbol, see below.
 */
export type StrongTypedef<T,S extends symbol> = T & {[key in S]:true};

type Underlying<TD, S extends symbol> = TD extends StrongTypedef<infer T, S> ? T : never;

export function castToTypedef<TD,S extends symbol>(instance: Underlying<TD, S>): StrongTypedef<Underlying<TD, S>,S> {
  return instance as StrongTypedef<Underlying<TD, S>,S>;
}

declare const example: unique symbol;
type Example = StrongTypedef<string, typeof example>;
export function test(): Example {
  const x = castToTypedef<Example, typeof example>('string');
  return x;
}



