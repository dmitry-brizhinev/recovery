import * as React from 'react'

import styles from '../css/program.module.css';
import { checkCodeId, CodeData, CodeId } from '../data/Code';
import { getCode } from '../firebase/FirestoreProgram';
import ProgramRoot from '../helpers/ProgramRoot';
import { useCancellable, useEventHandler } from '../util/Hooks';
import Loading from '../util/Loading';
import type { SwitcherData } from '../util/Switcher';
import Switcher from '../util/Switcher';
import Textarea from '../util/Textarea';
import { Callback, delay, errorString } from '../util/Utils';
import RootExecutor from './Executor';
import { visualiseNode } from './NearleyParser';
import parse from './Parser';

export default function Program(): React.ReactElement {
  return <div className={styles.wrapper}>
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
    ['Code', () => <ProgramFileSelect data={data} root={root}/>],
    ['Tests', () => <ProgramFileSelect data={data} root={root} test/>],
  ] : null, [data, root]);

  return switchData ? 
    <Switcher buttonRender={buttons => <div className={styles.header}>{saver}{buttons}</div>} data={switchData} initial={'Code'}/>
  : <Loading/>;
}

function ProgramFileSelect(props: {test?: boolean, data: CodeData, root: ProgramRoot}) {
  const [id, setId] = React.useState<CodeId | null>(null);
  const selectedId : CodeId = props.test ? 'tests' : id || props.data.keySeq().first('code.phi');
  const code = props.data.get(selectedId, '');
  const onChange = React.useCallback<Callback<string>>(code => props.root.onCodeUpdate(selectedId, code), [props.root, selectedId]);
  const onChangeTitle = React.useCallback<Callback<CodeId>>(id => { props.root.onCodeIdUpdate(selectedId, id); setId(id); }, [props.root, selectedId, setId]);
  return <div className={styles.body}><FileList selected={selectedId} data={props.data} onChange={onChangeTitle}/><ProgramCode code={code} onChange={onChange}/></div>;
}

function FileList(props: {selected: CodeId, data: CodeData, onChange: Callback<CodeId>}) {
  const filenames = [...props.data.keys()].sort().filter(k => k !== 'tests').join('\n');
  return <div className={styles.files}>
    <CurrentFile name={props.selected} onChange={props.onChange}/>
    <div className={styles.filenames}>
      {filenames}
    </div>
  </div>;
}

type Editor = {
  editing: boolean;
  temporary: string;
}


function reduceEditor(name: CodeId, onChange: Callback<CodeId>, {editing, temporary}: Editor, update: string | null): Editor {
  if (editing) {
    if (update == null) {
      const valid = temporary !== 'tests' && checkCodeId(temporary);
      if (valid) {
        onChange(valid);
      }
      return {editing: false, temporary: valid || name};
    } else {
      return {editing, temporary: update};
    }
  } else {
    return {editing: update == null, temporary: name};
  }
}

function CurrentFile(props: {name: CodeId, onChange: Callback<CodeId>}) {
  const reduce = React.useMemo(() => reduceEditor.bind(undefined, props.name, props.onChange), [props.name, props.onChange]);
  const [{editing, temporary}, onUpdate] = React.useReducer(reduce, {editing: false, temporary: props.name});
  const toggleEditing = React.useCallback(() => onUpdate(null), [onUpdate]);
  const onChange = useEventHandler(onUpdate);
  const valid = !editing || (checkCodeId(temporary) && temporary !== 'tests');
  return <><button disabled={props.name === 'tests'} className={`${styles.filename} material-icons`} onClick={toggleEditing}>{editing ? (valid ? 'done' : 'cancel') : 'edit'}</button>
  {editing ? <input className={`${styles.filename} ${valid ? styles.valid : styles.invalid}`} onChange={onChange} value={temporary} type="text" spellCheck={false}/> : temporary}</>;
}

type Result = {
  maxLines: number,
  lines: number,
  text: string,
}

function reduceResult({maxLines, lines, text}: Result, line: string | null): Result {
  if (line == null) return {maxLines:lines, lines:0, text:''};
  const m = Math.max(maxLines, lines+1);
  return {maxLines:m, lines:lines+1, text:`${text}${line}\n`};
}

function dummyText({maxLines, lines, text}: Result): string {
  return text + '\n'.repeat(maxLines - lines);
}

function ProgramCode(props: {code: string, onChange: Callback<string>}) {
  const [result, addLine] = React.useReducer(reduceResult, {maxLines:0, lines:0, text:''});
  const runCode = React.useCallback(() => run(props.code, addLine), [props.code, addLine]);

  return <div className={styles.code}>
    <Textarea className={styles.text} value={props.code} onChange={props.onChange} spellCheck={false}/>
    <div><button className={styles.run} onClick={runCode}>Run</button></div>
    <div className={styles.output}>{dummyText(result)}</div>
  </div>;
}

async function run(code: string, addLine: Callback<string|null>): Promise<void> {
  addLine(null);
  for await (const r of execute(code)) {
    addLine(r);
  }
}

async function* execute(code: string): AsyncGenerator<string, void, void> {
  yield 'Running ...';
  let tree;
  try {
    tree = await parse(code);
  } catch (e: unknown) {
    yield 'Parse error:';
    yield errorString(e);
    return;
  }
  yield 'Parsed ...';
  await delay(300);
  const exec = new RootExecutor();
  for (const statement of tree) {
    try {
      const r = exec.run(statement);
      if (r) yield r;
    }
    catch (e: unknown) {
      yield `${errorString(e)} <- error encountered while executing ${visualiseNode(statement)}`;
      return
    }
  }
  yield 'Done.';
  return;
}
