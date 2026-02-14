import {
  getSide,
  type MindmapNodeId
} from '@whiteboard/core'
import type {
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Rect
} from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { NodeDragGroupOptions } from '@engine-types/node/drag'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import { computeSnap } from '../../node/utils/snap'
import { createEdgeConnectCommands } from './createEdgeConnectCommands'
import { createSelectionCommands } from './createSelectionCommands'
import { createTransientCommands } from './createTransientCommands'
import { mergeInteractionPatch } from '../state/interactionState'

export const createWhiteboardCommands = (instance: WhiteboardInstance): WhiteboardCommands => {
  const { core } = instance.runtime
  const { read, write } = instance.state

  const selection = createSelectionCommands(instance)
  const { edgeConnect } = createEdgeConnectCommands(instance)
  const transient = createTransientCommands(instance)
  const mindmapCommands = core.commands.mindmap

  const toLayoutHint = (anchorId: MindmapNodeId, nodeSize: { width: number; height: number }, layout: MindmapLayoutConfig) => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  const resolveRootInsertSide = (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ): 'left' | 'right' => {
    if (placement === 'left') return 'left'
    if (placement === 'right') return 'right'
    const layoutSide = layout.options?.side
    return layoutSide === 'left' || layoutSide === 'right' ? layoutSide : 'right'
  }

  const insertMindmapNode: WhiteboardCommands['mindmap']['insertNode'] = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload = { kind: 'text', text: '' }
  }) => {
    const layoutHint = toLayoutHint(targetNodeId, nodeSize, layout)

    if (targetNodeId === tree.rootId) {
      const children = tree.children[targetNodeId] ?? []
      const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
      const side = resolveRootInsertSide(placement, layout)
      await mindmapCommands.addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await mindmapCommands.addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getSide(tree, targetNodeId) ?? 'right'
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await mindmapCommands.addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return
      await mindmapCommands.moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await mindmapCommands.addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  const moveSubtreeWithLayout: WhiteboardCommands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    mindmapCommands.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveSubtreeWithDrop: WhiteboardCommands['mindmap']['moveSubtreeWithDrop'] = async ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }) => {
    const shouldMove =
      drop.parentId !== origin?.parentId || drop.index !== origin?.index || typeof drop.side !== 'undefined'
    if (!shouldMove) return

    await moveSubtreeWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  const moveMindmapRoot: WhiteboardCommands['mindmap']['moveRoot'] = async ({ nodeId, position, threshold = 0.5 }) => {
    const node = read('canvasNodes').find((item) => item.id === nodeId)
    if (!node) return
    if (Math.abs(node.position.x - position.x) < threshold && Math.abs(node.position.y - position.y) < threshold) {
      return
    }

    await core.dispatch({
      type: 'node.update',
      id: nodeId,
      patch: {
        position: { x: position.x, y: position.y }
      }
    })
  }

  const selectEdge: WhiteboardCommands['edge']['select'] = (id) => {
    write('edgeSelection', (prev) => (prev === id ? prev : id))
  }

  const insertRoutingPoint: WhiteboardCommands['edge']['insertRoutingPoint'] = (
    edge,
    pathPoints,
    segmentIndex,
    pointWorld
  ) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const basePoints = edge.routing?.points?.length ? edge.routing.points : pathPoints.slice(1, -1)
    const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
    const nextPoints = [...basePoints]
    nextPoints.splice(insertIndex, 0, pointWorld)
    void core.dispatch({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    })
  }

  const insertRoutingPointAtClient: WhiteboardCommands['edge']['insertRoutingPointAtClient'] = (
    edge,
    pathPoints,
    clientX,
    clientY
  ) => {
    const pointScreen = instance.runtime.viewport.clientToScreen(clientX, clientY)
    const pointWorld = instance.runtime.viewport.screenToWorld(pointScreen)
    const segmentIndex = instance.query.getNearestEdgeSegmentIndexAtWorld(pointWorld, pathPoints)
    insertRoutingPoint(edge, pathPoints, segmentIndex, pointWorld)
    selectEdge(edge.id)
  }

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
    }
  }

  return {
    tool: {
      set: (tool) => {
        write('tool', tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        write('spacePressed', pressed)
      }
    },
    history: {
      configure: (config) => {
        core.commands.history.configure(config)
      },
      undo: () => {
        if (!read('history').canUndo) return false
        return core.commands.history.undo()
      },
      redo: () => {
        if (!read('history').canRedo) return false
        return core.commands.history.redo()
      },
      clear: () => {
        core.commands.history.clear()
      }
    },
    interaction: {
      update: (patch) => {
        write('interaction', (prev) => mergeInteractionPatch(prev, patch))
      },
      clearHover: () => {
        write('interaction', (prev) =>
          mergeInteractionPatch(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    },
    selection,
    edge: {
      insertRoutingPoint,
      insertRoutingPointAtClient,
      moveRoutingPoint: (edge, index, pointWorld) => {
        if (edge.type === 'bezier' || edge.type === 'curve') return
        const points = edge.routing?.points ?? []
        if (index < 0 || index >= points.length) return
        const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
        void core.dispatch({
          type: 'edge.update',
          id: edge.id,
          patch: {
            routing: {
              ...(edge.routing ?? {}),
              mode: 'manual',
              points: nextPoints
            }
          }
        })
      },
      removeRoutingPoint: (edge, index) => {
        if (edge.type === 'bezier' || edge.type === 'curve') return
        const points = edge.routing?.points ?? []
        if (index < 0 || index >= points.length) return
        const nextPoints = points.filter((_, idx) => idx !== index)
        if (nextPoints.length === 0) {
          void core.dispatch({
            type: 'edge.update',
            id: edge.id,
            patch: {
              routing: {
                ...(edge.routing ?? {}),
                mode: 'auto',
                points: undefined
              }
            }
          })
          return
        }
        void core.dispatch({
          type: 'edge.update',
          id: edge.id,
          patch: {
            routing: {
              ...(edge.routing ?? {}),
              mode: 'manual',
              points: nextPoints
            }
          }
        })
      },
      resetRouting: (edge) => {
        void core.dispatch({
          type: 'edge.update',
          id: edge.id,
          patch: {
            routing: {
              ...(edge.routing ?? {}),
              mode: 'auto',
              points: undefined
            }
          }
        })
      },
      create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => core.dispatch({ type: 'edge.delete', ids }),
      connect: core.commands.edge.connect as WhiteboardCommands['edge']['connect'],
      reconnect: core.commands.edge.reconnect as WhiteboardCommands['edge']['reconnect'],
      select: selectEdge
    },
    edgeConnect,
    groupRuntime: {
      setHoveredGroupId: (groupId) => {
        write('groupHovered', groupId)
      }
    },
    nodeDrag: {
      getGroupContext: () => {
        const context: NodeDragGroupOptions = {
          nodes: read('canvasNodes'),
          nodeSize: instance.runtime.config.nodeSize,
          padding: instance.runtime.config.node.groupPadding,
          setHoveredGroupId: (groupId) => {
            write('groupHovered', groupId)
          }
        }
        return context
      },
      updateHoverGroup: (current, next) => {
        if (current === next) return current
        write('groupHovered', next)
        return next
      },
      clearHoverGroup: (current) => {
        if (current === undefined) return undefined
        write('groupHovered', undefined)
        return undefined
      },
      resolveMove: ({ nodeId, position, size, childrenIds, allowCross }) => {
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
      },
      clearGuides: () => {
        transient.dragGuides.clear()
      }
    },
    transient,
    order: core.commands.order,
    viewport: core.commands.viewport,
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
    nodeTransform,
    group: core.commands.group as WhiteboardCommands['group'],
    mindmap: {
      ...mindmapCommands,
      insertNode: insertMindmapNode,
      moveSubtreeWithLayout,
      moveSubtreeWithDrop,
      moveRoot: moveMindmapRoot
    }
  }
}
