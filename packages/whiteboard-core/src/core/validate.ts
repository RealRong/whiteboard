import type { CoreRegistries, Intent } from '../types/core'
import type { CoreState } from './state'
import { getMissingEdgeFields, getMissingNodeFields } from '../schema'

export const createValidateIntent = (state: CoreState, registries: CoreRegistries) => {
  const { maps } = state

  return (intent: Intent): string | undefined => {
    switch (intent.type) {
      case 'node.create': {
        const payload = intent.payload
        if (!payload.type) return 'Missing node type.'
        if (!payload.position) return 'Missing node position.'
        if (payload.id && maps.nodes.has(payload.id)) return `Node ${payload.id} already exists.`
        const typeDef = registries.nodeTypes.get(payload.type)
        if (typeDef?.validate && !typeDef.validate(payload.data)) return `Node ${payload.type} validation failed.`
        const missing = getMissingNodeFields(payload, registries)
        if (missing.length > 0) return `Missing required fields: ${missing.join(', ')}.`
        return
      }
      case 'node.update': {
        if (!maps.nodes.has(intent.id)) return `Node ${intent.id} not found.`
        return
      }
      case 'node.delete': {
        if (intent.ids.length === 0) return 'No node ids provided.'
        const missing = intent.ids.find((id) => !maps.nodes.has(id))
        if (missing) return `Node ${missing} not found.`
        return
      }
      case 'node.order.set': {
        const ids = intent.ids
        if (ids.length === 0) return 'No node ids provided.'
        if (ids.length !== maps.nodes.size) return 'Node order length mismatch.'
        const set = new Set(ids)
        if (set.size !== ids.length) return 'Duplicate node ids in order.'
        const missing = ids.find((id) => !maps.nodes.has(id))
        if (missing) return `Node ${missing} not found.`
        for (const id of maps.nodes.keys()) {
          if (!set.has(id)) return `Node ${id} missing from order.`
        }
        return
      }
      case 'node.order.bringToFront':
      case 'node.order.sendToBack':
      case 'node.order.bringForward':
      case 'node.order.sendBackward': {
        if (intent.ids.length === 0) return 'No node ids provided.'
        const missing = intent.ids.find((id) => !maps.nodes.has(id))
        if (missing) return `Node ${missing} not found.`
        return
      }
      case 'edge.create': {
        const payload = intent.payload
        if (!payload.source?.nodeId || !payload.target?.nodeId) return 'Missing edge endpoints.'
        if (!payload.type) return 'Missing edge type.'
        if (payload.id && maps.edges.has(payload.id)) return `Edge ${payload.id} already exists.`
        if (!maps.nodes.has(payload.source.nodeId)) return `Source node ${payload.source.nodeId} not found.`
        if (!maps.nodes.has(payload.target.nodeId)) return `Target node ${payload.target.nodeId} not found.`
        const typeDef = registries.edgeTypes.get(payload.type)
        if (typeDef?.validate && !typeDef.validate(payload.data)) return `Edge ${payload.type} validation failed.`
        const missing = getMissingEdgeFields(payload, registries)
        if (missing.length > 0) return `Missing required fields: ${missing.join(', ')}.`
        return
      }
      case 'edge.update': {
        if (!maps.edges.has(intent.id)) return `Edge ${intent.id} not found.`
        if (intent.patch.source?.nodeId && !maps.nodes.has(intent.patch.source.nodeId)) {
          return `Source node ${intent.patch.source.nodeId} not found.`
        }
        if (intent.patch.target?.nodeId && !maps.nodes.has(intent.patch.target.nodeId)) {
          return `Target node ${intent.patch.target.nodeId} not found.`
        }
        return
      }
      case 'edge.delete': {
        if (intent.ids.length === 0) return 'No edge ids provided.'
        const missing = intent.ids.find((id) => !maps.edges.has(id))
        if (missing) return `Edge ${missing} not found.`
        return
      }
      case 'edge.order.set': {
        const ids = intent.ids
        if (ids.length === 0) return 'No edge ids provided.'
        if (ids.length !== maps.edges.size) return 'Edge order length mismatch.'
        const set = new Set(ids)
        if (set.size !== ids.length) return 'Duplicate edge ids in order.'
        const missing = ids.find((id) => !maps.edges.has(id))
        if (missing) return `Edge ${missing} not found.`
        for (const id of maps.edges.keys()) {
          if (!set.has(id)) return `Edge ${id} missing from order.`
        }
        return
      }
      case 'edge.order.bringToFront':
      case 'edge.order.sendToBack':
      case 'edge.order.bringForward':
      case 'edge.order.sendBackward': {
        if (intent.ids.length === 0) return 'No edge ids provided.'
        const missing = intent.ids.find((id) => !maps.edges.has(id))
        if (missing) return `Edge ${missing} not found.`
        return
      }
      case 'mindmap.create': {
        const payload = intent.payload
        if (payload?.id && maps.nodes.has(payload.id)) {
          return `Node ${payload.id} already exists.`
        }
        return
      }
      case 'mindmap.delete': {
        if (intent.ids.length === 0) return 'No mindmap ids provided.'
        const missing = intent.ids.find((id) => !maps.mindmaps.has(id))
        if (missing) return `Mindmap ${missing} not found.`
        return
      }
      case 'mindmap.replace': {
        if (!maps.mindmaps.has(intent.id)) return `Mindmap ${intent.id} not found.`
        if (intent.tree.id !== intent.id) return 'Mindmap id mismatch.'
        return
      }
      case 'mindmap.addChild':
      case 'mindmap.addSibling':
      case 'mindmap.moveSubtree':
      case 'mindmap.removeSubtree':
      case 'mindmap.cloneSubtree':
      case 'mindmap.toggleCollapse':
      case 'mindmap.setNodeData':
      case 'mindmap.reorderChild':
      case 'mindmap.setSide':
      case 'mindmap.attachExternal': {
        if (!maps.mindmaps.has(intent.id)) return `Mindmap ${intent.id} not found.`
        return
      }
      case 'viewport.set': {
        if (!intent.viewport.center) return 'Missing viewport center.'
        if (!Number.isFinite(intent.viewport.zoom) || intent.viewport.zoom <= 0) return 'Invalid viewport zoom.'
        return
      }
      case 'viewport.pan': {
        if (!Number.isFinite(intent.delta.x) || !Number.isFinite(intent.delta.y)) return 'Invalid pan delta.'
        return
      }
      case 'viewport.zoom': {
        if (!Number.isFinite(intent.factor) || intent.factor <= 0) return 'Invalid zoom factor.'
        return
      }
      default:
        return 'Unsupported intent.'
    }
  }
}
