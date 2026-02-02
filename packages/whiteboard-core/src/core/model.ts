import type { Core, CoreRegistries, Edge, MindmapId, MindmapTree, Node } from '../types/core'
import type { CoreState } from './state'
import { createMindmap } from '../mindmap/commands'
import { applyEdgeDefaults, applyNodeDefaults } from '../schema'

export const createModel = (deps: {
  state: CoreState
  registries: CoreRegistries
  applyOperations: (operations: Array<any>, origin?: any) => { ok: boolean; changes?: any; message?: string }
  getOrigin: () => 'user' | 'remote' | 'system'
}): Core['model'] => {
  const { state, registries, applyOperations, getOrigin } = deps

  return {
    node: {
      create: (input) => {
        if (!input.type || !input.position) {
          throw new Error('Node input requires type and position.')
        }
        const normalized = applyNodeDefaults(input, registries)
        const node: Node = { ...normalized, id: normalized.id ?? state.createNodeId() }
        if (state.maps.nodes.has(node.id)) {
          throw new Error(`Node ${node.id} already exists.`)
        }
        const result = applyOperations([{ type: 'node.create', node }], getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to create node.')
        }
        return node.id
      },
      update: (id, patch) => {
        const node = state.maps.nodes.get(id)
        if (!node) {
          throw new Error(`Node ${id} not found.`)
        }
        const result = applyOperations([{ type: 'node.update', id, patch, before: state.cloneNode(node) }], getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? `Failed to update node ${id}.`)
        }
      },
      delete: (ids) => {
        if (ids.length === 0) return
        const operations = ids
          .map((id) => {
            const node = state.maps.nodes.get(id)
            if (!node) return null
            return { type: 'node.delete', id, before: state.cloneNode(node) } as const
          })
          .filter(Boolean)
        if (operations.length === 0) return
        const result = applyOperations(operations, getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to delete node.')
        }
      }
    },
    edge: {
      create: (input) => {
        if (!input.source?.nodeId || !input.target?.nodeId) {
          throw new Error('Edge input requires source and target.')
        }
        const normalized = applyEdgeDefaults(input, registries)
        const edge: Edge = { ...normalized, type: normalized.type ?? 'linear', id: normalized.id ?? state.createEdgeId() }
        if (state.maps.edges.has(edge.id)) {
          throw new Error(`Edge ${edge.id} already exists.`)
        }
        const result = applyOperations([{ type: 'edge.create', edge }], getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to create edge.')
        }
        return edge.id
      },
      update: (id, patch) => {
        const edge = state.maps.edges.get(id)
        if (!edge) {
          throw new Error(`Edge ${id} not found.`)
        }
        const result = applyOperations([{ type: 'edge.update', id, patch, before: state.cloneEdge(edge) }], getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? `Failed to update edge ${id}.`)
        }
      },
      delete: (ids) => {
        if (ids.length === 0) return
        const operations = ids
          .map((id) => {
            const edge = state.maps.edges.get(id)
            if (!edge) return null
            return { type: 'edge.delete', id, before: state.cloneEdge(edge) } as const
          })
          .filter(Boolean)
        if (operations.length === 0) return
        const result = applyOperations(operations, getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to delete edge.')
        }
      }
    },
    mindmap: {
      create: (input) => {
        const payload = input && 'nodes' in (input as MindmapTree) ? (input as MindmapTree) : undefined
        const id = payload?.id ?? (input as { id?: MindmapId } | undefined)?.id ?? state.createMindmapId()
        if (state.maps.mindmaps.has(id)) {
          throw new Error(`Mindmap ${id} already exists.`)
        }
        const mindmap =
          payload ??
          createMindmap({
            id,
            rootId: (input as { rootId?: string } | undefined)?.rootId,
            rootData: (input as { rootData?: any } | undefined)?.rootData,
            idGenerator: {
              treeId: state.createMindmapId,
              nodeId: state.createMindmapNodeId
            }
          })
        const result = applyOperations([{ type: 'mindmap.create', mindmap }], getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to create mindmap.')
        }
        return mindmap.id
      },
      update: (id, tree) => {
        const current = state.maps.mindmaps.get(id)
        if (!current) {
          throw new Error(`Mindmap ${id} not found.`)
        }
        if (tree.id !== id) {
          throw new Error('Mindmap id mismatch.')
        }
        const result = applyOperations(
          [{ type: 'mindmap.replace', id, before: state.cloneMindmapTree(current), after: state.cloneMindmapTree(tree) }],
          getOrigin()
        )
        if (!result.ok) {
          throw new Error(result.message ?? `Failed to update mindmap ${id}.`)
        }
      },
      delete: (ids) => {
        if (ids.length === 0) return
        const operations = ids
          .map((id) => {
            const current = state.maps.mindmaps.get(id)
            if (!current) return null
            return { type: 'mindmap.delete', id, before: state.cloneMindmapTree(current) } as const
          })
          .filter(Boolean)
        if (operations.length === 0) return
        const result = applyOperations(operations, getOrigin())
        if (!result.ok) {
          throw new Error(result.message ?? 'Failed to delete mindmap.')
        }
      }
    }
  }
}
