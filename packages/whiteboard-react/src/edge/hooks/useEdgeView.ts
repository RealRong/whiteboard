import { useMemo } from 'react'
import type { EdgeId } from '@whiteboard/core/types'
import { resolveEdgeEndpoints } from '@whiteboard/core/edge'
import type { EdgeEntry } from '@whiteboard/engine'
import {
  applyEdgeDraft,
  applyCanvasDraft,
  useTransientNode,
  useTransientEdge,
  type EdgeReader,
  type NodeReader
} from '../../transient'
import { useEdge, useInstance } from '../../common/hooks'

const applyNodeDraft = (
  entry: EdgeEntry,
  instance: ReturnType<typeof useInstance>,
  sourceDraft: ReturnType<typeof useTransientNode>,
  targetDraft: ReturnType<typeof useTransientNode>
) => {
  if (!sourceDraft.patch && !targetDraft.patch) {
    return entry
  }

  const sourceEntry = instance.read.index.node.byId(entry.edge.source.nodeId)
  const targetEntry = instance.read.index.node.byId(entry.edge.target.nodeId)
  if (!sourceEntry || !targetEntry) {
    return entry
  }

  const source = applyCanvasDraft(sourceEntry, sourceDraft)
  const target = applyCanvasDraft(targetEntry, targetDraft)
  const endpoints = resolveEdgeEndpoints({
    edge: entry.edge,
    source,
    target
  })

  return {
    ...entry,
    endpoints
  }
}

export const useEdgeView = (
  edgeId: EdgeId | undefined,
  node: NodeReader,
  edge: EdgeReader
) => {
  const instance = useInstance()
  const entry = useEdge(edgeId)
  const sourceNodeId = entry?.edge.source.nodeId
  const targetNodeId = entry?.edge.target.nodeId
  const sourceDraft = useTransientNode(node, sourceNodeId)
  const targetDraft = useTransientNode(node, targetNodeId)
  const draft = useTransientEdge(edge, edgeId)

  return useMemo(() => {
    if (!entry) return undefined
    return applyEdgeDraft(
      applyNodeDraft(entry, instance, sourceDraft, targetDraft),
      draft
    )
  }, [draft, entry, instance, sourceDraft, targetDraft])
}
