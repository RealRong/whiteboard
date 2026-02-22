import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  Shortcut,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutManager,
  ShortcutPointerEvent,
  ShortcutOverrides,
  Shortcuts
} from '@engine-types/shortcuts'
import { createShortcutManager } from './manager'
import { createDefaultShortcuts } from './defaultShortcuts'
import {
  createHandlers
} from '../../api/commands/shortcut'
import { createShortcutContextReader } from './context'
import { getPlatformInfo } from './chord'

const resolveShortcuts = (
  defaults: Shortcut[],
  overrides?: ShortcutOverrides
) => {
  if (!overrides) return defaults
  if (typeof overrides === 'function') {
    return overrides(defaults)
  }
  const merged = new Map<string, Shortcut>()
  defaults.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  overrides.forEach((shortcut) => merged.set(shortcut.id, shortcut))
  return Array.from(merged.values())
}

class ShortcutsImpl implements Shortcuts {
  private instance: InternalInstance
  private shortcutManager: ShortcutManager
  private commandHandlers: ReturnType<typeof createHandlers>
  private getShortcutContextInternal: () => ShortcutContext

  constructor(instance: InternalInstance) {
    this.instance = instance
    this.shortcutManager = createShortcutManager()
    const platform = getPlatformInfo()
    this.getShortcutContextInternal = createShortcutContextReader({
      readState: instance.state.read,
      platform
    })

    this.commandHandlers = createHandlers({
      runTransaction: async (recipe) =>
        recipe(),
      node: {
        create: instance.commands.node.create,
        delete: instance.commands.node.delete
      },
      edge: {
        create: instance.commands.edge.create,
        delete: instance.commands.edge.delete
      },
      group: {
        create: instance.commands.group.create,
        ungroup: instance.commands.group.ungroup
      },
      history: {
        undo: instance.commands.history.undo,
        redo: instance.commands.history.redo
      },
      getDocument: () => instance.runtime.document.get(),
      getSelectableNodeIds: () => instance.graph.read().canvasNodes.map((canvasNode) => canvasNode.id),
      getSelectedNodeIds: () => Array.from(instance.state.read('selection').selectedNodeIds),
      getSelectedEdgeId: () => instance.state.read('edgeSelection'),
      selection: {
        select: instance.commands.selection.select,
        clear: instance.commands.selection.clear
      },
      selectEdge: instance.commands.edge.select
    })
    this.setShortcuts()
  }

  private runCommand = (names: string[]) => {
    for (const name of names) {
      const handler = this.commandHandlers[name as keyof typeof this.commandHandlers]
      if (!handler) continue
      handler()
      return true
    }
    return false
  }

  setShortcuts = (overrides?: ShortcutOverrides) => {
    const defaults = createDefaultShortcuts({
      runCommand: this.runCommand
    })
    this.shortcutManager.setShortcuts(resolveShortcuts(defaults, overrides))
  }

  getContext = () => {
    return this.getShortcutContextInternal()
  }

  handlePointerDownCapture = (event: ShortcutPointerEvent, context: ShortcutContext) => {
    return this.shortcutManager.handlePointerDown(event, context)
  }

  handleKeyDown = (event: ShortcutKeyEvent, context: ShortcutContext) => {
    return this.shortcutManager.handleKeyDown(event, context)
  }

  dispose = () => {}
}

export const createShortcuts = (instance: InternalInstance): Shortcuts => {
  return new ShortcutsImpl(instance)
}
