import type { Instance } from '@engine-types/instance'
import type {
  Shortcut,
  ShortcutContext,
  ShortcutManager,
  ShortcutOverrides,
  ShortcutRuntime
} from '@engine-types/shortcuts'
import { createShortcutManager } from './manager'
import { createDefaultShortcuts } from './defaultShortcuts'
import {
  createShortcutCommandHandlers,
  registerShortcutCommandHandlers
} from '../../api/commands/shortcut'

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

class ShortcutRuntimeImpl implements ShortcutRuntime {
  private instance: Instance
  private shortcutManager: ShortcutManager
  private unregisterCommandHandlers: (() => void) | null
  private commandHandlers: ReturnType<typeof createShortcutCommandHandlers>

  constructor(instance: Instance) {
    this.instance = instance
    this.shortcutManager = createShortcutManager()

    this.commandHandlers = createShortcutCommandHandlers({
      runTransaction: instance.runtime.core.commands.transaction,
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
      getDocument: () => instance.runtime.docRef.current,
      getSelectableNodeIds: () => instance.state.read('canvasNodes').map((canvasNode) => canvasNode.id),
      getSelectedNodeIds: () => Array.from(instance.state.read('selection').selectedNodeIds),
      getSelectedEdgeId: () => instance.state.read('edgeSelection'),
      selection: {
        select: instance.commands.selection.select,
        clear: instance.commands.selection.clear
      },
      selectEdge: instance.commands.edge.select
    })

    this.unregisterCommandHandlers = registerShortcutCommandHandlers(instance.runtime.core, this.commandHandlers)
    this.setShortcuts()
  }

  private ensureCommandHandlers = () => {
    if (this.unregisterCommandHandlers) return
    this.unregisterCommandHandlers = registerShortcutCommandHandlers(this.instance.runtime.core, this.commandHandlers)
  }

  private applyInteractionSnapshot = (ctx: ShortcutContext) => {
    this.instance.commands.interaction.update({
      focus: ctx.focus,
      pointer: {
        isDragging: ctx.pointer.isDragging,
        button: ctx.pointer.button,
        modifiers: ctx.pointer.modifiers
      }
    })
  }

  setShortcuts = (overrides?: ShortcutOverrides) => {
    this.ensureCommandHandlers()
    const defaults = createDefaultShortcuts({ core: this.instance.runtime.core })
    this.shortcutManager.setShortcuts(resolveShortcuts(defaults, overrides))
  }

  handlePointerDownCapture = (event: PointerEvent, context: ShortcutContext) => {
    this.ensureCommandHandlers()
    this.applyInteractionSnapshot(context)
    return this.shortcutManager.handlePointerDown(event, context)
  }

  handleKeyDown = (event: KeyboardEvent, context: ShortcutContext) => {
    this.ensureCommandHandlers()
    this.applyInteractionSnapshot(context)
    return this.shortcutManager.handleKeyDown(event, context)
  }

  dispose = () => {
    if (!this.unregisterCommandHandlers) return
    this.unregisterCommandHandlers()
    this.unregisterCommandHandlers = null
  }
}

export const createShortcuts = (instance: Instance): ShortcutRuntime => {
  return new ShortcutRuntimeImpl(instance)
}
