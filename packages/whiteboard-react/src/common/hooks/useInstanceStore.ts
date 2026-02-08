import { useAtomValue } from 'jotai'
import type { Atom } from 'jotai/vanilla'
import { useInstance } from './useInstance'

export const useInstanceAtomValue = <Value>(atom: Atom<Value>) => {
  const instance = useInstance()
  return useAtomValue(atom, { store: instance.state.store })
}
