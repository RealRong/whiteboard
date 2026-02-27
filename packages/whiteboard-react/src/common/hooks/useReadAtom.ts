import { useAtomValue } from 'jotai'
import type { Atom } from 'jotai/vanilla'

export const useReadAtom = <T,>(target: Atom<T>) =>
  useAtomValue(target)
