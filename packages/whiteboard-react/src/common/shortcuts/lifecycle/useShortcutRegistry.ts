import { useEffect, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import type { Core, Document } from '@whiteboard/core'
import { createDefaultShortcuts } from '../defaultShortcuts'
import type { Shortcut } from '../types'
import type { ShortcutManager } from '../shortcutManager'
import { viewGraphAtom } from '../../state/whiteboardDerivedAtoms'
import { nodeSizeAtom } from '../../state/whiteboardInputAtoms'
import { useSelection } from '../../../node/hooks/useSelection'
import { useEdgeConnect } from '../../../edge/hooks/useEdgeConnect'

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
  const nodeSize = useAtomValue(nodeSizeAtom)
  const viewGraph = useAtomValue(viewGraphAtom)

  const defaults = useMemo(
    () =>
      selection && nodeSize
        ? createDefaultShortcuts({
            core,
            getDocument: () => docRef.current,
            getSelectableNodeIds: () => viewGraph.canvasNodes.map((node) => node.id),
            nodeSize,
            defaultGroupPadding,
            selection,
            selectEdge
          })
        : [],
    [core, defaultGroupPadding, docRef, nodeSize, selectEdge, selection, viewGraph.canvasNodes]
  )

  const resolved = useMemo(() => resolveShortcuts(defaults, shortcutsProp), [defaults, shortcutsProp])

  useEffect(() => {
    shortcutManager.setShortcuts(resolved)
  }, [shortcutManager, resolved])

  return resolved
}
