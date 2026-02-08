import { useEffect, useRef } from 'react'
import type { Core, Node } from '@whiteboard/core'
import type { Size } from 'types/common'
import { getNodeAABB } from '../../common/utils/geometry'
import { expandGroupRect, getGroupDescendants, getNodesBoundingRect, rectEquals } from '../utils/group'

type Options = {
  core: Core
  nodes: Node[]
  nodeSize: Size
  padding?: number
}

type Snapshot = {
  nodeMap: Map<string, Node>
  signatureMap: Map<string, string>
}

const createNodeSignature = (node: Node) => {
  const autoFit = node.data && typeof node.data.autoFit === 'string' ? node.data.autoFit : ''
  const groupPadding = node.data && typeof node.data.padding === 'number' ? node.data.padding : ''
  const width = node.size?.width ?? ''
  const height = node.size?.height ?? ''
  const rotation = typeof node.rotation === 'number' ? node.rotation : ''
  return [
    node.type,
    node.parentId ?? '',
    node.position.x,
    node.position.y,
    width,
    height,
    rotation,
    autoFit,
    groupPadding
  ].join('|')
}

const createSnapshot = (nodes: Node[]): Snapshot => {
  const nodeMap = new Map<string, Node>()
  const signatureMap = new Map<string, string>()
  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    signatureMap.set(node.id, createNodeSignature(node))
  })
  return {
    nodeMap,
    signatureMap
  }
}

const collectChangedNodeIds = (prev: Snapshot, next: Snapshot): Set<string> => {
  const changedIds = new Set<string>()
  const allIds = new Set<string>()
  prev.signatureMap.forEach((_value, id) => allIds.add(id))
  next.signatureMap.forEach((_value, id) => allIds.add(id))

  allIds.forEach((id) => {
    const prevSignature = prev.signatureMap.get(id)
    const nextSignature = next.signatureMap.get(id)
    if (prevSignature !== nextSignature) {
      changedIds.add(id)
    }
  })

  return changedIds
}

const addGroupAncestors = (nodeId: string, map: Map<string, Node>, target: Set<string>) => {
  let cursor: string | undefined = nodeId
  while (cursor) {
    const current = map.get(cursor)
    if (!current) break
    if (current.type === 'group') {
      target.add(current.id)
    }
    cursor = current.parentId
  }
}

const collectDirtyGroupIds = (changedNodeIds: Set<string>, prev: Snapshot, next: Snapshot): Set<string> => {
  const dirtyGroupIds = new Set<string>()

  changedNodeIds.forEach((nodeId) => {
    const prevNode = prev.nodeMap.get(nodeId)
    const nextNode = next.nodeMap.get(nodeId)

    if (prevNode) {
      addGroupAncestors(prevNode.id, prev.nodeMap, dirtyGroupIds)
      if (prevNode.parentId) {
        addGroupAncestors(prevNode.parentId, prev.nodeMap, dirtyGroupIds)
      }
    }

    if (nextNode) {
      addGroupAncestors(nextNode.id, next.nodeMap, dirtyGroupIds)
      if (nextNode.parentId) {
        addGroupAncestors(nextNode.parentId, next.nodeMap, dirtyGroupIds)
      }
    }
  })

  return dirtyGroupIds
}

export const useGroupAutoFit = ({ core, nodes, nodeSize, padding = 24 }: Options) => {
  const snapshotRef = useRef<Snapshot | null>(null)
  const layoutConfigRef = useRef<{ width: number; height: number; padding: number } | null>(null)

  useEffect(() => {
    const currentSnapshot = createSnapshot(nodes)
    const prevSnapshot = snapshotRef.current
    const prevLayout = layoutConfigRef.current
    const layoutChanged =
      !prevLayout ||
      prevLayout.width !== nodeSize.width ||
      prevLayout.height !== nodeSize.height ||
      prevLayout.padding !== padding

    let groupsToProcess: Node[] = []

    if (!nodes.length) {
      snapshotRef.current = currentSnapshot
      layoutConfigRef.current = {
        width: nodeSize.width,
        height: nodeSize.height,
        padding
      }
      return
    }

    if (!prevSnapshot || layoutChanged) {
      groupsToProcess = nodes.filter((node) => node.type === 'group')
    } else {
      const changedNodeIds = collectChangedNodeIds(prevSnapshot, currentSnapshot)
      if (changedNodeIds.size > 0) {
        const dirtyGroupIds = collectDirtyGroupIds(changedNodeIds, prevSnapshot, currentSnapshot)
        if (dirtyGroupIds.size > 0) {
          groupsToProcess = nodes.filter((node) => node.type === 'group' && dirtyGroupIds.has(node.id))
        }
      }
    }

    groupsToProcess.forEach((group) => {
      const autoFit =
        group.data && typeof group.data.autoFit === 'string' ? group.data.autoFit : 'expand-only'
      if (autoFit === 'manual') return

      const groupPadding =
        group.data && typeof group.data.padding === 'number' ? group.data.padding : padding
      const children = getGroupDescendants(nodes, group.id)
      if (!children.length) return
      const contentRect = getNodesBoundingRect(children, nodeSize)
      if (!contentRect) return
      const groupRect = getNodeAABB(group, nodeSize)
      const expanded = expandGroupRect(groupRect, contentRect, groupPadding)
      if (!rectEquals(expanded, groupRect)) {
        core.dispatch({
          type: 'node.update',
          id: group.id,
          patch: {
            position: { x: expanded.x, y: expanded.y },
            size: { width: expanded.width, height: expanded.height }
          }
        })
      }
    })

    snapshotRef.current = currentSnapshot
    layoutConfigRef.current = {
      width: nodeSize.width,
      height: nodeSize.height,
      padding
    }
  }, [core, nodeSize.height, nodeSize.width, nodes, padding])
}
