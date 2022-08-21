import * as ts from 'typescript';
import {assert, unreachable} from '../util/Utils';
import type {Map as IMap} from 'immutable';
import getLibraryFiles from './AllTs';

function getOptions() {
  return {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    lib: ['es2022'] as [string],
    noImplicitAny: false,
    noImplicitThis: false,
    noImplicitReturns: true,
    strict: true, // This maybe doesnt override the optionals????
    noPropertyAccessFromIndexSignature: false,
    noUncheckedIndexedAccess: false,
    noUnusedLocals: true,
    noUnusedParameters: true,
    allowUmdGlobalAccess: false,
    removeComments: true,
    isolatedModules: true,
    moduleDetection: ts.ModuleDetectionKind.Auto,
    allowJs: false,
    noEmitOnError: true,
  };
}

//export function toJS(source: string): CompilationResult {
//  return normalise(ts.transpileModule(source, {compilerOptions: getOptions()}));
//}

export async function compile(code: string): Promise<CompilationResult> {
  return normalise(await compileTypeScriptCode(code));
}

function flatten(message: string | ts.DiagnosticMessageChain): string {
  if (typeof message === 'string') return message;
  return message.messageText + '\n' + (message.next ?? []).map(flatten).join('\n');
}

function normalise(output: ts.TranspileOutput | InternalResult): CompilationResult {
  const {outputText, diagnostics} = output;
  const errors = (diagnostics ?? []).map(({category, messageText}) => ({category, messageText: flatten(messageText)}));
  return {outputText, errors};
}

export function parseCategory(c: ts.DiagnosticCategory): string {
  switch (c) {
    case ts.DiagnosticCategory.Error: return 'Error';
    case ts.DiagnosticCategory.Message: return 'Message';
    case ts.DiagnosticCategory.Suggestion: return 'Suggestion';
    case ts.DiagnosticCategory.Warning: return 'Warning';
    default: return unreachable(c);
  }
}

export function errorToString({category, messageText}: CompilationError): string {
  return `${parseCategory(category)}: ${messageText}`;
}

export interface CompilationError {
  category: ts.DiagnosticCategory;
  messageText: string;
}

export interface CompilationResult {
  outputText: string;
  errors: CompilationError[];
}

interface InternalResult {
  outputText: string;
  diagnostics: readonly ts.Diagnostic[];
};

async function compileTypeScriptCode(code: string): Promise<InternalResult> {
  const libFiles = await getLibraryFiles();
  const options = getOptions();
  const host = new CompilerHost(code, options, libFiles);
  const finalopts: ts.CompilerOptions = {...ts.getDefaultCompilerOptions(), ...options};

  const program = ts.createProgram(host.getRootNames(), finalopts, host);
  let diagnostics = ts.getPreEmitDiagnostics(program);
  if (!diagnostics.length) {
    diagnostics = program.emit().diagnostics;
  }
  return {
    outputText: host.output,
    diagnostics,
  };
}

class CompilerHost implements ts.CompilerHost {
  private static readonly main: string = 'main.ts';
  private static readonly mainOut: string = '/main.js';
  private static parseFile(path: string, raw: string, target: ts.ScriptTarget): [string, {raw: string, source: ts.SourceFile;}] {
    const source = ts.createSourceFile(path, raw, target);
    return [path, {raw, source}];
  }

  private readonly files: IMap<string, {raw: string, source: ts.SourceFile;}>;
  private readonly lib: string;
  output: string = '';
  constructor(code: string, options: {target: ts.ScriptTarget, lib: [string];}, libFiles: IMap<string, string>) {
    this.files = libFiles.set(CompilerHost.main, code)
      .mapEntries(([name, code]) => CompilerHost.parseFile('/' + name, code, options.target));
    this.lib = options.lib[0];
  }

  getRootNames(): string[] {
    return ['/' + CompilerHost.main, this.getDefaultLibFileName()];
  }

  /*
for f in *.d.ts; do
    mv -- "$f" "${f%.d.ts}.d.ts.fake"
done
  */

  // ts.CompilerHost implementation below

  /*
  const host: ts.CompilerHost = {
    directoryExists: dirPath => dirPath === "/",
    getDirectories: () => [],
  };
  
  TRANSPILE MODULE:
  var compilerHost = {
    getCurrentDirectory: function () { return ""; },
    directoryExists: function () { return true; },
    getDirectories: function () { return []; }
  }; 
   */

  getSourceFile(fileName: string): ts.SourceFile | undefined {
    return this.files.get(fileName)?.source;
  }
  getDefaultLibFileName(): string {
    return `/lib.${this.lib}.d.ts`;
  }
  writeFile(fileName: string, text: string) {
    assert(fileName === CompilerHost.mainOut, `Unexpected output file ${fileName}`);
    assert(!this.output, `Duplicate output`);
    this.output = text;
  }
  getCurrentDirectory(): string {
    return '/';
  }
  getCanonicalFileName(fileName: string): string {
    return fileName;
  }
  useCaseSensitiveFileNames(): boolean {
    return true;
  }
  getNewLine(): string {
    return '\n';
  }
  fileExists(fileName: string): boolean {
    return this.files.has(fileName);
  }
  readFile(fileName: string): string | undefined {
    return this.files.get(fileName)?.raw;
  }
}
