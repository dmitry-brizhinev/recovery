import * as React from 'react';

import styles from './program.module.css';
import {checkCodeId, type CodeData, type CodeId, type CodeOrTest, newCodeId} from '../data/Code';
import {getCode} from '../firebase/FirestoreProgram';
import ProgramRoot from '../helpers/ProgramRoot';
import {useCancellable, useEventHandler, useToggle} from '../util/Hooks';
import Loading from '../util/Loading';
import type {SwitcherData} from '../util/Switcher';
import Switcher from '../util/Switcher';
import Textarea from '../util/Textarea';
import {assert, type Callback, type Func} from '../util/Utils';
import {execute, genTypes} from './Runner';
import MaterialButton from '../util/MaterialButton';

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
    ['Code', () => <ProgramFileSelect data={data} root={root} />],
    ['Tests', () => <ProgramFileSelect data={data} root={root} test />],
  ] : null, [data, root]);

  return switchData ?
    <Switcher buttonRender={buttons => <div className={styles.header}>{saver}{buttons}</div>} data={switchData} initial={'Code'} />
    : <Loading />;
}

function ProgramFileSelect(props: {test?: boolean, data: CodeData, root: ProgramRoot;}) {
  const filenames = React.useMemo(() => [...props.data.keys()].sort().flatMap(k => k !== 'tests' ? [k] : []), [props.data]);
  const [id, setId] = React.useState<CodeId>(filenames.length ? filenames[0] : 'code.phi');
  const selectedId: CodeOrTest = props.test ? 'tests' : id;
  const code = props.data.get(selectedId, '');
  const onChange = React.useCallback((code: string) => props.root.onCodeUpdate(selectedId, code), [props.root, selectedId]);
  const onChangeTitle = React.useCallback((id: CodeId) => {assert(selectedId !== 'tests'); props.root.onCodeIdUpdate(selectedId, id); setId(id);}, [props.root, selectedId, setId]);
  return <>
    <div className={styles.filename}>{selectedId === 'tests' ? 'tests' : <CurrentFile name={selectedId} onChange={onChangeTitle} />}</div>
    <FileList selected={id} filenames={filenames} onSelect={setId} />
    <ProgramCode code={code} onChange={onChange} />
  </>;
}

function FileList(props: {selected: CodeId, filenames: CodeId[], onSelect: Callback<CodeId>;}) {
  const onSelect = props.onSelect;
  const filenames = React.useMemo(() => props.filenames.map(f => OtherFile(f, onSelect.bind(undefined, f), f === props.selected)), [props.filenames, onSelect, props.selected]);
  const onAdd = React.useCallback(() => onSelect(newCodeId(props.selected, f => props.filenames.includes(f))), [props.selected, onSelect, props.filenames]);
  return <div className={styles.filenames}>
    {filenames}
    <MaterialButton size={18} key={'add'} onClick={onAdd} className={styles.add} icon={'add'} />
  </div>;
}

function OtherFile(name: CodeId, onSelect: Func, selected: boolean) {
  return <span key={name} className={`${styles.file} ${selected ? styles.selected : ''}`} onClick={onSelect}>{name}<br /></span>;
}

function CurrentFile({name, onChange}: {name: CodeId, onChange: Callback<CodeId>;}) {
  const [editText, setText] = React.useState<string | null>(null);
  const edit = editText != null;
  const valid = edit ? checkCodeId(editText) : name;
  const start = React.useCallback(() => {
    setText(name);
  }, [setText, name]);
  const stop = React.useCallback(() => {
    valid && onChange(valid);
    setText(null);
  }, [setText, onChange, valid]);
  const onChangeInput = useEventHandler(setText);

  return <><MaterialButton size={18} className={styles.filename} onClick={edit ? stop : start} icon={edit ? (valid ? 'done' : 'cancel') : 'edit'} />
    {edit ? <input className={`${styles.filename} ${valid ? styles.valid : styles.invalid}`} onChange={onChangeInput} value={editText} type="text" spellCheck={false} /> : name}</>;
}

type Result = {
  maxLines: number,
  lines: number,
  text: string,
};

function reduceResult({maxLines, lines, text}: Result, line: string | null): Result {
  if (line == null) return {maxLines: lines, lines: 0, text: ''};
  const m = Math.max(maxLines, lines + 1);
  return {maxLines: m, lines: lines + 1, text: `${text}${line}\n`};
}

function dummyText({maxLines, lines, text}: Result): string {
  return text + '\n'.repeat(Math.max(maxLines, 3) - lines);
}

function ProgramCode(props: {code: string, onChange: Callback<string>;}) {
  const [result, addLine] = React.useReducer(reduceResult, {maxLines: 0, lines: 0, text: ''});

  const [ts, toggleTs] = useToggle(true);
  const [js, toggleJs] = useToggle(false);

  const runCode = React.useCallback(() => run(props.code, addLine), [props.code, addLine]);
  const compileCode = React.useCallback(() => compile(props.code, addLine, {ts, js}), [props.code, addLine, ts, js]);
  const checkTypes = React.useCallback(() => check(props.code, addLine), [props.code, addLine]);
  const gengenTypes = React.useCallback(() => {addLine(null); genTypes().then(addLine);}, [addLine]);

  return <>
    <div className={styles.text}>
      <Textarea className={styles.text} value={props.code} onChange={props.onChange} spellCheck={false} />
      <EdgeDisplay color={'red'} markers={[]} />
    </div>
    <div className={styles.run}>
      <button className={styles.run} onClick={checkTypes}>Check</button>
      <button className={styles.run} onClick={runCode}>Run</button>
      <button className={styles.run} onClick={compileCode}>Compile</button>
      <button className={styles.run} onClick={gengenTypes}>Gen Types</button>
      Show TS
      <input type="checkbox" className={styles.run} checked={ts} onChange={toggleTs} />
      Show JS
      <input type="checkbox" className={styles.run} checked={js} onChange={toggleJs} />
    </div>
    <div className={styles.output} onClick={e => window.getSelection()?.selectAllChildren(e.currentTarget)}>{dummyText(result)}</div>
  </>;
}

interface EdgeMarker {
  l: number;
  c: '<' | '>' | '.';
}
function EdgeDisplay(props: {color?: 'red' | 'green', markers: EdgeMarker[];}): React.ReactElement {
  let chars = '';
  let ll = 0;
  for (const m of props.markers) {
    chars = chars + '\n'.repeat(m.l - ll) + m.c;
    ll = m.l;
  }
  return <div className={`${styles.edge} ${props.color ? styles[props.color] : ''}`}>{chars}</div>;
}

async function run(code: string, addLine: Callback<string | null>): Promise<void> {
  addLine(null);
  for await (const r of execute(code, 'run')) {
    addLine(r);
  }
}

async function compile(code: string, addLine: Callback<string | null>, compileOpts: {ts: boolean, js: boolean;}): Promise<void> {
  addLine(null);
  for await (const r of execute(code, compileOpts)) {
    addLine(r);
  }
}

async function check(code: string, addLine: Callback<string | null>): Promise<void> {
  addLine(null);
  for await (const r of execute(code, 'check')) {
    addLine(r);
  }
}
