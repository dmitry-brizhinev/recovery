import {Seq, List} from 'immutable';
import {asserteq} from './Utils';

export function zip<U, V>(a: U[], b: V[]) {
  asserteq(a.length, b.length);
  return zipShorter(a, b);
}

export function zipL<U, V>(a: List<U>, b: List<V>) {
  asserteq(a.size, b.size);
  return zipShorter(a, b);
}

export function zipShorter<U, V>(a: U[] | List<U>, b: V[] | List<V>) {
  return Seq(a).zip(Seq(b));
}

export function zipWith<U, V, X>(a: U[], b: V[], z: (a: U, b: V) => X) {
  asserteq(a.length, b.length);
  return Seq(a).zipWith(z, Seq(b));
}

export function zipWithL<U, V, X>(a: List<U>, b: List<V>, z: (a: U, b: V) => X) {
  asserteq(a.size, b.size);
  return Seq(a).zipWith(z, Seq(b));
}