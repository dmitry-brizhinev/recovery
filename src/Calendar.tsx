import * as React from 'react'
import './Calendar.css'

import { CalendarData, saveCalendar } from './auth'
import { Saver } from './Saver'
import ErrorBoundary from './ErrorBoundary'


interface CalendarProps {
  data: CalendarData;
}

interface CalendarState {

}

export function Calendar(props: CalendarProps) {
    return <ErrorBoundary><Saver<CalendarData> data={props.data} saver={saveCalendar} render={(data: CalendarData, status: string, onChange) => {
        return <label>
        {status}
        <textarea value={data.heh || 'HAH'} onChange={(event) => onChange({heh: (event.target as HTMLTextAreaElement).value})}/>
        <hr/>
      </label>;
    }}/></ErrorBoundary>;
}

class CalendarInner extends React.Component<CalendarProps, CalendarState> {
  constructor(props: CalendarProps) {
    super(props);
    this.state = {data: this.props.data};
  }

  render() {
    return (
      <label>ss
      </label>
    );
  }
}