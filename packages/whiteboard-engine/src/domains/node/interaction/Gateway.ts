import type { PointerInput, Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  NodeTransformDraft,
  NodeTransformUpdateConstraints,
  ResizeDirection
} from '@engine-types/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import type { RuntimeOutput } from './RuntimeOutput'
import {
  Planner as NodeDragPlanner,
  type NodeDragCancelInput,
  type NodeDragStartInput
} from './node/Planner'
import { NodeTransformKernel } from './nodeTransform/Kernel'
import { RuntimeWriter } from './RuntimeWriter'

type GatewayInstance = Pick<
  InternalInstance,
  | 'state'
  | 'render'
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

export type NodeTransformBeginResizeInput = {
  nodeId: NodeId
  pointer: PointerInput
  handle: ResizeDirection
  rect: Rect
  rotation: number
}

export type NodeTransformBeginRotateInput = {
  nodeId: NodeId
  pointer: PointerInput
  rect: Rect
  rotation: number
}

export class NodeInputGateway {
  private readonly writer: RuntimeWriter
  private readonly render: GatewayInstance['render']
  private readonly nodePlanner: NodeDragPlanner
  private readonly nodeTransformKernel: NodeTransformKernel

  constructor({ instance }: GatewayOptions) {
    this.writer = new RuntimeWriter({
      instance
    })
    this.render = instance.render
    this.nodePlanner = new NodeDragPlanner({
      instance
    })
    this.nodeTransformKernel = new NodeTransformKernel({
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

  private isDraftActive = (draft: NodeTransformDraft) => {
    const active = this.render.read('interactionSession').active
    return Boolean(
      active
      && active.kind === 'nodeTransform'
      && active.pointerId === draft.drag.pointerId
    )
  }

  private beginTransform = (draft: NodeTransformDraft) => {
    const active = this.render.read('interactionSession').active
    if (active) return undefined
    this.writer.apply({
      interaction: {
        kind: 'nodeTransform',
        pointerId: draft.drag.pointerId
      },
      nodePreview: [],
      guides: []
    })
    return draft
  }

  nodeTransform = {
    beginResize: (options: NodeTransformBeginResizeInput) =>
      this.beginTransform(
        this.nodeTransformKernel.beginResize(options)
      ),
    beginRotate: (options: NodeTransformBeginRotateInput) =>
      this.beginTransform(
        this.nodeTransformKernel.beginRotate(options)
      ),
    updateDraft: (options: {
      draft: NodeTransformDraft
      pointer: PointerInput
      constraints: NodeTransformUpdateConstraints
      minSize?: Size
    }) => {
      const {
        draft,
        pointer,
        constraints,
        minSize
      } = options
      if (pointer.pointerId !== draft.drag.pointerId) return false
      if (!this.isDraftActive(draft)) return false
      const resolved = this.nodeTransformKernel.update(
        draft,
        pointer,
        constraints,
        minSize
      )
      this.writer.apply({
        frame: true,
        nodePreview: resolved.nodePreview,
        guides: resolved.guides
      })
      return true
    },
    commitDraft: (draft: NodeTransformDraft) => {
      if (!this.isDraftActive(draft)) return false
      const mutations = this.nodeTransformKernel.commit(draft)
      this.writer.apply({
        interaction: {
          kind: 'nodeTransform',
          pointerId: null
        },
        nodePreview: [],
        guides: [],
        mutations
      })
      return true
    },
    cancelDraft: (options?: { draft?: NodeTransformDraft }) => {
      const active = this.render.read('interactionSession').active
      if (!active || active.kind !== 'nodeTransform') return false
      if (
        options?.draft
        && active.pointerId !== options.draft.drag.pointerId
      ) {
        return false
      }
      this.writer.apply({
        interaction: {
          kind: 'nodeTransform',
          pointerId: null
        },
        nodePreview: [],
        guides: []
      })
      return true
    }
  }

  cancelInteractions = () => {
    this.node.cancel()
    this.nodeTransform.cancelDraft()
  }

  resetTransientState = () => {
    this.writer.apply({
      clearInteractions: ['nodeDrag', 'nodeTransform'],
      groupHover: undefined,
      nodePayload: {
        drag: null
      },
      nodePreview: [],
      guides: []
    })
  }
}
