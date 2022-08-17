import * as React from 'react'
import type { PageData, PageMap, UserData } from '../data/Data'
import ErrorBoundary from '../util/ErrorBoundary'
import { DataRootContext } from '../helpers/DataRoot'
import { genNewId, PageId } from '../data/PageId';
import Textarea from '../util/Textarea';
import Calendar from './Calendar';

import '../css/pages.css';
import { useEventHandler } from '../util/Hooks';

export default function CalendarAndPages({data}: {data: UserData}): React.ReactElement {
  return <ErrorBoundary>
    <Calendar pages={data.calendarPages} events={data.calendarEvents} />
    <Pages pages={data.pages} />
  </ErrorBoundary>;
}

interface PagesProps {
  pages: PageMap;
}

function Pages(props: PagesProps): React.ReactElement {
  const root = React.useContext(DataRootContext);
  const onCreate = React.useCallback(() => {
    root.onPageUpdate(genNewId(props.pages), ['Title', 'Content']);
  }, [root, props.pages]);
  return <div className="pages">
    {props.pages.entrySeq().sortBy(entry => entry[0]).map(([id, data]) => <Page key={id} id={id} data={data}/>)}
    <button className="page-create" onClick={onCreate}>+</button>
  </div>;
}

interface PageProps {
  id: PageId;
  data: PageData;
}

function Page(props: PageProps) : React.ReactElement {
  const root = React.useContext(DataRootContext);
  const [editing, setEditing] = React.useState(false);
  const [title, text] = props.data;
  const toggleEditing = React.useCallback(() => setEditing(e => !e), [setEditing]);
  const onChangeText = React.useCallback((text: string) => root.onPageUpdate(props.id, [title, text]), [root, props.id, title]);
  const onChangeTitle = React.useCallback((title: string) => root.onPageUpdate(props.id, [title, text]), [root, props.id, text]);
  const onChangeTitleEvent = useEventHandler(onChangeTitle);
  return <div className="page"><ErrorBoundary>
    {editing ? 
      <><button className="page-edit material-icons" onClick={toggleEditing}>done</button> <input onChange={onChangeTitleEvent} value={title} type="text"/></>
    : 
      <><button className="page-edit material-icons" onClick={toggleEditing}>edit</button> {title}</>
    }
    <Textarea className="page" value={text} onChange={onChangeText}/>
    </ErrorBoundary></div>;
}
