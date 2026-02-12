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
import type { WhiteboardCommands } from 'types/commands'
import type { NodeDragGroupOptions } from 'types/node/drag'
import type { WhiteboardInstance } from 'types/instance'
import { edgeSelectionAtom, interactionAtom, spacePressedAtom, toolAtom } from '../../state'
import { groupHoveredAtom } from '../../../node/state'
import { computeSnap } from '../../../node/utils/snap'
import { createEdgeConnectCommands } from './createEdgeConnectCommands'
import { createSelectionCommands } from './createSelectionCommands'
import { createTransientCommands } from './createTransientCommands'
import { mergeInteractionPatch } from '../state/interactionState'
import { setStoreAtom } from '../store/setStoreAtom'

const runRegisteredCommand = (
  instance: WhiteboardInstance,
  names: string[]
): boolean => {
  const { core } = instance.runtime
  for (const name of names) {
    const command = core.registries.commands.get(name)
    if (!command) continue
    command()
    return true
  }
  return false
}

export const createWhiteboardCommands = (instance: WhiteboardInstance): WhiteboardCommands => {
  const { core } = instance.runtime
  const { store } = instance.state

  const selection = createSelectionCommands(instance)
  const { edgeConnect } = createEdgeConnectCommands(instance)
  const transient = createTransientCommands(instance)

  return {
    tool: {
      set: (tool) => {
        setStoreAtom(store, toolAtom, tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        setStoreAtom(store, spacePressedAtom, pressed)
      }
    },
    history: {
      undo: () => {
        if (!instance.state.read('history').canUndo) return false
        return runRegisteredCommand(instance, ['history.undo', 'undo'])
      },
      redo: () => {
        if (!instance.state.read('history').canRedo) return false
        return runRegisteredCommand(instance, ['history.redo', 'redo'])
      },
      clear: () => {
        runRegisteredCommand(instance, ['history.clear'])
      }
    },
    interaction: {
      update: (patch) => {
        setStoreAtom(store, interactionAtom, (prev) => mergeInteractionPatch(prev, patch))
      },
      clearHover: () => {
        setStoreAtom(store, interactionAtom, (prev) =>
          mergeInteractionPatch(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    },
    selection,
    edge: {
      insertRoutingPoint: (edge, pathPoints, segmentIndex, pointWorld) => {
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
      },
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
      select: (id) => {
        setStoreAtom(store, edgeSelectionAtom, (prev) => (prev === id ? prev : id))
      }
    },
    edgeConnect,
    groupRuntime: {
      setHoveredGroupId: (groupId) => {
        setStoreAtom(store, groupHoveredAtom, groupId)
      }
    },
    nodeDrag: {
      getGroupContext: () => {
        const context: NodeDragGroupOptions = {
          nodes: instance.state.read('canvasNodes'),
          nodeSize: instance.runtime.config.nodeSize,
          padding: instance.runtime.config.node.groupPadding,
          setHoveredGroupId: (groupId) => {
            setStoreAtom(store, groupHoveredAtom, groupId)
          }
        }
        return context
      },
      updateHoverGroup: (current, next) => {
        if (current === next) return current
        setStoreAtom(store, groupHoveredAtom, next)
        return next
      },
      clearHoverGroup: (current) => {
        if (current === undefined) return undefined
        setStoreAtom(store, groupHoveredAtom, undefined)
        return undefined
      },
      resolveMove: ({ nodeId, position, size, childrenIds, allowCross }) => {
        if (instance.state.read('tool') !== 'select') {
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
      delete: (ids: NodeId[]) => core.dispatch({ type: 'node.delete', ids }),
      move: core.commands.node.move as WhiteboardCommands['node']['move'],
      resize: core.commands.node.resize as WhiteboardCommands['node']['resize'],
      rotate: core.commands.node.rotate as WhiteboardCommands['node']['rotate']
    },
    group: core.commands.group as WhiteboardCommands['group'],
    mindmap: core.commands.mindmap as WhiteboardCommands['mindmap']
  }
}
