import { useEffect, useMemo, useCallback } from 'react'
import type { Core, Document } from '@whiteboard/core'
import { createDefaultShortcuts } from '../defaultShortcuts'
import type { Shortcut } from 'types/shortcuts'
import type { ShortcutManager } from 'types/shortcuts'
import { useInstance } from '../../hooks'

type Options = {
  core: Core
  docRef: { current: Document }
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
  shortcutsProp,
  shortcutManager
}: Options) => {
  const instance = useInstance()
  const { nodeSize, node } = instance.runtime.config

  const getSelectableNodeIds = useCallback(() => {
    return instance.state.read('canvasNodes').map((canvasNode) => canvasNode.id)
  }, [instance])

  const defaults = useMemo(
    () =>
      nodeSize
        ? createDefaultShortcuts({
            core,
            getDocument: () => docRef.current,
            getSelectableNodeIds,
            nodeSize,
            defaultGroupPadding: node.groupPadding,
            selection: {
              select: instance.commands.selection.select,
              clear: instance.commands.selection.clear
            },
            selectEdge: instance.commands.edge.select
          })
        : [],
    [core, docRef, getSelectableNodeIds, instance, node.groupPadding, nodeSize]
  )

  const resolved = useMemo(() => resolveShortcuts(defaults, shortcutsProp), [defaults, shortcutsProp])

  useEffect(() => {
    shortcutManager.setShortcuts(resolved)
  }, [shortcutManager, resolved])

  return resolved
}
