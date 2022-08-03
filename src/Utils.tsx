
export function pad2(num: number): string {
  return num.toString().padStart(2, '0');
}

export type Callback<T> = (x: T) => void;
export type Func = () => void;