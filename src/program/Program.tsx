import * as React from 'react';

import styles from './program.module.css';
import {checkCodeId, type CodeData, type CodeId, newCodeId} from '../data/Code';
import {getCode} from '../firebase/FirestoreProgram';
import ProgramRoot from '../helpers/ProgramRoot';
import {useCancellable, useEventHandler, useToggle} from '../util/Hooks';
import Loading from '../util/Loading';
import type {SwitcherData} from '../util/Switcher';
import Switcher from '../util/Switcher';
import Textarea from '../util/Textarea';
import type {Callback, Func} from '../util/Utils';
import {execute, genTypes} from './Runner';
import MaterialButton from '../util/MaterialButton';
import type {TokenLocation} from './CustomLexer';

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
    ['Grammar', () => <ProgramFileSelect data={data} root={root} grammar />],
  ] : null, [data, root]);

  return switchData ?
    <Switcher buttonRender={buttons => <div className={styles.header}>{saver}{buttons}</div>} data={switchData} initial={'Code'} />
    : <Loading />;
}

function ProgramFileSelect(props: {grammar?: boolean, data: CodeData, root: ProgramRoot;}) {
  const filenames = React.useMemo(() => [...props.data.keys()].sort(), [props.data]);
  const [selectedId, setId] = React.useState<CodeId>(filenames.length ? filenames[0] : 'code.phi');
  const code = props.data.get(selectedId, '');
  const onChange = React.useCallback((code: string) => props.root.onCodeUpdate(selectedId, code), [props.root, selectedId]);
  const onChangeTitle = React.useCallback((id: CodeId) => {props.root.onCodeIdUpdate(selectedId, id); setId(id);}, [props.root, selectedId, setId]);
  return <>
    <div className={styles.filename}><CurrentFile name={selectedId} onChange={onChangeTitle} /></div>
    <FileList selected={selectedId} filenames={filenames} onSelect={setId} />
    <ProgramCode code={props.grammar ? 'GRAMMAR' : code} onChange={props.grammar ? undefined : onChange} />
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
  errors: Highlight[];
};

function reduceResult({maxLines, lines, text, errors}: Result, maybeLine: string | null | [string, TokenLocation]): Result {
  if (maybeLine == null) return {maxLines: lines, lines: 0, text: '', errors: []};
  const m = Math.max(maxLines, lines + 1);
  if (Array.isArray(maybeLine)) {
    const [line, e] = maybeLine;
    if (e.el && e.el !== e.sl) {
      errors = errors.concat({line: e.sl, start: e.sc});
      for (let l = e.sl + 1; l < e.el; ++l) {
        errors = errors.concat({line: l});
      }
      errors = errors.concat({line: e.el, end: e.ec});
    } else {
      errors = errors.concat({line: e.sl, start: e.sc, end: e.ec});
    }
    return {maxLines: m, lines: lines + 1, text: `${text}${line}\n`, errors};
  }
  return {maxLines: m, lines: lines + 1, text: `${text}${maybeLine}\n`, errors};
}

function dummyText({maxLines, lines, text}: Result): string {
  return text + '\n'.repeat(Math.max(maxLines, 3) - lines);
}

function ProgramCode(props: {code: string, onChange?: Callback<string> | undefined;}) {
  const [result, addLine] = React.useReducer(reduceResult, {maxLines: 0, lines: 0, text: '', errors: []});

  const [ts, toggleTs] = useToggle(true);
  const [js, toggleJs] = useToggle(false);

  React.useEffect(() => addLine(null), [props.onChange]);

  const runCode = React.useCallback(() => run(props.code, addLine, 'run'), [props.code, addLine]);
  const compileCode = React.useCallback(() => run(props.code, addLine, {ts, js}), [props.code, addLine, ts, js]);
  const checkTypes = React.useCallback(() => run(props.code, addLine, 'check'), [props.code, addLine]);
  const gengenTypes = React.useCallback(() => generate(addLine), [addLine]);

  const highlighterRef = React.useRef<HTMLTextAreaElement>(null);
  const onScroll = React.useCallback((e: HTMLTextAreaElement) => {
    highlighterRef.current && (highlighterRef.current.scrollTop = e.scrollTop);
  }, [highlighterRef]);

  return <>
    <div className={styles.text}>
      <Highlighter value={props.code} highlights={result.errors} forwardedRef={highlighterRef} />
      <Textarea className={styles.text} value={props.code} onChange={props.onChange} spellCheck={false} onScrollChangeOrResize={onScroll} />
    </div>
    {props.onChange ? <div className={styles.run}>
      <button className={styles.run} onClick={checkTypes}>Check</button>
      <button className={styles.run} onClick={runCode}>Run</button>
      <button className={styles.run} onClick={compileCode}>Compile</button>
      Show TS
      <input type="checkbox" className={styles.run} checked={ts} onChange={toggleTs} />
      Show JS
      <input type="checkbox" className={styles.run} checked={js} onChange={toggleJs} />
    </div> : <div className={styles.run}>
      <button className={styles.run} onClick={gengenTypes}>Gen Types</button>
    </div>}
    <div className={styles.output}>{dummyText(result)}</div>
  </>;
}

interface Highlight {
  line: number;
  start?: number;
  end?: number;
  solid?: boolean;
}

function highlight(line: number, text: string, highlights: Highlight[]): string {
  let current = '';
  for (const h of highlights) {
    if (h.line !== line) continue;

    let start = h.start ?? 0;
    let end = h.end ?? text.length;
    if (start < current.length) {
      console.error('start:%d < current.length:%d', start, current.length);
      start = current.length;
    }
    if (end <= start) {
      console.error('end:%d <= start:%d', end, start);
      end = start + 1;
    }
    current += '\t'.repeat(start - current.length) + (h.solid ? '█' : ' ').repeat(end - start);
  }
  return current;
}

function Highlighter(props: {value: string, highlights: Highlight[], forwardedRef?: React.Ref<HTMLTextAreaElement>;}): React.ReactElement {
  const chars = props.value.split('\n').map((t, l) => highlight(l, t, props.highlights)).join('\n');
  return <textarea readOnly tabIndex={-1} ref={props.forwardedRef} value={chars} className={styles.highlighter} />;
}

async function run(code: string, addLine: Callback<string | null | [string, TokenLocation]>, mode: {ts: boolean, js: boolean;} | 'run' | 'check'): Promise<void> {
  addLine(null);
  for await (const r of execute(code, mode)) {
    addLine(r);
  }
}

async function generate(addLine: Callback<string | null>): Promise<void> {
  addLine(null);
  addLine(await genTypes());
}
