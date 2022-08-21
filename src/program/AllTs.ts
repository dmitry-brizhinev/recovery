import allFakePath from './all.fake';
import {Map as IMap} from 'immutable';

async function fetchLibs(): Promise<string> {
  const response = await fetch(allFakePath);
  return await response.text();
}

const fetched: {v?: IMap<string, string>;} = {};

export default async function getLibraryFiles(): Promise<IMap<string, string>> {
  if (fetched.v) return fetched.v;

  const file = await fetchLibs();

  // ==> lib.es2015.collection.d.ts <==
  const data: [string, string][] = file.split('==> lib.').filter(f => f).map(f => f.split('.d.ts <==')).map(([a, b]) => [`lib.${a}.d.ts`, b]);

  return fetched.v = IMap(data);
}