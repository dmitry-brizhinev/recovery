import * as ts from "typescript";

export default function toJS(source: string): ts.TranspileOutput {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      lib: ['ESNext'],
      noImplicitAny: false,
      noImplicitThis: false,
      noImplicitReturns: true,
      strict: false,
      noPropertyAccessFromIndexSignature: false,
      noUncheckedIndexedAccess: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      allowUmdGlobalAccess: false,
      removeComments: true,
      isolatedModules: true,
      moduleDetection: ts.ModuleDetectionKind.Auto,
      allowJs: false,
      noEmitOnError: true,
    }
  });
}
