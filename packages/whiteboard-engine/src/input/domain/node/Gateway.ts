import type { PointerInput, Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeOutput } from './RuntimeOutput'
import {
  Planner as NodeDragPlanner,
  type NodeDragCancelInput,
  type NodeDragStartInput
} from './node/Planner'
import {
  Planner as NodeTransformPlanner,
  type NodeTransformCancelInput,
  type NodeTransformStartResizeInput,
  type NodeTransformStartRotateInput
} from './nodeTransform/Planner'
import { RuntimeWriter } from './RuntimeWriter'

type GatewayInstance = Pick<
  InternalInstance,
  | 'state'
  | 'projection'
  | 'query'
  | 'config'
  | 'viewport'
  | 'document'
  | 'mutate'
>

type GatewayOptions = {
  instance: GatewayInstance
}

export class NodeInputGateway {
  private readonly writer: RuntimeWriter
  private readonly nodePlanner: NodeDragPlanner
  private readonly nodeTransformPlanner: NodeTransformPlanner

  constructor({ instance }: GatewayOptions) {
    this.writer = new RuntimeWriter({
      instance
    })
    this.nodePlanner = new NodeDragPlanner({
      instance
    })
    this.nodeTransformPlanner = new NodeTransformPlanner({
      instance
    })
  }

  private apply = (output: RuntimeOutput | undefined) => {
    if (!output) return false
    this.writer.apply(output)
    return true
  }

  node = {
    start: (options: NodeDragStartInput) =>
      this.apply(this.nodePlanner.start(options)),
    update: (pointer: PointerInput) =>
      this.apply(this.nodePlanner.update(pointer)),
    end: (pointer: PointerInput) =>
      this.apply(this.nodePlanner.end(pointer)),
    cancel: (options?: NodeDragCancelInput) =>
      this.apply(this.nodePlanner.cancel(options))
  }

  nodeTransform = {
    startResize: (options: NodeTransformStartResizeInput) =>
      this.apply(
        this.nodeTransformPlanner.startResize(options)
      ),
    startRotate: (options: NodeTransformStartRotateInput) =>
      this.apply(
        this.nodeTransformPlanner.startRotate(options)
      ),
    update: (pointer: PointerInput, minSize?: Size) =>
      this.apply(
        this.nodeTransformPlanner.update(pointer, minSize)
      ),
    end: (pointer: PointerInput) =>
      this.apply(
        this.nodeTransformPlanner.end(pointer)
      ),
    cancel: (options?: NodeTransformCancelInput) =>
      this.apply(
        this.nodeTransformPlanner.cancel(options)
      )
  }
}
