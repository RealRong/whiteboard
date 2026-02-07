import { useEffect, useMemo } from 'react'
import type { Core, Document } from '@whiteboard/core'
import { createDefaultShortcuts } from '../defaultShortcuts'
import type { Shortcut } from '../types'
import type { ShortcutManager } from '../shortcutManager'
import { useCanvasNodes, useWhiteboardConfig } from '../../hooks'
import { useSelection } from '../../../node/hooks'
import { useEdgeConnect } from '../../../edge/hooks'

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
  const selection = useSelection()
  const { selectEdge } = useEdgeConnect()
  const { nodeSize } = useWhiteboardConfig()
  const canvasNodes = useCanvasNodes()

  const defaults = useMemo(
    () =>
      selection && nodeSize
        ? createDefaultShortcuts({
            core,
            getDocument: () => docRef.current,
            getSelectableNodeIds: () => canvasNodes.map((node) => node.id),
            nodeSize,
            defaultGroupPadding,
            selection,
            selectEdge
          })
        : [],
    [canvasNodes, core, defaultGroupPadding, docRef, nodeSize, selectEdge, selection]
  )

  const resolved = useMemo(() => resolveShortcuts(defaults, shortcutsProp), [defaults, shortcutsProp])

  useEffect(() => {
    shortcutManager.setShortcuts(resolved)
  }, [shortcutManager, resolved])

  return resolved
}
