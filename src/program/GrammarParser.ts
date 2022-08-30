import {checkLexerName, literalLookup, FilteredLexerNames, type DirtyLexerName} from "./CustomLexer";
import {assert, unreachable} from "../util/Utils";
import {OrderedMap} from 'immutable';
//import grammarPath from './grammar.ne';

type Symbol = {token: DirtyLexerName;} | {rule: string;};
type Rule = Symbol[];

type Post = 'd' | 'ff' | 'fl' | 'fu' | 'fm';
type Posts = Map<string, Post>;
type Parsed = {allRules: OrderedMap<string, Rule[]>, posts: Posts;};

function parseSymbol(t: string): Symbol | undefined {
  let token = '';
  if (t.startsWith('%')) {
    token = t.substring(1);
  } else if (t.startsWith('"') && t.endsWith('"')) {
    const value = t.substring(1, t.length - 1);
    for (const [k, v] of Object.entries(literalLookup)) {
      if (v.includes(value)) token = k;
    }
    assert(token, `Unknown lexer literal ${value}`);
  }
  if (token) {
    if (FilteredLexerNames.includes(token as any)) return undefined;
    return {token: checkLexerName(token)};

  }
  return {rule: t};
}

function parseGrammarInner(grammar: string): Parsed {
  const result: [string, Rule[]][] = [];
  const posts = new Map<string, Post>();
  let start = '';
  for (const gg of grammar.trim().split('\n')) {
    const g = gg.split(/[#@]/)[0].trim();
    if (g.length === 0) continue;
    const gs = g.split(/ +-> +/);
    assert(gs.length === 2, g);
    const [name, ruless] = gs;
    const post = /#(...):(d|ff|fm|fl|fu)/.exec(gg);
    assert(post, `Missing instructions comment for ${name}`);
    assert(post[1] === name, `Wrong instructions name ${post[1]} for ${name}`);
    posts.set(name, post[2] as Post);
    if (!start) start = name;
    const rules = ruless.split(/ +\| +/);
    assert(rules.length >= 1, g);
    const parsedRules = [];
    for (const rule of rules) {
      const tokens = rule.split(/ +/);
      assert(tokens.length >= 1, g);
      const symbols = tokens.filter(t => t !== 'null').map(parseSymbol).flatMap(s => s ? [s] : []);
      parsedRules.push(symbols);
      //const postprocess = getPostprocessor(name, rule);
      //result.ParserRules.push({name, symbols, postprocess});
    }
    result.push([name, parsedRules]);
  }
  return {allRules: OrderedMap(result), posts};
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettySymbol(e: Symbol): string {
  if ('token' in e) return e.token.toUpperCase();
  return capitalise(e.rule);
}

function parseRule(rule: Rule): string {
  if (!rule.length) return '[]';
  if (rule.length === 1) {
    return prettySymbol(rule[0]);
  }
  return `[${rule.map(prettySymbol).join(', ')}]`;
}

function fu(rule: Rule): string {
  if (!rule.length) return '';
  assert(rule.length === 1, 'fu on a long rule');
  return prettySymbol(rule[0]);
}

function fl(rule: Rule): string {

}

export default function parseGrammar(grammar: string): string {
  const {allRules, posts} = parseGrammarInner(grammar);

  const result = [];
  for (const [name, rules] of allRules) {
    const post = posts.get(name);
    assert(post, 'Missing post for', name);
    if (post === 'd') continue;
    else if (post === 'fu') {
      rules.map(fu).filter(s => s);
    } else if (post === 'fl') {

    } else if (post === 'fm') {

    } else if (post === 'ff') {

    } else {
      unreachable(post);
    }

    result.push(`export type ${capitalise(name)} = ${rules.map(parseRule).join(' | ')};`);
  }
  return result.join('\n');
}
