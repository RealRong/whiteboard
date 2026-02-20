import type {
  InputConfig,
  InputController as InputControllerType,
  InputEffect,
  InputEvent,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { PointerSessionEngine } from './PointerSessionEngine'

type InputContextBase = Omit<InputSessionContext, 'input'>

type InputControllerOptions = {
  getContext: () => InputContextBase
  config: InputConfig
  sessions?: PointerSession[]
}

const toPointerShortcutEvent = (
  event: Extract<InputEvent, { kind: 'pointer' }>
): PointerEvent =>
  ({
    button: event.button,
    altKey: event.modifiers.alt,
    shiftKey: event.modifiers.shift,
    ctrlKey: event.modifiers.ctrl,
    metaKey: event.modifiers.meta
  }) as PointerEvent

const toKeyShortcutEvent = (
  event: Extract<InputEvent, { kind: 'key' }>
): KeyboardEvent =>
  ({
    key: event.key,
    code: event.code,
    repeat: event.repeat,
    altKey: event.modifiers.alt,
    shiftKey: event.modifiers.shift,
    ctrlKey: event.modifiers.ctrl,
    metaKey: event.modifiers.meta
  }) as KeyboardEvent

const withPointerShortcutContext = (
  base: ShortcutContext,
  event: Extract<InputEvent, { kind: 'pointer' }>
): ShortcutContext => ({
  ...base,
  pointer: {
    ...base.pointer,
    button: event.button as 0 | 1 | 2,
    modifiers: {
      alt: event.modifiers.alt,
      shift: event.modifiers.shift,
      ctrl: event.modifiers.ctrl,
      meta: event.modifiers.meta
    }
  }
})

const withKeyShortcutContext = (
  base: ShortcutContext,
  event: Extract<InputEvent, { kind: 'key' }>
): ShortcutContext => ({
  ...base,
  focus: {
    ...base.focus,
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

export class InputControllerImpl implements InputControllerType {
  private readonly pointerEngine: PointerSessionEngine
  private readonly getContextBase: () => InputContextBase
  private config: InputConfig

  constructor({ getContext, config, sessions }: InputControllerOptions) {
    this.getContextBase = getContext
    this.config = config
    this.pointerEngine = new PointerSessionEngine({
      getContext: this.getSessionContext,
      sessions
    })
  }

  setPointerSessions = (sessions: PointerSession[]) => {
    this.pointerEngine.setSessions(sessions)
  }

  handle: InputControllerType['handle'] = (event) => {
    if (event.kind === 'pointer') {
      return this.handlePointer(event)
    }
    if (event.kind === 'key') {
      return this.handleKey(event)
    }
    if (event.kind === 'wheel') {
      return this.handleWheel(event)
    }
    if (event.kind === 'focus' && event.phase === 'blur') {
      return this.reset('blur')
    }
    return { effects: [] as InputEffect[] }
  }

  configure: InputControllerType['configure'] = (config) => {
    this.config = config
  }

  reset: InputControllerType['reset'] = (reason = 'forced') => {
    if (reason === 'forced' || reason === 'blur') {
      this.getSessionContext().commands.keyboard.setSpacePressed(false)
    }
    return this.pointerEngine.cancelActive(reason)
  }

  private readonly getSessionContext = (): InputSessionContext => ({
    ...this.getContextBase(),
    input: {
      config: this.config
    }
  })

  private handlePointer = (
    event: Extract<InputEvent, { kind: 'pointer' }>
  ): ReturnType<InputControllerType['handle']> => {
    const context = this.getSessionContext()
    if (event.phase === 'move' && event.source === 'container' && event.stage === 'bubble') {
      const enabled = context.state.read('tool') === 'edge'
      context.runtime.interaction.edgeConnect.hoverMove(event.pointer, enabled)
    }
    if (event.phase === 'down' && event.stage === 'capture') {
      const handled = context.shortcuts.handlePointerDownCapture(
        toPointerShortcutEvent(event),
        withPointerShortcutContext(context.view.getShortcutContext(), event)
      )
      if (!handled) {
        return { effects: [] as InputEffect[] }
      }
      const effects: InputEffect[] = [
        { type: 'preventDefault', reason: 'shortcut.pointerDownCapture' },
        { type: 'stopPropagation', reason: 'shortcut.pointerDownCapture' }
      ]
      return {
        effects
      }
    }
    if (event.stage === 'capture') {
      return { effects: [] as InputEffect[] }
    }
    return this.pointerEngine.dispatch(event)
  }

  private handleKey = (
    event: Extract<InputEvent, { kind: 'key' }>
  ): ReturnType<InputControllerType['handle']> => {
    const effects: InputEffect[] = []
    const context = this.getSessionContext()

    if (event.code === 'Space') {
      context.commands.keyboard.setSpacePressed(event.phase === 'down')
      effects.push({ type: 'preventDefault', reason: 'keyboard.space' })
    }

    if (event.phase === 'down' && event.code === 'Escape') {
      effects.push(...this.pointerEngine.cancelActive('escape').effects)
    }

    if (event.phase !== 'down' || event.source !== 'container') {
      return { effects }
    }

    const handled = context.shortcuts.handleKeyDown(
      toKeyShortcutEvent(event),
      withKeyShortcutContext(context.view.getShortcutContext(), event)
    )
    if (handled) {
      effects.push({ type: 'preventDefault', reason: 'shortcut.keyDown' })
      effects.push({ type: 'stopPropagation', reason: 'shortcut.keyDown' })
    }

    return { effects }
  }

  private handleWheel = (
    event: Extract<InputEvent, { kind: 'wheel' }>
  ): ReturnType<InputControllerType['handle']> => {
    const context = this.getSessionContext()
    const viewportConfig = context.input.config.viewport
    const handled = context.services.viewportNavigation.applyWheelZoom({
      clientX: event.client.x,
      clientY: event.client.y,
      deltaY: event.deltaY,
      enableWheel: viewportConfig.enableWheel,
      minZoom: viewportConfig.minZoom,
      maxZoom: viewportConfig.maxZoom,
      wheelSensitivity: viewportConfig.wheelSensitivity
    })
    if (!handled) {
      return { effects: [] as InputEffect[] }
    }
    return {
      effects: [{ type: 'preventDefault', reason: 'viewport.wheelZoom' }]
    }
  }
}
