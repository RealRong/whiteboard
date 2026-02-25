import type {
  InputController as InputControllerType,
  InputEffect,
  InputEvent,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import { PointerSessionEngine } from './PointerSessionEngine'

type InputContextBase = InputSessionContext

type InputControllerOptions = {
  getContext: () => InputContextBase
  sessions?: PointerSession[]
}

const emptyResult = () => ({ effects: [] as InputEffect[] })

const toShortcutButton = (button: number): 0 | 1 | 2 | undefined => {
  if (button === 0 || button === 1 || button === 2) return button
  return undefined
}

export class InputControllerImpl implements InputControllerType {
  private readonly pointerEngine: PointerSessionEngine
  private readonly getContextBase: () => InputContextBase

  constructor({ getContext, sessions }: InputControllerOptions) {
    this.getContextBase = getContext
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
      return emptyResult()
    }
    if (event.kind === 'focus' && event.phase === 'blur') {
      return this.reset('blur')
    }
    return emptyResult()
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

  resetAll: InputControllerType['resetAll'] = (reason = 'forced') => {
    const result = this.reset(reason)
    const context = this.getSessionContext()
    context.inputLifecycle.cancelAll()
    context.inputLifecycle.resetTransientState()
    return result
  }

  private readonly getSessionContext = (): InputSessionContext => this.getContextBase()

  private handlePointerDownCapture = (
    context: InputSessionContext,
    event: Extract<InputEvent, { kind: 'pointer' }>
  ): ReturnType<InputControllerType['handle']> => {
    const isDragging = context.state.read('interaction').pointer.isDragging
    context.commands.interaction.update({
      pointer: {
        isDragging,
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
    const isDragging = context.state.read('interaction').pointer.isDragging
    context.commands.interaction.update({
      focus: {
        isEditingText: Boolean(event.target.isTextInput),
        isInputFocused: ignoreInput,
        isImeComposing: event.isComposing ?? false
      },
      pointer: {
        isDragging,
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

    const handled = context.shortcuts.handleKeyDown(event)
    if (handled) {
      effects.push({ type: 'preventDefault', reason: 'shortcut.keyDown' })
      effects.push({ type: 'stopPropagation', reason: 'shortcut.keyDown' })
    }

    return { effects }
  }
}
