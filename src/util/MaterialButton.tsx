import type {Func} from "./Utils";
import styles from './material.module.css';

type MaterialIcon = 'done' | 'edit' | 'cancel' | 'add';
type MaterialSize = 18 | 24 | 36 | 48;

export default function MaterialButton(props: {icon: MaterialIcon, onClick?: Func, className?: string, size?: MaterialSize, dark?: boolean, disabled?: boolean}) {
  const font = styles[`md-${props.size || 24}`];
  const theme = props.dark ? styles['md-light'] : styles['md-dark'];
  const inactive = props.disabled ? styles['md-inactive'] : '';
  const className = `material-icons ${font} ${theme} ${inactive} ${styles.main} ${props.className || ''}`;
  return <button className={className} onClick={props.onClick}>{props.icon}</button>;
}
