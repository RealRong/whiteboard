import type {
  InputConfig,
  InputController as InputControllerType,
  InputEffect,
  InputEvent,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import { PointerSessionEngine } from './PointerSessionEngine'

type InputContextBase = Omit<InputSessionContext, 'input'>

type InputControllerOptions = {
  getContext: () => InputContextBase
  config: InputConfig
  sessions?: PointerSession[]
}

const emptyResult = () => ({ effects: [] as InputEffect[] })

const toShortcutButton = (button: number): 0 | 1 | 2 | undefined => {
  if (button === 0 || button === 1 || button === 2) return button
  return undefined
}

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
    return emptyResult()
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

  private handlePointerHover = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'pointer' }>
  ) => {
    if (event.phase !== 'move' || event.stage !== 'bubble' || event.source !== 'container') {
      return
    }
    const enabled = context.state.read('tool') === 'edge'
    context.actors.edge.hoverMove(event.pointer, enabled)
  }

  private handlePointerDownCapture = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'pointer' }>
  ): ReturnType<InputControllerType['handle']> => {
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
    const handled = context.shortcuts.handlePointerDownCapture(event)
    if (handled) {
      return {
        effects: [
          { type: 'preventDefault', reason: 'shortcut.pointerDownCapture' },
          { type: 'stopPropagation', reason: 'shortcut.pointerDownCapture' }
        ]
      }
    }
    return this.pointerEngine.dispatch(event)
  }

  private handlePointer = (
    event: Extract<InputEvent, { kind: 'pointer' }>
  ): ReturnType<InputControllerType['handle']> => {
    const context = this.getSessionContext()

    if (
      event.phase === 'down'
      && event.stage === 'capture'
      && event.target.ignoreInput
    ) {
      return emptyResult()
    }

    this.handlePointerHover(context, event)

    if (event.phase === 'down' && event.stage === 'capture') {
      return this.handlePointerDownCapture(context, event)
    }

    if (event.stage === 'capture') {
      return emptyResult()
    }

    return this.pointerEngine.dispatch(event)
  }

  private updateInteractionFromKey = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'key' }>,
    ignoreInput: boolean
  ) => {
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
  }

  private handleSpaceKey = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'key' }>,
    ignoreInput: boolean,
    effects: InputEffect[]
  ) => {
    if (event.code !== 'Space') return

    if (ignoreInput) {
      if (event.phase === 'up') {
        context.commands.keyboard.setSpacePressed(false)
      }
      return
    }

    context.commands.keyboard.setSpacePressed(event.phase === 'down')
    effects.push({ type: 'preventDefault', reason: 'keyboard.space' })
  }

  private handleEdgeRoutingDelete = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'key' }>,
    effects: InputEffect[]
  ) => {
    if (
      event.target.role !== 'handle'
      || event.target.handleType !== 'edge-routing'
      || !isDeleteKey(event.key)
    ) {
      return false
    }

    effects.push({ type: 'preventDefault', reason: 'edge.routing.removePoint' })
    effects.push({ type: 'stopPropagation', reason: 'edge.routing.removePoint' })
    const edgeId = event.target.edgeId
    const routingIndex = event.target.routingIndex
    if (edgeId && Number.isInteger(routingIndex)) {
      context.actors.edge.removeRoutingPointAt(edgeId, routingIndex as number)
    }
    return true
  }

  private handleKey = (
    event: Extract<InputEvent, { kind: 'key' }>
  ): ReturnType<InputControllerType['handle']> => {
    const effects: InputEffect[] = []
    const context = this.getSessionContext()
    const ignoreInput = Boolean(event.target.ignoreInput)

    this.updateInteractionFromKey(context, event, ignoreInput)
    this.handleSpaceKey(context, event, ignoreInput, effects)

    if (ignoreInput) {
      return { effects }
    }

    if (event.phase === 'down' && event.code === 'Escape') {
      effects.push(...this.pointerEngine.cancelActive('escape').effects)
    }

    if (event.phase !== 'down' || event.source !== 'container') {
      return { effects }
    }

    if (this.handleEdgeRoutingDelete(context, event, effects)) {
      return { effects }
    }

    const handled = context.shortcuts.handleKeyDown(event)
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
      return emptyResult()
    }
    return {
      effects: [{ type: 'preventDefault', reason: 'viewport.wheelZoom' }]
    }
  }
}
