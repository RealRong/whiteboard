import type { PointerInput, Size } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { ResizeDirection, ResizeDragState } from '@engine-types/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import type { NodeTransformRuntimeOutput } from '../RuntimeOutput'
import { CommitCompiler } from './CommitCompiler'
import { Rules } from './Rules'
import { SessionStore } from './SessionStore'

type PlannerInstance = Pick<
  InternalInstance,
  'state' | 'query' | 'config' | 'viewport' | 'document'
>

export type NodeTransformStartResizeInput = {
  nodeId: NodeId
  pointer: PointerInput
  handle: ResizeDirection
  rect: Rect
  rotation: number
}

export type NodeTransformStartRotateInput = {
  nodeId: NodeId
  pointer: PointerInput
  rect: Rect
  rotation: number
}

export type NodeTransformCancelInput = {
  pointer?: PointerInput
}

type PlannerOptions = {
  instance: PlannerInstance
}

export class Planner {
  private readonly state: PlannerInstance['state']
  private readonly rules: Rules
  private readonly commitCompiler: CommitCompiler
  private readonly sessions = new SessionStore()

  constructor({ instance }: PlannerOptions) {
    this.state = instance.state
    this.rules = new Rules({
      config: instance.config,
      query: instance.query,
      readTool: () => this.state.read('tool'),
      readZoom: instance.viewport.getZoom
    })
    this.commitCompiler = new CommitCompiler({
      readDoc: instance.document.get
    })
  }

  startResize = (
    options: NodeTransformStartResizeInput
  ): NodeTransformRuntimeOutput | undefined => {
    if (this.state.read('interactionSession').active) return undefined
    const drag = this.rules.createResizeDrag({
      pointer: options.pointer,
      handle: options.handle,
      rect: options.rect,
      rotation: options.rotation
    })
    this.sessions.begin({
      nodeId: options.nodeId,
      drag
    })
    return {
      interaction: {
        kind: 'nodeTransform',
        pointerId: options.pointer.pointerId
      },
      nodePayload: {
        transform: {
          nodeId: options.nodeId,
          drag
        }
      },
      nodePreview: []
    }
  }

  startRotate = (
    options: NodeTransformStartRotateInput
  ): NodeTransformRuntimeOutput | undefined => {
    if (this.state.read('interactionSession').active) return undefined
    const drag = this.rules.createRotateDrag({
      pointer: options.pointer,
      rect: options.rect,
      rotation: options.rotation
    })
    this.sessions.begin({
      nodeId: options.nodeId,
      drag
    })
    return {
      interaction: {
        kind: 'nodeTransform',
        pointerId: options.pointer.pointerId
      },
      nodePayload: {
        transform: {
          nodeId: options.nodeId,
          drag
        }
      },
      nodePreview: []
    }
  }

  update = (
    pointer: PointerInput,
    minSize?: Size
  ): NodeTransformRuntimeOutput | undefined => {
    const active = this.readActive(pointer.pointerId)
    if (!active) return undefined

    if (active.drag.mode === 'resize') {
      const resolved = this.rules.resolveResizeMove({
        nodeId: active.nodeId,
        drag: active.drag,
        pointer,
        minSize: this.rules.resolveMinSize(minSize)
      })
      const lastUpdate: ResizeDragState['lastUpdate'] = {
        position: resolved.update.position,
        size: resolved.update.size
      }
      active.drag.lastUpdate = lastUpdate
      return {
        frame: true,
        nodePreview: [{
          id: active.nodeId,
          position: resolved.update.position,
          size: resolved.update.size
        }],
        guides: resolved.guides,
        nodePayload: {
          transform: {
            nodeId: active.nodeId,
            drag: active.drag
          }
        }
      }
    }

    const rotation = this.rules.resolveRotate({
      drag: active.drag,
      pointer
    })
    active.drag.currentRotation = rotation
    return {
      frame: true,
      nodePreview: [{
        id: active.nodeId,
        rotation
      }],
      guides: [],
      nodePayload: {
        transform: {
          nodeId: active.nodeId,
          drag: active.drag
        }
      }
    }
  }

  end = (
    pointer: PointerInput
  ): NodeTransformRuntimeOutput | undefined => {
    const active = this.readActive(pointer.pointerId)
    if (!active) return undefined

    let mutations: NodeTransformRuntimeOutput['mutations']
    if (active.drag.mode === 'resize') {
      mutations = this.commitCompiler.compileResize(
        active.nodeId,
        active.drag.lastUpdate
      )
    } else {
      mutations = this.commitCompiler.compileRotate(
        active.nodeId,
        active.drag.currentRotation
      )
    }

    this.sessions.clear()
    return {
      interaction: {
        kind: 'nodeTransform',
        pointerId: null
      },
      nodePayload: {
        transform: null
      },
      nodePreview: [],
      guides: [],
      mutations
    }
  }

  cancel = (
    options?: NodeTransformCancelInput
  ): NodeTransformRuntimeOutput | undefined => {
    const active = this.readActive(options?.pointer?.pointerId)
    if (!active) return undefined

    this.sessions.clear()
    return {
      interaction: {
        kind: 'nodeTransform',
        pointerId: null
      },
      nodePayload: {
        transform: null
      },
      nodePreview: [],
      guides: []
    }
  }

  private readActive = (pointerId?: number) => {
    const active = this.sessions.read(pointerId)
    if (!active) return undefined
    const interaction = this.state.read('interactionSession').active
    if (
      !interaction ||
      interaction.kind !== 'nodeTransform' ||
      interaction.pointerId !== active.drag.pointerId
    ) {
      this.sessions.clear()
      return undefined
    }
    return active
  }
}
