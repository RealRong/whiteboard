import type { ValueView } from '../view'
import { useStoreValue } from './useStoreValue'

export const useView = <T,>(
  view: ValueView<T>
): T => useStoreValue(view)
