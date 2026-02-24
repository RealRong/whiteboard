import type {
  InputController as InputControllerType,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import { InputControllerImpl } from './core/InputPort'

type InputContextBase = InputSessionContext

type CreateInputPortOptions = {
  getContext: () => InputContextBase
  sessions?: PointerSession[]
}

export const createInputPort = ({
  getContext,
  sessions
}: CreateInputPortOptions): InputControllerType =>
  new InputControllerImpl({
    getContext,
    sessions
  })

export { InputControllerImpl } from './core/InputPort'
export { PointerSessionEngine } from './core/PointerSessionEngine'
export {
  createDefaultShortcuts,
  createShortcutManager,
  createShortcuts
} from './shortcut'
