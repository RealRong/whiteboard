import type { NodeId, NodeInput, NodePatch, Point, Rect } from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { NodeDragGroupOptions } from '@engine-types/node/drag'
import type { NodeViewUpdate } from '@engine-types/state'
import { selectNodeDragStrategy } from '../../node/runtime/drag'
import { computeSnap } from '../../node/utils/snap'

export const createNodeCommands = (
  instance: WhiteboardInstance,
  transient: WhiteboardCommands['transient']
): Pick<WhiteboardCommands, 'groupRuntime' | 'nodeDrag' | 'node' | 'nodeTransform'> => {
  const { core } = instance.runtime
  const { read, write } = instance.state

  const nodeTransform: WhiteboardCommands['nodeTransform'] = {
    rotate: (nodeId, angle) => (core.commands.node.rotate as WhiteboardCommands['node']['rotate'])(nodeId, angle),
    previewResize: (nodeId, update) => {
      transient.nodeOverrides.set([{ id: nodeId, ...update }])
    },
    commitResize: (nodeId, update) => {
      transient.nodeOverrides.commit(update ? [{ id: nodeId, ...update }] : undefined)
    },
    setGuides: (guides) => {
      transient.dragGuides.set(guides)
    },
    clearGuides: () => {
      transient.dragGuides.clear()
    },
    startResize: ({ nodeId, pointerId, handle, clientX, clientY, rect, rotation }) => {
      if (read('nodeTransform').active) return false
      const drag = instance.runtime.services.nodeTransform.createResizeDrag({
        pointerId,
        handle,
        clientX,
        clientY,
        rect,
        rotation
      })
      write('nodeTransform', {
        active: {
          nodeId,
          drag
        }
      })
      return true
    },
    startRotate: ({ nodeId, pointerId, clientX, clientY, rect, rotation }) => {
      if (read('nodeTransform').active) return false
      const drag = instance.runtime.services.nodeTransform.createRotateDrag({
        pointerId,
        clientX,
        clientY,
        rect,
        rotation
      })
      write('nodeTransform', {
        active: {
          nodeId,
          drag
        }
      })
      return true
    },
    update: ({ pointerId, clientX, clientY, minSize, altKey, shiftKey }) => {
      const active = read('nodeTransform').active
      if (!active || active.drag.pointerId !== pointerId) return false

      if (active.drag.mode === 'resize') {
        instance.runtime.services.nodeTransform.applyResizeMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX,
          clientY,
          minSize,
          altKey: Boolean(altKey),
          shiftKey: Boolean(shiftKey)
        })
      } else {
        instance.runtime.services.nodeTransform.applyRotateMove({
          nodeId: active.nodeId,
          drag: active.drag,
          clientX,
          clientY,
          shiftKey: Boolean(shiftKey)
        })
      }

      write('nodeTransform', {
        active
      })
      return true
    },
    end: ({ pointerId }) => {
      const active = read('nodeTransform').active
      if (!active || active.drag.pointerId !== pointerId) return false

      if (active.drag.mode === 'resize') {
        instance.runtime.services.nodeTransform.finishResize({
          nodeId: active.nodeId,
          drag: active.drag
        })
      } else {
        instance.runtime.services.nodeTransform.clear()
      }

      write('nodeTransform', {})
      return true
    },
    cancel: (options) => {
      const active = read('nodeTransform').active
      if (!active) return false
      if (typeof options?.pointerId === 'number' && active.drag.pointerId !== options.pointerId) return false

      if (active.drag.mode === 'resize') {
        transient.nodeOverrides.clear([active.nodeId])
      }
      instance.runtime.services.nodeTransform.clear()
      write('nodeTransform', {})
      return true
    }
  }

  const nodeDragTransient = {
    setOverrides: transient.nodeOverrides.set,
    commitOverrides: transient.nodeOverrides.commit
  }

  const getNodeDragGroupContext = (): NodeDragGroupOptions => ({
    nodes: read('canvasNodes'),
    nodeSize: instance.runtime.config.nodeSize,
    padding: instance.runtime.config.node.groupPadding,
    setHoveredGroupId: (groupId) => {
      write('groupHovered', groupId)
    }
  })

  const setNodeDragHoverGroup = (current: NodeId | undefined, next?: NodeId) => {
    if (current === next) return current
    write('groupHovered', next)
    return next
  }

  const clearNodeDragHoverGroup = (current?: NodeId) => {
    if (current === undefined) return undefined
    write('groupHovered', undefined)
    return undefined
  }

  const resolveNodeDragMove = ({
    nodeId,
    position,
    size,
    childrenIds,
    allowCross
  }: Parameters<WhiteboardCommands['nodeDrag']['resolveMove']>[0]) => {
    if (read('tool') !== 'select') {
      transient.dragGuides.clear()
      return position
    }

    const zoom = Math.max(instance.runtime.viewport.getZoom(), 0.0001)
    const thresholdWorld = Math.min(
      instance.runtime.config.node.snapThresholdScreen / zoom,
      instance.runtime.config.node.snapMaxThresholdWorld
    )

    const movingRect: Rect = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    }
    const queryRect: Rect = {
      x: movingRect.x - thresholdWorld,
      y: movingRect.y - thresholdWorld,
      width: movingRect.width + thresholdWorld * 2,
      height: movingRect.height + thresholdWorld * 2
    }

    const baseCandidates = instance.query.getSnapCandidatesInRect(queryRect)
    const excludeSet = childrenIds?.length ? new Set([nodeId, ...childrenIds]) : new Set([nodeId])
    const candidates = baseCandidates.filter((candidate) => !excludeSet.has(candidate.id))

    const result = computeSnap(movingRect, candidates, thresholdWorld, nodeId, {
      allowCross,
      crossThreshold: thresholdWorld * 0.6
    })

    transient.dragGuides.set(result.guides)

    return {
      x: result.dx !== undefined ? position.x + result.dx : position.x,
      y: result.dy !== undefined ? position.y + result.dy : position.y
    }
  }

  const applyNodePatch = (nodeId: NodeId, patch: NodePatch) => {
    void core.dispatch({ type: 'node.update', id: nodeId, patch })
  }

  const applyNodePositionUpdates = (updates: NodeViewUpdate[]) => {
    if (!updates.length) return
    const positionUpdates = updates
      .filter((update): update is NodeViewUpdate & { position: Point } => Boolean(update.position))
      .map((update) => ({
        id: update.id,
        position: update.position
      }))
    if (!positionUpdates.length) return
    core.model.node.updateMany(
      positionUpdates.map((update) => ({
        id: update.id,
        patch: { position: update.position }
      }))
    )
  }

  const toNodeDragChildrenState = (
    children: { ids: NodeId[]; offsets: Map<NodeId, Point> } | undefined
  ) => {
    if (!children) return undefined
    return {
      ids: children.ids,
      offsets: children.ids
        .map((id) => {
          const offset = children.offsets.get(id)
          if (!offset) return undefined
          return { id, offset }
        })
        .filter((item): item is { id: NodeId; offset: Point } => Boolean(item))
    }
  }

  const toNodeDragChildren = (
    children: { ids: NodeId[]; offsets: Array<{ id: NodeId; offset: Point }> } | undefined
  ) => {
    if (!children) return undefined
    return {
      ids: children.ids,
      offsets: new Map(children.offsets.map((item) => [item.id, item.offset]))
    }
  }

  const startNodeDrag: WhiteboardCommands['nodeDrag']['start'] = ({ nodeId, pointerId, clientX, clientY }) => {
    if (read('nodeDrag').active) return false
    if (read('tool') !== 'select') return false

    const node = read('canvasNodes').find((item) => item.id === nodeId)
    if (!node) return false

    const strategy = selectNodeDragStrategy(node.type)
    const size = {
      width: node.size?.width ?? instance.runtime.config.nodeSize.width,
      height: node.size?.height ?? instance.runtime.config.nodeSize.height
    }

    let hoverGroupId = read('groupHovered')
    const updateHoverGroup = (nextId?: NodeId) => {
      hoverGroupId = setNodeDragHoverGroup(hoverGroupId, nextId)
    }
    const getHoverGroupId = () => hoverGroupId

    const children = strategy.initialize({
      nodeId: node.id,
      nodeType: node.type,
      position: node.position,
      size,
      group: getNodeDragGroupContext(),
      transient: nodeDragTransient,
      applyNodePatch,
      applyNodePositionUpdates,
      updateHoverGroup,
      getHoverGroupId
    })

    hoverGroupId = clearNodeDragHoverGroup(hoverGroupId)

    write('nodeDrag', {
      active: {
        pointerId,
        nodeId: node.id,
        nodeType: node.type,
        start: { x: clientX, y: clientY },
        origin: {
          x: node.position.x,
          y: node.position.y
        },
        size,
        last: {
          x: node.position.x,
          y: node.position.y
        },
        children: toNodeDragChildrenState(children)
      }
    })

    return true
  }

  const updateNodeDrag: WhiteboardCommands['nodeDrag']['update'] = ({
    pointerId,
    clientX,
    clientY,
    altKey
  }) => {
    const active = read('nodeDrag').active
    if (!active || active.pointerId !== pointerId) return false

    const strategy = selectNodeDragStrategy(active.nodeType)
    const zoom = Math.max(instance.runtime.viewport.getZoom(), 0.0001)
    let nextPosition = {
      x: active.origin.x + (clientX - active.start.x) / zoom,
      y: active.origin.y + (clientY - active.start.y) / zoom
    }

    nextPosition = resolveNodeDragMove({
      nodeId: active.nodeId,
      position: nextPosition,
      size: active.size,
      childrenIds: active.children?.ids,
      allowCross: altKey
    })

    let hoverGroupId = read('groupHovered')
    const updateHoverGroup = (nextId?: NodeId) => {
      hoverGroupId = setNodeDragHoverGroup(hoverGroupId, nextId)
    }
    const getHoverGroupId = () => hoverGroupId

    strategy.handleMove({
      drag: {
        pointerId: active.pointerId,
        start: active.start,
        origin: active.origin,
        last: active.last,
        children: toNodeDragChildren(active.children)
      },
      nodeId: active.nodeId,
      nodeType: active.nodeType,
      position: active.origin,
      size: active.size,
      group: getNodeDragGroupContext(),
      transient: nodeDragTransient,
      applyNodePatch,
      applyNodePositionUpdates,
      updateHoverGroup,
      getHoverGroupId,
      nextPosition
    })

    write('nodeDrag', {
      active: {
        ...active,
        last: nextPosition
      }
    })

    return true
  }

  const endNodeDrag: WhiteboardCommands['nodeDrag']['end'] = ({ pointerId }) => {
    const active = read('nodeDrag').active
    if (!active || active.pointerId !== pointerId) return false

    const strategy = selectNodeDragStrategy(active.nodeType)
    let hoverGroupId = read('groupHovered')
    const updateHoverGroup = (nextId?: NodeId) => {
      hoverGroupId = setNodeDragHoverGroup(hoverGroupId, nextId)
    }
    const getHoverGroupId = () => hoverGroupId

    strategy.handlePointerUp({
      drag: {
        pointerId: active.pointerId,
        start: active.start,
        origin: active.origin,
        last: active.last,
        children: toNodeDragChildren(active.children)
      },
      nodeId: active.nodeId,
      nodeType: active.nodeType,
      position: active.origin,
      size: active.size,
      group: getNodeDragGroupContext(),
      transient: nodeDragTransient,
      applyNodePatch,
      applyNodePositionUpdates,
      updateHoverGroup,
      getHoverGroupId
    })

    transient.dragGuides.clear()
    write('nodeDrag', {})

    return true
  }

  const cancelNodeDrag: WhiteboardCommands['nodeDrag']['cancel'] = (options) => {
    const active = read('nodeDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false

    transient.nodeOverrides.clear([active.nodeId, ...(active.children?.ids ?? [])])
    transient.dragGuides.clear()
    clearNodeDragHoverGroup(read('groupHovered'))
    write('nodeDrag', {})

    return true
  }

  return {
    groupRuntime: {
      setHoveredGroupId: (groupId) => {
        write('groupHovered', groupId)
      }
    },
    nodeDrag: {
      start: startNodeDrag,
      update: updateNodeDrag,
      end: endNodeDrag,
      cancel: cancelNodeDrag,
      getGroupContext: getNodeDragGroupContext,
      updateHoverGroup: setNodeDragHoverGroup,
      clearHoverGroup: clearNodeDragHoverGroup,
      resolveMove: resolveNodeDragMove,
      clearGuides: () => {
        transient.dragGuides.clear()
      }
    },
    node: {
      create: (payload: NodeInput) => core.dispatch({ type: 'node.create', payload }),
      update: (id: NodeId, patch: NodePatch) => core.dispatch({ type: 'node.update', id, patch }),
      updateData: (id: NodeId, patch: Record<string, unknown>) => {
        const node = read('canvasNodes').find((item) => item.id === id)
        if (!node) return undefined
        return core.dispatch({
          type: 'node.update',
          id,
          patch: {
            data: {
              ...(node.data ?? {}),
              ...patch
            }
          }
        })
      },
      updateManyPosition: (updates) => {
        if (!updates.length) return
        core.model.node.updateMany(
          updates.map((item) => ({
            id: item.id,
            patch: { position: item.position }
          }))
        )
      },
      delete: (ids: NodeId[]) => core.dispatch({ type: 'node.delete', ids }),
      move: core.commands.node.move as WhiteboardCommands['node']['move'],
      resize: core.commands.node.resize as WhiteboardCommands['node']['resize'],
      rotate: core.commands.node.rotate as WhiteboardCommands['node']['rotate']
    },
    nodeTransform
  }
}
