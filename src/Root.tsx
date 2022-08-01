import * as React from 'react'

import { EmptyRoot, Root } from './Data'

export const RootContext = React.createContext<Root>(new EmptyRoot());