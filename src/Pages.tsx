import * as React from 'react'
import { PageData, PageMap } from './Data'
import ErrorBoundary from './ErrorBoundary'
import { RootContext } from './Root'
import { PageId, PageIds, PageTitles } from './PageId';

interface PagesProps {
  pages: PageMap;
}

export default function Pages(props: PagesProps): React.ReactElement {
  return <div className="pages">
    {PageIds.map(id => <Page key={id} id={id} text={props.pages.get(id, '')}/>)}
  </div>;
}

interface PageProps {
  id: PageId;
  text: PageData;
}

function Page(props: PageProps) : React.ReactElement {
  const root = React.useContext(RootContext);
  return <label>
    <ErrorBoundary>
      {PageTitles[props.id]}
      <textarea className="page" value={props.text} onChange={event => root.onPageUpdate(props.id, event)}/>
    </ErrorBoundary>
    <hr/>
  </label>;
}
