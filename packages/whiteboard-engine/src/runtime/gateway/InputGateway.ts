import type {
  CancelReason,
  InputConfig,
  InputController,
  InputEvent,
  InputResult,
  InputSessionContext,
  PointerSession
} from '@engine-types/input'
import { createInputPort } from '../../input'

type InputContextBase = Omit<InputSessionContext, 'input'>

export type InputRuntime = {
  getContext: () => InputContextBase
  config: InputConfig
  sessions?: PointerSession[]
}

export type InputGatewayDependencies = {
  input: InputRuntime
}

export class InputGateway {
  private readonly inputRuntime: InputController

  constructor({ input }: InputGatewayDependencies) {
    this.inputRuntime = createInputPort(input)
  }

  handle = (event: InputEvent): InputResult =>
    this.inputRuntime.handle(event)

  configure: InputController['configure'] = (config) => {
    this.inputRuntime.configure(config)
  }

  reset = (reason?: CancelReason): InputResult =>
    this.inputRuntime.reset(reason)

  controller: InputController = {
    handle: (event) => this.handle(event),
    configure: (config) => this.configure(config),
    reset: (reason) => this.reset(reason)
  }
}
