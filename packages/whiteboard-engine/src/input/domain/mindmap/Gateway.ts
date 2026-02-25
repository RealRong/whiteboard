import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapMoveDropOptions, MindmapMoveRootOptions } from '@engine-types/commands'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerInput } from '@engine-types/common'
import { Drag } from './Drag'
import type { RuntimeOutput } from './RuntimeOutput'
import { RuntimeWriter } from './RuntimeWriter'

type GatewayInstance = Pick<InternalInstance, 'state' | 'view' | 'config'>

type GatewayOptions = {
  instance: GatewayInstance
  mindmap: {
    moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
    moveSubtreeWithDrop: (options: MindmapMoveDropOptions) => Promise<void>
  }
}

export class MindmapInputGateway {
  private readonly writer: RuntimeWriter
  private readonly drag: Drag

  constructor({ instance, mindmap }: GatewayOptions) {
    this.writer = new RuntimeWriter({
      instance
    })
    this.drag = new Drag({
      instance,
      mindmap,
      emit: this.emit
    })
  }

  private emit = (output: RuntimeOutput) => {
    this.writer.apply(output)
  }

  dragInput = {
    start: (
      treeId: NodeId,
      nodeId: NodeId,
      pointer: PointerInput
    ) =>
      this.drag.start({ treeId, nodeId, pointer }),
    update: (pointer: PointerInput) =>
      this.drag.update({ pointer }),
    end: (pointer: PointerInput) =>
      this.drag.end({ pointer }),
    cancel: () => this.drag.cancel()
  }

  resetTransientState = () => {
    this.drag.reset()
  }

  cancelDrag = () => {
    this.drag.cancel()
  }
}
