import type { WritableAtom } from 'jotai/vanilla'
import type { Store } from '@engine-types/instance'

type WhiteboardWritableAtom<Value, Args extends unknown[] = [Value], Result = void> = WritableAtom<
  Value,
  Args,
  Result
>

export const setStoreAtom = <Value, Args extends unknown[], Result>(
  store: Store,
  atom: WhiteboardWritableAtom<Value, Args, Result>,
  ...args: Args
) => store.set(atom, ...args)
