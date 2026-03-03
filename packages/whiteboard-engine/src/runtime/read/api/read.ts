import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { EdgeReadRuntime } from '@engine-types/read/edge'
import type { MindmapReadRuntime } from '@engine-types/read/mindmap'
import type { NodeReadRuntime } from '@engine-types/read/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

type ReadApiDeps = {
  context: ReadRuntimeContext
  node: NodeReadRuntime
  edge: EdgeReadRuntime
  mindmap: MindmapReadRuntime
}

export const readApi = ({
  context,
  node,
  edge,
  mindmap
}: ReadApiDeps): EngineRead => {
  const cloneValue = <T,>(value: T): T => {
    const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
    if (clone) return clone(value)
    return JSON.parse(JSON.stringify(value)) as T
  }

  const toReadonlyValue = <T,>(value: T): T => {
    if (value instanceof Map) {
      const copied = new Map(
        Array.from(value.entries(), ([key, item]) => [
          key,
          toReadonlyValue(item)
        ])
      )
      return copied as T
    }
    if (value instanceof Set) {
      const copied = new Set(
        Array.from(value.values(), (item) => toReadonlyValue(item))
      )
      return copied as T
    }
    if (Array.isArray(value)) {
      return value.map((item) => toReadonlyValue(item)) as T
    }
    if (value && typeof value === 'object') {
      return Object.freeze(cloneValue(value)) as T
    }
    return value
  }

  const toReadonlyOptional = <T,>(value: T | undefined): T | undefined =>
    typeof value === 'undefined' ? undefined : toReadonlyValue(value)

  const get: EngineRead['get'] = Object.assign(
    <K extends ReadPublicKey>(key: K) =>
      toReadonlyValue(context.get(key)),
    {
      viewportTransform: () =>
        toReadonlyValue(node.get.viewportTransform()),
      nodeIds: () =>
        toReadonlyValue(node.get.nodeIds()),
      nodeById: (id: NodeId) =>
        toReadonlyOptional(node.get.nodeById(id)),
      edgeIds: () =>
        toReadonlyValue(edge.get.edgeIds()),
      edgeById: (id: EdgeId) =>
        toReadonlyOptional(edge.get.edgeById(id)),
      selectedEdgeId: () => edge.get.selectedEdgeId(),
      edgeSelectedEndpoints: () =>
        toReadonlyOptional(edge.get.edgeSelectedEndpoints()),
      mindmapIds: () =>
        toReadonlyValue(mindmap.get.mindmapIds()),
      mindmapById: (id: NodeId) =>
        toReadonlyOptional(mindmap.get.mindmapById(id))
    }
  )

  return {
    get,
    subscribe: context.subscribe
  }
}
