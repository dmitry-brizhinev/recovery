import {Seq} from 'immutable';
import {asserteq} from './Utils';

export function zip<U, V>(a: U[], b: V[]) {
  asserteq(a.length, b.length);
  return zipShorter(a, b);
}

export function zipShorter<U, V>(a: U[], b: V[]) {
  return Seq(a).zip(Seq(b));
}

export function zipWith<U, V, X>(a: U[], b: V[], z: (a: U, b: V) => X) {
  asserteq(a.length, b.length);
  return Seq(a).zipWith(z, Seq(b));
}