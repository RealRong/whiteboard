import type {
  InputConfig,
  InputController as InputControllerType,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import { InputControllerImpl } from './core/InputPort'

type InputContextBase = Omit<InputSessionContext, 'input'>

type CreateInputPortOptions = {
  getContext: () => InputContextBase
  config: InputConfig
  sessions?: PointerSession[]
}

export const createInputPort = ({
  getContext,
  config,
  sessions
}: CreateInputPortOptions): InputControllerType =>
  new InputControllerImpl({
    getContext,
    config,
    sessions
  })

export { InputControllerImpl } from './core/InputPort'
export { PointerSessionEngine } from './core/PointerSessionEngine'
