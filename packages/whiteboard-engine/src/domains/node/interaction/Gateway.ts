import type { PointerInput, Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  NodeDragDraft,
  NodeDragUpdateConstraints,
  NodeTransformDraft,
  NodeTransformUpdateConstraints,
  ResizeDirection
} from '@engine-types/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { NodeDragKernel } from './node/Kernel'
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
  private readonly nodeDragKernel: NodeDragKernel
  private readonly nodeTransformKernel: NodeTransformKernel

  constructor({ instance }: GatewayOptions) {
    this.writer = new RuntimeWriter({
      instance
    })
    this.render = instance.render
    this.nodeDragKernel = new NodeDragKernel({
      instance
    })
    this.nodeTransformKernel = new NodeTransformKernel({
      instance
    })
  }

  private isNodeDragDraftActive = (draft: NodeDragDraft) => {
    const active = this.render.read('interactionSession').active
    return Boolean(
      active
      && active.kind === 'nodeDrag'
      && active.pointerId === draft.pointerId
    )
  }

  private beginDrag = (draft: NodeDragDraft | undefined) => {
    if (!draft) return undefined
    const active = this.render.read('interactionSession').active
    if (active) return undefined
    this.writer.apply({
      interaction: {
        kind: 'nodeDrag',
        pointerId: draft.pointerId
      },
      groupHover: undefined,
      nodePayload: {
        drag: {
          pointerId: draft.pointerId,
          nodeId: draft.nodeId,
          nodeType: draft.nodeType
        }
      },
      nodePreview: [],
      guides: []
    })
    return draft
  }

  node = {
    begin: (options: {
      nodeId: NodeId
      pointer: PointerInput
    }) => this.beginDrag(this.nodeDragKernel.begin(options)),
    updateDraft: (options: {
      draft: NodeDragDraft
      pointer: PointerInput
      constraints: NodeDragUpdateConstraints
    }) => {
      const { draft, pointer, constraints } = options
      if (pointer.pointerId !== draft.pointerId) return false
      if (!this.isNodeDragDraftActive(draft)) return false
      const resolved = this.nodeDragKernel.update(
        draft,
        pointer,
        constraints
      )
      this.writer.apply({
        frame: true,
        groupHover: resolved.groupHover,
        nodePayload: {
          drag: {
            pointerId: draft.pointerId,
            nodeId: draft.nodeId,
            nodeType: draft.nodeType
          }
        },
        nodePreview: resolved.nodePreview,
        guides: resolved.guides
      })
      return true
    },
    commitDraft: (draft: NodeDragDraft) => {
      if (!this.isNodeDragDraftActive(draft)) return false
      const mutations = this.nodeDragKernel.commit(draft)
      this.writer.apply({
        interaction: {
          kind: 'nodeDrag',
          pointerId: null
        },
        groupHover: undefined,
        nodePayload: {
          drag: null
        },
        nodePreview: [],
        guides: [],
        mutations
      })
      return true
    },
    cancelDraft: (options?: { draft?: NodeDragDraft }) => {
      const active = this.render.read('interactionSession').active
      if (!active || active.kind !== 'nodeDrag') return false
      if (
        options?.draft
        && active.pointerId !== options.draft.pointerId
      ) {
        return false
      }
      this.writer.apply({
        interaction: {
          kind: 'nodeDrag',
          pointerId: null
        },
        groupHover: undefined,
        nodePayload: {
          drag: null
        },
        nodePreview: [],
        guides: []
      })
      return true
    }
  }

  private isTransformDraftActive = (draft: NodeTransformDraft) => {
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
      if (!this.isTransformDraftActive(draft)) return false
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
      if (!this.isTransformDraftActive(draft)) return false
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
    this.node.cancelDraft()
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
