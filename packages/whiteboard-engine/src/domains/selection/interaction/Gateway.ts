import type { InternalInstance } from '@engine-types/instance/instance'
import type { Point } from '@whiteboard/core/types'
import { Box } from './Box'
import type { RuntimeOutput } from './RuntimeOutput'
import { RuntimeWriter } from './RuntimeWriter'

type GatewayInstance = Pick<InternalInstance, 'state' | 'render' | 'query' | 'config'>

type GatewayOptions = {
  instance: GatewayInstance
}

export class SelectionInputGateway {
  private readonly writer: RuntimeWriter
  private readonly box: Box

  constructor({ instance }: GatewayOptions) {
    this.writer = new RuntimeWriter({
      instance
    })
    this.box = new Box({
      instance,
      emit: this.emit
    })
  }

  private emit = (output: RuntimeOutput) => {
    this.writer.apply(output)
  }

  boxInput = {
    start: (options: {
      pointerId: number
      screen: Point
      world: Point
      modifiers: {
        alt: boolean
        shift: boolean
        ctrl: boolean
        meta: boolean
      }
    }) =>
      this.box.start(options),
    update: (options: {
      pointerId: number
      screen: Point
      world: Point
    }) =>
      this.box.update(options),
    end: (pointerId: number) =>
      this.box.end(pointerId),
    cancel: (pointerId?: number) =>
      this.box.cancel(pointerId)
  }

  cancelBox = () => {
    this.box.cancel()
  }

  resetTransientState = () => {
    this.box.reset()
  }
}
