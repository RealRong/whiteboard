import type { InternalInstance } from '@engine-types/instance/engine'
import type { KeyInputEvent, PointerInputEvent } from '@engine-types/input/event'
import type {
  ShortcutAction,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutPointerEvent,
} from '@engine-types/shortcuts/types'
import type {
  ShortcutManager,
  ShortcutOverrides,
  Shortcuts
} from '@engine-types/shortcuts/manager'
import { manager, resolveShortcuts } from './manager'
import { defaults } from './defaults'
import { platform } from './chord'

const toPointerShortcutEvent = (event: PointerInputEvent): ShortcutPointerEvent => ({
  button: event.button,
  modifiers: {
    alt: event.modifiers.alt,
    shift: event.modifiers.shift,
    ctrl: event.modifiers.ctrl,
    meta: event.modifiers.meta
  }
})

const toKeyShortcutEvent = (event: KeyInputEvent): ShortcutKeyEvent => ({
  key: event.key,
  code: event.code,
  repeat: event.repeat,
  isComposing: event.isComposing,
  modifiers: {
    alt: event.modifiers.alt,
    shift: event.modifiers.shift,
    ctrl: event.modifiers.ctrl,
    meta: event.modifiers.meta
  }
})

const withPointerContext = (
  base: ShortcutContext,
  event: PointerInputEvent
): ShortcutContext => ({
  ...base,
  pointer: {
    ...base.pointer,
    button: event.button === 0 || event.button === 1 || event.button === 2 ? event.button : undefined,
    modifiers: {
      alt: event.modifiers.alt,
      shift: event.modifiers.shift,
      ctrl: event.modifiers.ctrl,
      meta: event.modifiers.meta
    }
  }
})

const withKeyContext = (
  base: ShortcutContext,
  event: KeyInputEvent
): ShortcutContext => ({
  ...base,
  focus: {
    ...base.focus,
    isEditingText: event.target.isTextInput ?? base.focus.isEditingText,
    isInputFocused: event.target.ignoreInput ?? base.focus.isInputFocused,
    isImeComposing: event.isComposing ?? base.focus.isImeComposing
  },
  pointer: {
    ...base.pointer,
    modifiers: {
      alt: event.modifiers.alt,
      shift: event.modifiers.shift,
      ctrl: event.modifiers.ctrl,
      meta: event.modifiers.meta
    }
  }
})

class ShortcutsImpl implements Shortcuts {
  private readonly shortcutManager: ShortcutManager
  private readonly runAction: (action: ShortcutAction) => boolean
  private readonly readState: InternalInstance['state']['read']
  private readonly platform: ShortcutContext['platform']

  constructor(instance: InternalInstance, runAction: (action: ShortcutAction) => boolean) {
    this.shortcutManager = manager()
    this.runAction = runAction
    this.readState = instance.state.read
    this.platform = platform()

    this.setShortcuts()
  }

  setShortcuts = (overrides?: ShortcutOverrides) => {
    const all = defaults({
      runAction: this.runAction
    })
    this.shortcutManager.setShortcuts(resolveShortcuts(all, overrides))
  }

  private readShortcutContext = (): ShortcutContext => {
    const interaction = this.readState('interaction')
    const tool = this.readState('tool')
    const selection = this.readState('selection')
    const selectedEdgeId = selection.selectedEdgeId
    const selectedNodeIds = Array.from(selection.selectedNodeIds)

    return {
      platform: this.platform,
      focus: interaction.focus,
      tool: { active: tool },
      selection: {
        count: selectedNodeIds.length,
        hasSelection: selectedNodeIds.length > 0,
        selectedNodeIds,
        selectedEdgeId
      },
      hover: interaction.hover,
      pointer: {
        ...interaction.pointer
      },
      viewport: {
        zoom: this.readState('viewport').zoom
      }
    }
  }

  handlePointerDownCapture = (event: PointerInputEvent) => {
    const context = withPointerContext(this.readShortcutContext(), event)
    return this.shortcutManager.handlePointerDown(toPointerShortcutEvent(event), context)
  }

  handleKeyDown = (event: KeyInputEvent) => {
    const context = withKeyContext(this.readShortcutContext(), event)
    return this.shortcutManager.handleKeyDown(toKeyShortcutEvent(event), context)
  }

  dispose = () => {}
}

type Deps = {
  instance: InternalInstance
  runAction: (action: ShortcutAction) => boolean
}

export const shortcuts = ({ instance, runAction }: Deps): Shortcuts => {
  return new ShortcutsImpl(instance, runAction)
}
