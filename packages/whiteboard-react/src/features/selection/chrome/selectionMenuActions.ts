import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { Editor } from '../../../runtime/instance'
import type { NodeMeta } from '../../../types/node'

export type SelectionMenuInstance = Pick<Editor, 'commands'>
export type NodeMetaResolver = (node: Node) => NodeMeta | undefined
export type SelectionOrderMode = 'front' | 'forward' | 'backward' | 'back'

export type SelectionOperations = {
  filter: (key: string) => void
  order: (mode: SelectionOrderMode) => void
  align: (mode: NodeAlignMode) => void
  distribute: (mode: NodeDistributeMode) => void
  group: () => void
  ungroup: () => void
  lock: (locked: boolean) => void
  copy: () => unknown
  cut: () => unknown
  duplicate: () => void
  delete: () => void
}

export const runMenuAction = (
  action: () => unknown,
  close?: () => void
) => () => {
  const result = action()

  if (!close) {
    return result
  }

  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    return Promise.resolve(result).finally(close)
  }

  close()
  return result
}

const readFilteredNodeIds = (
  nodes: readonly Node[],
  resolveMeta: NodeMetaResolver | undefined,
  key: string
) => nodes
  .filter((node) => (resolveMeta?.(node)?.key ?? node.type) === key)
  .map((node) => node.id)

export const createSelectionOperations = ({
  instance,
  nodes,
  resolveMeta
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  resolveMeta?: NodeMetaResolver
}): SelectionOperations => {
  const nodeIds = nodes.map((node) => node.id)
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)

  const replaceSelection = (nextNodeIds: readonly NodeId[]) => {
    instance.commands.selection.replace({
      nodeIds: nextNodeIds
    })
  }

  return {
    filter: (key) => {
      const filteredNodeIds = readFilteredNodeIds(nodes, resolveMeta, key)
      if (!filteredNodeIds.length) {
        return
      }

      replaceSelection(filteredNodeIds)
    },
    order: (mode) => {
      if (!nodeIds.length) {
        return
      }

      if (mode === 'front') {
        instance.commands.node.order.bringToFront([...nodeIds])
        return
      }
      if (mode === 'forward') {
        instance.commands.node.order.bringForward([...nodeIds])
        return
      }
      if (mode === 'backward') {
        instance.commands.node.order.sendBackward([...nodeIds])
        return
      }

      instance.commands.node.order.sendToBack([...nodeIds])
    },
    align: (mode) => {
      if (nodeIds.length < 2) {
        return
      }

      instance.commands.node.align([...nodeIds], mode)
    },
    distribute: (mode) => {
      if (nodeIds.length < 3) {
        return
      }

      instance.commands.node.distribute([...nodeIds], mode)
    },
    group: () => {
      if (nodeIds.length < 2) {
        return
      }

      const result = instance.commands.node.group.create([...nodeIds])
      if (!result.ok) {
        return
      }

      replaceSelection([result.data.groupId])
    },
    ungroup: () => {
      if (!groupIds.length) {
        return
      }

      const result = instance.commands.node.group.ungroupMany([...groupIds])
      if (!result.ok) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    lock: (locked) => {
      if (!nodeIds.length) {
        return
      }

      instance.commands.node.lock.set([...nodeIds], locked)
    },
    copy: () => {
      if (!nodeIds.length) {
        return
      }

      return instance.commands.clipboard.copy({
        nodeIds
      })
    },
    cut: () => {
      if (!nodeIds.length) {
        return
      }

      return instance.commands.clipboard.cut({
        nodeIds
      })
    },
    duplicate: () => {
      if (!nodeIds.length) {
        return
      }

      const result = instance.commands.node.duplicate([...nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    delete: () => {
      if (!nodeIds.length) {
        return
      }

      instance.commands.node.deleteCascade([...nodeIds])
    }
  }
}
