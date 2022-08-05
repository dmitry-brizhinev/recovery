import * as React from 'react'

type Data = {toJSON: () => any};

interface BackupProps {
  data: Data;
}

function getBackupString(data: Data): string {
  return JSON.stringify(data);
}

export default function Backup(props: BackupProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const onClick = React.useCallback(() => setOpen(x => !x), []);
  const backup = React.useMemo(() => getBackupString(props.data), [props.data]);
  return open ? <><input type="text" readOnly={true} value={backup}/><button onClick={onClick}>Hide</button></> : <button onClick={onClick}>Backup</button>;
}