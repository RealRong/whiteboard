import { useAtomValue } from 'jotai'
import type { Atom } from 'jotai/vanilla'
import { useInternalInstance } from './useInstance'

export const useUiAtomValue = <Value,>(targetAtom: Atom<Value>): Value => {
  const instance = useInternalInstance()
  return useAtomValue(targetAtom, { store: instance.uiStore })
}
