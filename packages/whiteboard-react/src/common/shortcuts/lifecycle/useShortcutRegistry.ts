import { useEffect, useMemo, useCallback } from 'react'
import type { Core, Document } from '@whiteboard/core'
import { useStore } from 'jotai'
import { createDefaultShortcuts } from '../defaultShortcuts'
import type { Shortcut } from '../types'
import type { ShortcutManager } from '../shortcutManager'
import { useWhiteboardConfig } from '../../hooks'
import { useSelectionActions } from '../../../node/hooks'
import { useEdgeConnectActions } from '../../../edge/hooks'
import { canvasNodesAtom } from '../../state'

type Options = {
  core: Core
  docRef: { current: Document }
  defaultGroupPadding: number
  shortcutsProp?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  shortcutManager: ShortcutManager
}

const resolveShortcuts = (
  defaults: Shortcut[],
  shortcutsProp?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
) => {
  if (!shortcutsProp) return defaults
  if (typeof shortcutsProp === 'function') {
    return shortcutsProp(defaults)
  }
  const merged = new Map<string, Shortcut>()
  defaults.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  shortcutsProp.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  return Array.from(merged.values())
}

export const useShortcutRegistry = ({
  core,
  docRef,
  defaultGroupPadding,
  shortcutsProp,
  shortcutManager
}: Options) => {
  const store = useStore()
  const selectionActions = useSelectionActions()
  const { selectEdge } = useEdgeConnectActions()
  const { nodeSize } = useWhiteboardConfig()

  const getSelectableNodeIds = useCallback(() => {
    return store.get(canvasNodesAtom).map((node) => node.id)
  }, [store])

  const defaults = useMemo(
    () =>
      nodeSize
        ? createDefaultShortcuts({
            core,
            getDocument: () => docRef.current,
            getSelectableNodeIds,
            nodeSize,
            defaultGroupPadding,
            selection: {
              select: selectionActions.select,
              clear: selectionActions.clear
            },
            selectEdge
          })
        : [],
    [core, defaultGroupPadding, docRef, getSelectableNodeIds, nodeSize, selectEdge, selectionActions.clear, selectionActions.select]
  )

  const resolved = useMemo(() => resolveShortcuts(defaults, shortcutsProp), [defaults, shortcutsProp])

  useEffect(() => {
    shortcutManager.setShortcuts(resolved)
  }, [shortcutManager, resolved])

  return resolved
}
