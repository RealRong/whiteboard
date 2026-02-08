import { useEffect, useMemo, useCallback } from 'react'
import type { Core, Document } from '@whiteboard/core'
import { createDefaultShortcuts } from '../defaultShortcuts'
import type { Shortcut } from 'types/shortcuts'
import type { ShortcutManager } from 'types/shortcuts'
import { useInstance, useWhiteboardConfig } from '../../hooks'
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
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()

  const getSelectableNodeIds = useCallback(() => {
    return instance.state.store.get(canvasNodesAtom).map((node) => node.id)
  }, [instance])

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
              select: instance.commands.selection.select,
              clear: instance.commands.selection.clear
            },
            selectEdge: instance.commands.edge.select
          })
        : [],
    [core, defaultGroupPadding, docRef, getSelectableNodeIds, instance, nodeSize]
  )

  const resolved = useMemo(() => resolveShortcuts(defaults, shortcutsProp), [defaults, shortcutsProp])

  useEffect(() => {
    shortcutManager.setShortcuts(resolved)
  }, [shortcutManager, resolved])

  return resolved
}
