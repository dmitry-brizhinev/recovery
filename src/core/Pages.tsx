import * as React from 'react'
import { PageData, PageMap } from '../data/Data'
import ErrorBoundary from '../util/ErrorBoundary'
import { RootContext } from '../helpers/Root'
import { PageId } from '../data/PageId';
import Textarea from '../util/Textarea';

interface PagesProps {
  pages: PageMap;
}

export default function Pages(props: PagesProps): React.ReactElement {
  return <div className="pages">
    {props.pages.entrySeq().sortBy(entry => entry[0]).map(([id, data]) => <Page key={id} id={id} data={data}/>)}
  </div>;
}

interface PageProps {
  id: PageId;
  data: PageData;
}

function Page(props: PageProps) : React.ReactElement {
  const root = React.useContext(RootContext);
  const [title, text] = props.data;
  const onChange = React.useCallback((text: string) => root.onPageUpdate(props.id, [title, text]), [root, props.id, title]);
  return <div className="page"><ErrorBoundary>
    {title}
    <Textarea className="page" value={text} onChange={onChange}/>
    </ErrorBoundary></div>;
}
