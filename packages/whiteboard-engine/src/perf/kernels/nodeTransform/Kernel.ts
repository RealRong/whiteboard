import type { PointerInput, Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  NodeTransformDraft,
  NodeTransformUpdateConstraints,
  ResizeDirection
} from '@engine-types/node'
import type { Guide } from '@engine-types/node/snap'
import type { NodePreviewUpdate } from '@engine-types/state'
import type { NodeId, Operation, Rect } from '@whiteboard/core/types'
import { CommitCompiler } from './CommitCompiler'
import { Rules } from './Rules'

type KernelInstance = Pick<
  InternalInstance,
  'query' | 'config' | 'viewport' | 'document'
>

type KernelOptions = {
  instance: KernelInstance
}

type KernelUpdateResult = {
  nodePreview: NodePreviewUpdate[]
  guides: Guide[]
}

type BeginResizeInput = {
  nodeId: NodeId
  pointer: PointerInput
  handle: ResizeDirection
  rect: Rect
  rotation: number
}

type BeginRotateInput = {
  nodeId: NodeId
  pointer: PointerInput
  rect: Rect
  rotation: number
}

export class NodeTransformKernel {
  private readonly rules: Rules
  private readonly commitCompiler: CommitCompiler

  constructor({ instance }: KernelOptions) {
    this.rules = new Rules({
      config: instance.config,
      query: instance.query,
      readZoom: instance.viewport.getZoom
    })
    this.commitCompiler = new CommitCompiler({
      readDoc: instance.document.get
    })
  }

  beginResize = (
    options: BeginResizeInput
  ): NodeTransformDraft => ({
    nodeId: options.nodeId,
    drag: this.rules.createResizeDrag({
      pointer: options.pointer,
      handle: options.handle,
      rect: options.rect,
      rotation: options.rotation
    })
  })

  beginRotate = (
    options: BeginRotateInput
  ): NodeTransformDraft => ({
    nodeId: options.nodeId,
    drag: this.rules.createRotateDrag({
      pointer: options.pointer,
      rect: options.rect,
      rotation: options.rotation
    })
  })

  update = (
    active: NodeTransformDraft,
    pointer: PointerInput,
    constraints: NodeTransformUpdateConstraints,
    minSize?: Size
  ): KernelUpdateResult => {
    if (active.drag.mode === 'resize') {
      const resolved = this.rules.resolveResizeMove({
        nodeId: active.nodeId,
        drag: active.drag,
        cursorScreen: {
          x: pointer.client.x,
          y: pointer.client.y
        },
        constraints: constraints.resize,
        minSize: this.rules.resolveMinSize(minSize)
      })
      active.drag.lastUpdate = {
        position: resolved.update.position,
        size: resolved.update.size
      }
      return {
        nodePreview: [{
          id: active.nodeId,
          position: resolved.update.position,
          size: resolved.update.size
        }],
        guides: resolved.guides
      }
    }

    const rotation = this.rules.resolveRotate({
      drag: active.drag,
      currentPoint: pointer.world,
      snapToStep: constraints.rotate.snapToStep
    })
    active.drag.currentRotation = rotation
    return {
      nodePreview: [{
        id: active.nodeId,
        rotation
      }],
      guides: []
    }
  }

  commit = (
    active: NodeTransformDraft
  ): Operation[] =>
    active.drag.mode === 'resize'
      ? this.commitCompiler.compileResize(
        active.nodeId,
        active.drag.lastUpdate
      )
      : this.commitCompiler.compileRotate(
        active.nodeId,
        active.drag.currentRotation
      )
}
