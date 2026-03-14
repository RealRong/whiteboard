import { atom } from 'jotai/vanilla'
import type { Guide } from '@whiteboard/core/node'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import type { InternalWhiteboardInstance } from '../common/instance/types'

export const EMPTY_GUIDES: readonly Guide[] = []

export const guidesAtom =
  atom<readonly Guide[]>(EMPTY_GUIDES)

export type TransientGuides = {
  get: () => readonly Guide[]
  write: (guides: readonly Guide[]) => void
  clear: () => void
}

export type GuidesWriter =
  Pick<TransientGuides, 'write' | 'clear'>

export const normalizeGuides = (
  guides: readonly Guide[]
): readonly Guide[] => guides.length ? guides : EMPTY_GUIDES

export const createTransientGuides = (
  uiStore: InternalWhiteboardInstance['uiStore'],
  schedule: () => void
) => {
  let current = EMPTY_GUIDES
  let pending: readonly Guide[] | undefined

  const guides: TransientGuides = {
    get: () => current,
    write: (next) => {
      pending = next
      schedule()
    },
    clear: () => {
      pending = undefined
      if (current === EMPTY_GUIDES) return
      current = EMPTY_GUIDES
      uiStore.set(guidesAtom, EMPTY_GUIDES)
    }
  }

  return {
    guides,
    flush: () => {
      if (pending === undefined) return
      const next = normalizeGuides(pending)
      pending = undefined
      if (current === next) return
      current = next
      uiStore.set(guidesAtom, next)
    }
  }
}

export const readTransientGuides = (
  instance: Pick<InternalWhiteboardInstance, 'uiStore'>
): readonly Guide[] => instance.uiStore.get(guidesAtom)

export const useTransientGuides = (): readonly Guide[] =>
  useUiAtomValue(guidesAtom)
