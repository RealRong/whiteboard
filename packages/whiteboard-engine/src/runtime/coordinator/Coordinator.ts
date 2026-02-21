import type { Commands } from '@engine-types/commands'
import type {
  ApplyOptions,
  ApplyResult,
  CommandBatchInput,
  ApplyApi,
  TxApi,
  TxCollector
} from '@engine-types/command'
import type {
  CancelReason,
  InputController,
  InputConfig,
  InputEvent,
  InputResult
} from '@engine-types/input'
import type {
  Lifecycle as LifecycleType,
  LifecycleConfig,
  LifecycleViewportConfig
} from '@engine-types/instance/lifecycle'
import { CommandGateway, type CommandGatewayDependencies } from './CommandGateway'
import { InputGateway, type InputRuntime } from './InputGateway'
import { LifecycleGateway, type LifecycleRuntime } from './LifecycleGateway'

export type CoordinatorDependencies = CommandGatewayDependencies & {
  commands: Commands
  input: InputRuntime
  lifecycle: LifecycleRuntime
}

export type CoordinatorApi = {
  applyChange: (input: CommandBatchInput, options?: ApplyOptions) => Promise<ApplyResult>
  runTransaction: TxApi
  handleInput: (event: InputEvent) => InputResult
  configureInput: InputController['configure']
  resetInput: (reason?: CancelReason) => InputResult
  start: () => void
  update: (config: LifecycleConfig) => void
  stop: () => void
}

export class Coordinator implements CoordinatorApi {
  private readonly commandGateway: CommandGateway
  private readonly inputGateway: InputGateway
  private readonly lifecycleGateway: LifecycleGateway
  private readonly commandRuntime: Commands

  constructor({
    commands,
    apply,
    graph,
    view,
    input,
    lifecycle,
    emit
  }: CoordinatorDependencies) {
    this.inputGateway = new InputGateway({ input })
    this.lifecycleGateway = new LifecycleGateway({
      lifecycle,
      onViewportConfigChange: (viewportConfig) => {
        this.inputGateway.configure({
          viewport: this.toInputViewportConfig(viewportConfig)
        })
      }
    })
    this.commandGateway = new CommandGateway({
      apply,
      graph,
      view,
      emit
    })
    this.commandRuntime = commands
  }

  private toInputViewportConfig = (
    viewportConfig: LifecycleViewportConfig
  ): InputConfig['viewport'] => ({
    minZoom: viewportConfig.minZoom,
    maxZoom: viewportConfig.maxZoom,
    enablePan: viewportConfig.enablePan,
    enableWheel: viewportConfig.enableWheel,
    wheelSensitivity: viewportConfig.wheelSensitivity
  })

  applyChange = async (
    input: CommandBatchInput,
    options?: ApplyOptions
  ): Promise<ApplyResult> =>
    this.commandGateway.applyChange(input, options)

  runTransaction: TxApi = async <T>(
    run: (tx: TxCollector) => T | Promise<T>,
    options?: ApplyOptions
  ): Promise<T> =>
    this.commandGateway.runTransaction(run, options)

  handleInput = (event: InputEvent): InputResult =>
    this.inputGateway.handle(event)

  configureInput: InputController['configure'] = (config) => {
    this.inputGateway.configure(config)
  }

  resetInput = (reason?: CancelReason): InputResult =>
    this.inputGateway.reset(reason)

  start = () => {
    this.lifecycleGateway.start()
  }

  update = (config: LifecycleConfig) => {
    this.lifecycleGateway.update(config)
  }

  stop = () => {
    this.lifecycleGateway.stop()
  }

  apply: ApplyApi = async (input, options) =>
    this.commandGateway.apply(input, options)

  tx: TxApi = async (run, options) =>
    this.commandGateway.tx(run, options)

  input: InputController = {
    handle: (event) => this.inputGateway.controller.handle(event),
    configure: (config) => this.inputGateway.controller.configure(config),
    reset: (reason) => this.inputGateway.controller.reset(reason)
  }

  lifecycle: LifecycleType = {
    start: () => this.lifecycleGateway.lifecycle.start(),
    update: (config) => this.lifecycleGateway.lifecycle.update(config),
    stop: () => this.lifecycleGateway.lifecycle.stop()
  }

  get commands(): Commands {
    return this.commandRuntime
  }
}
