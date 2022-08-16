import * as React from 'react'

import '../css/program.css';
import type { CodeData } from '../data/Code';
import { getCode } from '../firebase/FirestoreProgram';
import ProgramRoot from '../helpers/ProgramRoot';
import { useCancellable } from '../util/Hooks';
import Loading from '../util/Loading';
import type { SwitcherData } from '../util/Switcher';
import Switcher from '../util/Switcher';
import Textarea from '../util/Textarea';
import type { Callback } from '../util/Utils';
import Executor from './Executor';
import parse, { visualiseNode } from './Parser';

export default function Program(): React.ReactElement {
  return <div className="program-wrapper">
    <ProgramDataWrapper />
  </div>;
}

function ProgramDataWrapper() {
  const [saver, setSaver] = React.useState('');
  const [data, setData] = React.useState<CodeData>();
  const [root, setRoot] = React.useState<ProgramRoot>();
  const onDataReceipt = React.useCallback<Callback<CodeData>>(
    data => {setData(data); setRoot(new ProgramRoot(data, setData, setSaver));},
    [setData, setRoot, setSaver]);
  useCancellable(getCode, onDataReceipt);

  const switchData = React.useMemo<SwitcherData | null>(() => (data && root) ? [
    ['Code', () => <ProgramCode data={data} root={root}/>],
    ['Tests', () => <ProgramCode data={data} root={root} test/>],
  ] : null, [data, root]);

  return switchData ? 
   <>{saver}<Switcher data={switchData} initial={'Code'}/></>
  : <Loading/>;
}

function ProgramCode(props: {test?: boolean, data: CodeData, root: ProgramRoot}) {
  const [text, setText] = React.useState('');
  const [result, setResult] = React.useState('');
  const runCode = React.useCallback(() => run(text, setResult), [text, setResult]);
  
  return <div className="program-code">
    <Textarea className="program-text" value={text} onChange={setText} spellCheck={false}/>
    <div><button className="program-run" onClick={runCode}>Run</button></div>
    <div className="program-output">{result}</div>
  </div>;
}


/*--------*/

function run(code: string, callback: Callback<string>): void {
  const it = execute(code);
  const result: string[] = [];
  let r;
  do {
    r = it.next();
    result.push(r.value ?? '');
    callback(result.join('\n'));
  } while (!r.done);
}

function* execute(code: string): Generator<string, string | null, void> {
  yield 'Running ...';
  const tree = parse(code);
  yield 'Parsed ...';
  if (typeof tree === 'string') {
    yield tree;
  } else {
    const exec = new Executor();
    for (const statement of tree) {
      try {
        yield exec.run(statement);
      }
      catch (e) {
        const m = e instanceof Error ? e.message : JSON.stringify(e);
        return `${m} <- error encountered while executing ${visualiseNode(statement)}`;
      }
    }
  }
  return 'Done.';
}
