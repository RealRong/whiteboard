import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapMoveDropOptions, MindmapMoveRootOptions } from '@engine-types/commands'
import type { NodeId } from '@whiteboard/core/types'
import type { PointerInput } from '@engine-types/common'
import { Drag } from './Drag'

type GatewayInstance = Pick<InternalInstance, 'state' | 'view' | 'config'>

type GatewayOptions = {
  instance: GatewayInstance
  mindmap: {
    moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
    moveSubtreeWithDrop: (options: MindmapMoveDropOptions) => Promise<void>
  }
}

export class MindmapInputGateway {
  private readonly drag: Drag

  constructor({ instance, mindmap }: GatewayOptions) {
    this.drag = new Drag({
      instance,
      mindmap
    })
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
