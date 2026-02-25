import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeDragRuntimeOutput } from '../RuntimeOutput'
import { CommitCompiler } from './CommitCompiler'
import { Rules } from './Rules'
import { SessionStore } from './SessionStore'

type PlannerInstance = Pick<
  InternalInstance,
  'state' | 'render' | 'projection' | 'query' | 'config' | 'viewport' | 'document'
>

export type NodeDragStartInput = {
  nodeId: NodeId
  pointer: PointerInput
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

export type NodeDragCancelInput = {
  pointer?: PointerInput
}

type PlannerOptions = {
  instance: PlannerInstance
}

export class Planner {
  private readonly state: PlannerInstance['state']
  private readonly render: PlannerInstance['render']
  private readonly projection: PlannerInstance['projection']
  private readonly nodeSize: PlannerInstance['config']['nodeSize']
  private readonly rules: Rules
  private readonly commitCompiler: CommitCompiler
  private readonly sessions = new SessionStore()

  constructor({ instance }: PlannerOptions) {
    this.state = instance.state
    this.render = instance.render
    this.projection = instance.projection
    this.nodeSize = instance.config.nodeSize
    const readCanvasNodes = () => this.projection.getSnapshot().nodes.canvas
    this.rules = new Rules({
      config: instance.config,
      query: instance.query,
      readTool: () => this.state.read('tool'),
      readZoom: instance.viewport.getZoom,
      readCanvasNodes
    })
    this.commitCompiler = new CommitCompiler({
      readDoc: instance.document.get,
      readCanvasNodes,
      config: instance.config
    })
  }

  start = ({
    nodeId,
    pointer,
    modifiers
  }: NodeDragStartInput): NodeDragRuntimeOutput | undefined => {
    if (this.readSession()) return undefined
    if (this.render.read('interactionSession').active) return undefined
    if (this.state.read('tool') !== 'select') return undefined

    const nodes = this.projection.getSnapshot().nodes.canvas
    const node = nodes.find((item) => item.id === nodeId)
    if (!node || node.locked) return undefined

    const size = {
      width: node.size?.width ?? this.nodeSize.width,
      height: node.size?.height ?? this.nodeSize.height
    }
    const origin = {
      x: node.position.x,
      y: node.position.y
    }

    this.sessions.begin({
      pointerId: pointer.pointerId,
      nodeId: node.id,
      nodeType: node.type,
      start: {
        x: pointer.client.x,
        y: pointer.client.y
      },
      origin,
      last: origin,
      size,
      children:
        node.type === 'group'
          ? this.rules.buildGroupChildren(nodes, node.id, origin)
          : undefined
    })

    return {
      selection: this.rules.createSelectionPatchOnStart(
        this.state.read('selection'),
        node.id,
        modifiers
      ),
      interaction: {
        kind: 'nodeDrag',
        pointerId: pointer.pointerId
      },
      nodePayload: {
        drag: {
          pointerId: pointer.pointerId,
          nodeId: node.id,
          nodeType: node.type
        }
      },
      nodePreview: []
    }
  }

  update = (
    pointer: PointerInput
  ): NodeDragRuntimeOutput | undefined => {
    const session = this.readSession(pointer.pointerId)
    if (!session) return undefined

    const resolved = this.rules.resolveMove({
      nodeId: session.nodeId,
      position: this.rules.resolvePosition(session, pointer),
      size: session.size,
      childrenIds: session.children?.ids,
      allowCross: pointer.modifiers.alt
    })
    const nextPosition = resolved.position
    const previewUpdates = session.children
      ? this.rules.buildGroupUpdates(session, nextPosition)
      : [
        {
          id: session.nodeId,
          position: nextPosition
        }
      ]

    this.sessions.updateLast(nextPosition)

    const hoveredGroupId = session.children
      ? undefined
      : this.rules.resolveHoveredGroup(
        session.nodeId,
        session.size,
        nextPosition
      )

    return {
      frame: true,
      nodePreview: previewUpdates,
      guides: resolved.guides,
      nodePayload: {
        drag: {
          pointerId: session.pointerId,
          nodeId: session.nodeId,
          nodeType: session.nodeType
        }
      },
      groupHover: hoveredGroupId
    }
  }

  end = (
    pointer: PointerInput
  ): NodeDragRuntimeOutput | undefined => {
    const session = this.readSession(pointer.pointerId)
    if (!session) return undefined

    const finalPosition = session.last
    const updates = session.children
      ? this.rules.buildGroupUpdates(session, finalPosition)
      : [
        {
          id: session.nodeId,
          position: finalPosition
        }
      ]
    const operations = this.commitCompiler.compile({
      session,
      finalPosition,
      updates,
      hoveredGroupId: this.render.read('groupHover').nodeId
    })
    this.sessions.clear()

    return {
      groupHover: undefined,
      interaction: {
        kind: 'nodeDrag',
        pointerId: null
      },
      nodePayload: {
        drag: null
      },
      nodePreview: [],
      guides: [],
      mutations: operations
    }
  }

  cancel = (
    options?: NodeDragCancelInput
  ): NodeDragRuntimeOutput | undefined => {
    const session = this.readSession(options?.pointer?.pointerId)
    if (!session) return undefined

    this.sessions.clear()
    return {
      groupHover: undefined,
      interaction: {
        kind: 'nodeDrag',
        pointerId: null
      },
      nodePayload: {
        drag: null
      },
      nodePreview: [],
      guides: []
    }
  }

  private readSession = (pointerId?: number) => {
    const session = this.sessions.read(pointerId)
    if (!session) return undefined
    const active = this.render.read('interactionSession').active
    if (
      !active ||
      active.kind !== 'nodeDrag' ||
      active.pointerId !== session.pointerId
    ) {
      this.sessions.clear()
      return undefined
    }
    return session
  }
}
