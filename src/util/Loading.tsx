import * as React from 'react'

export default function Loading(): React.ReactElement {
  return <div>Loading...</div>;
}

export function SuspenseBoundary(props: {children: React.ReactNode}) {
  return <React.Suspense fallback={<Loading/>}>{props.children}</React.Suspense>;
}