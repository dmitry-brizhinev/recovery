import * as React from 'react'
import ErrorBoundary from '../util/ErrorBoundary';
import Loading from '../util/Loading';

import '../css/index.css';

const Header = React.lazy(() => import('./Header'));

export default function App(): React.ReactElement {
  return <main>
    <h2>Recovery</h2>
    <ErrorBoundary><React.Suspense fallback={<Loading/>}><Header/></React.Suspense></ErrorBoundary>;
  </main>;
}
