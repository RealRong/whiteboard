import { useAtomValue } from 'jotai'
import type { Atom } from 'jotai/vanilla'
import { useInstance } from './useInstance'

export const useReadAtom = <T,>(target: Atom<T>) => {
  const instance = useInstance()
  return useAtomValue(target, {
    store: instance.read.store
  })
}
