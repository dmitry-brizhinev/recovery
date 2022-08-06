import * as React from 'react'

import { dateToJId, incrementJId, Journal, JournalData } from '../data/Journal';
import { getJournals } from '../firebase/FirebaseStoreJournals';
import { JournalRoot, JournalDataRoot, JournalRootContext } from '../helpers/JournalRoot';
import JournalSaver from '../helpers/JournalSaver';
import Backup from '../util/Backup';
import ErrorBoundary from '../util/ErrorBoundary';

import '../css/journal.css';
import Loading from '../util/Loading';
import Textarea from '../util/Textarea';

interface JournalsContainerState {
  root: JournalRoot | null;
  data: JournalData | null;
  saver: string;
}

export default class JournalsContainer extends React.Component<object, JournalsContainerState> {
  waitingForData = false;
  mounted = false;

  constructor(props: object) {
    super(props);

    this.state = {root: null, data: null, saver: ''};

    this.onUpdate = this.onUpdate.bind(this);
    this.onSaverUpdate = this.onSaverUpdate.bind(this);
    this.onDataArrived = this.onDataArrived.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
    if (!this.waitingForData) {
      this.waitingForData = true;
      getJournals().then(this.onDataArrived, () => this.waitingForData = false);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  onDataArrived(data: JournalData) {
    this.waitingForData = false;
    if (!this.mounted) {
      return;
    }
    const root = new JournalDataRoot(data, this.onUpdate, new JournalSaver(this.onSaverUpdate));
    this.setState({root, data});
  }

  onUpdate(data: JournalData) {
    if (this.mounted)
      this.setState({data});
  }

  onSaverUpdate(saver: string) {
    if (this.mounted)
      this.setState({saver});
  }

  render() {
    return <div className="journals-wrapper">
      {this.state.root && this.state.data ?
        <ErrorBoundary>
          {this.state.saver}<Backup data={this.state.data}/>
          <JournalRootContext.Provider value={this.state.root}>
            <Journals data={this.state.data}/>
          </JournalRootContext.Provider>
        </ErrorBoundary>
        : <Loading/>
      }
    </div>;
  }
}

interface JournalsProps {
  data: JournalData;
}

function Journals(props: JournalsProps): React.ReactElement {
  const [today, setToday] = React.useState(() => dateToJId(new Date()));
  const onClickPrevDay = React.useCallback(() => setToday(x => incrementJId(x, -1)), []);
  const onClickNextDay = React.useCallback(() => setToday(x => incrementJId(x, 1)), []);
  const root = React.useContext(JournalRootContext);

  const yester = incrementJId(today, -1);
  const tomorr = incrementJId(today, 1);

  const emptyJournal = React.useMemo(() => new Journal(''), []);

  const yesterday = props.data.get(yester);
  const todaydata = props.data.get(today) || emptyJournal;
  const tomorrrow = props.data.get(tomorr);

  const onUpdate = React.useCallback((data: string) => root.onJournalUpdate(today, todaydata.withUpdate(data)), [root, today, todaydata]);

  return <ErrorBoundary><div className="journal-pages">
    <div className="journal-yesterday">{yester.substring(1)}<textarea readOnly={true} className="journal-page-yesterday" value={yesterday?.main ?? ''}/></div>
    <div className="journal-today"><div className="journal-pages-header">
      <button className="journal-prev-day" onClick={onClickPrevDay}>&lt;</button>
      {today.substring(1)}
      <button className="journal-next-day" onClick={onClickNextDay}>&gt;</button>
    </div>
      <Textarea className="journal-page-today" value={todaydata.main} onChange={onUpdate}/>
    </div>
    <div className="journal-tomorrow">{tomorr.substring(1)}<textarea readOnly={true} className="journal-page-tomorrow" value={tomorrrow?.main ?? ''}/></div>
  </div></ErrorBoundary>;
}