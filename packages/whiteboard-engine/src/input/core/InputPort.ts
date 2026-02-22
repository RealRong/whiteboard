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

const toShortcutButton = (button: number): 0 | 1 | 2 | undefined => {
  if (button === 0 || button === 1 || button === 2) return button
  return undefined
}

const toPointerShortcutEvent = (
  event: Extract<InputEvent, { kind: 'pointer' }>
) => ({
  button: event.button,
  modifiers: {
    alt: event.modifiers.alt,
    shift: event.modifiers.shift,
    ctrl: event.modifiers.ctrl,
    meta: event.modifiers.meta
  }
})

const toKeyShortcutEvent = (
  event: Extract<InputEvent, { kind: 'key' }>
) => ({
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

const isDeleteKey = (key: string) => key === 'Backspace' || key === 'Delete'

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
      const context = this.getSessionContext()
      context.commands.keyboard.setSpacePressed(false)
      context.commands.interaction.update({
        focus: {
          isEditingText: false,
          isInputFocused: false,
          isImeComposing: false
        }
      })
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
    if (
      event.phase === 'down'
      && event.stage === 'capture'
      && event.target.ignoreInput
    ) {
      return { effects: [] as InputEffect[] }
    }
    if (event.phase === 'move' && event.source === 'container' && event.stage === 'bubble') {
      const enabled = context.state.read('tool') === 'edge'
      context.actors.edge.hoverMove(event.pointer, enabled)
    }
    if (event.phase === 'down' && event.stage === 'capture') {
      context.commands.interaction.update({
        pointer: {
          button: toShortcutButton(event.button),
          modifiers: {
            alt: event.modifiers.alt,
            shift: event.modifiers.shift,
            ctrl: event.modifiers.ctrl,
            meta: event.modifiers.meta
          }
        }
      })
      const handled = context.shortcuts.handlePointerDownCapture(
        toPointerShortcutEvent(event),
        withPointerShortcutContext(context.shortcuts.getContext(), event)
      )
      if (handled) {
        const effects: InputEffect[] = [
          { type: 'preventDefault', reason: 'shortcut.pointerDownCapture' },
          { type: 'stopPropagation', reason: 'shortcut.pointerDownCapture' }
        ]
        return {
          effects
        }
      }
      return this.pointerEngine.dispatch(event)
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
    const ignoreInput = Boolean(event.target.ignoreInput)
    context.commands.interaction.update({
      focus: {
        isEditingText: Boolean(event.target.isTextInput),
        isInputFocused: ignoreInput,
        isImeComposing: event.isComposing ?? false
      },
      pointer: {
        modifiers: {
          alt: event.modifiers.alt,
          shift: event.modifiers.shift,
          ctrl: event.modifiers.ctrl,
          meta: event.modifiers.meta
        }
      }
    })

    if (event.code === 'Space') {
      if (ignoreInput) {
        if (event.phase === 'up') {
          context.commands.keyboard.setSpacePressed(false)
        }
      } else {
        context.commands.keyboard.setSpacePressed(event.phase === 'down')
        effects.push({ type: 'preventDefault', reason: 'keyboard.space' })
      }
    }

    if (ignoreInput) {
      return { effects }
    }

    if (event.phase === 'down' && event.code === 'Escape') {
      effects.push(...this.pointerEngine.cancelActive('escape').effects)
    }

    if (event.phase !== 'down' || event.source !== 'container') {
      return { effects }
    }

    if (
      event.target.role === 'handle'
      && event.target.handleType === 'edge-routing'
      && isDeleteKey(event.key)
    ) {
      effects.push({ type: 'preventDefault', reason: 'edge.routing.removePoint' })
      effects.push({ type: 'stopPropagation', reason: 'edge.routing.removePoint' })
      const edgeId = event.target.edgeId
      const routingIndex = event.target.routingIndex
      if (edgeId && Number.isInteger(routingIndex)) {
        context.actors.edge.removeRoutingPointAt(edgeId, routingIndex as number)
      }
      return { effects }
    }

    const handled = context.shortcuts.handleKeyDown(
      toKeyShortcutEvent(event),
      withKeyShortcutContext(context.shortcuts.getContext(), event)
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
