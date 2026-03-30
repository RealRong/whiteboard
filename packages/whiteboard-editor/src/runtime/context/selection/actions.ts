import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type {
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { Editor } from '../../../types/public/editor'
import type { NodeRegistry } from '../../../types/node'
import { resolveContextNodeMeta } from './summary'

export type SelectionMenuHost = {
  commands: () => Editor['commands']
  registry: Pick<NodeRegistry, 'get'>
}

export type SelectionOrderMode = 'front' | 'forward' | 'backward' | 'back'

export type SelectionMenuOperations = {
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

export const bindAction = (
  action: (() => unknown) | undefined,
  close?: () => void
) => {
  if (!action) {
    return undefined
  }
  if (!close) {
    return action
  }

  return () => {
    const result = action()

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result).finally(close)
    }

    close()
    return result
  }
}

export const bindActionWithArgs = <Args extends unknown[]>(
  action: (...args: Args) => unknown,
  close?: () => void
) => {
  if (!close) {
    return action
  }

  return (...args: Args) => {
    const result = action(...args)

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result).finally(close)
    }

    close()
    return result
  }
}

const readFilteredNodeIds = (
  nodes: readonly Node[],
  key: string,
  resolveMeta: (node: Node) => { key?: string }
) => nodes
  .filter((node) => (resolveMeta(node).key ?? node.type) === key)
  .map((node) => node.id)

export const createSelectionOperations = ({
  editor,
  nodes
}: {
  editor: SelectionMenuHost
  nodes: readonly Node[]
}): SelectionMenuOperations => {
  const nodeIds = nodes.map((node) => node.id)
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)
  const replaceSelection = (nextNodeIds: readonly NodeId[]) => {
    editor.commands().selection.replace({
      nodeIds: nextNodeIds
    })
  }

  return {
    filter: (key) => {
      const filteredNodeIds = readFilteredNodeIds(
        nodes,
        key,
        (node) => resolveContextNodeMeta(editor.registry, node)
      )
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
        editor.commands().node.order.bringToFront([...nodeIds])
        return
      }
      if (mode === 'forward') {
        editor.commands().node.order.bringForward([...nodeIds])
        return
      }
      if (mode === 'backward') {
        editor.commands().node.order.sendBackward([...nodeIds])
        return
      }

      editor.commands().node.order.sendToBack([...nodeIds])
    },
    align: (mode) => {
      if (nodeIds.length < 2) {
        return
      }

      editor.commands().node.align([...nodeIds], mode)
    },
    distribute: (mode) => {
      if (nodeIds.length < 3) {
        return
      }

      editor.commands().node.distribute([...nodeIds], mode)
    },
    group: () => {
      if (nodeIds.length < 2) {
        return
      }

      const result = editor.commands().node.group.create([...nodeIds])
      if (!result.ok) {
        return
      }

      replaceSelection([result.data.groupId])
    },
    ungroup: () => {
      if (!groupIds.length) {
        return
      }

      const result = editor.commands().node.group.ungroupMany([...groupIds])
      if (!result.ok) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    lock: (locked) => {
      if (!nodeIds.length) {
        return
      }

      editor.commands().node.lock.set([...nodeIds], locked)
    },
    copy: () => {
      if (!nodeIds.length) {
        return
      }

      return editor.commands().clipboard.copy({
        nodeIds
      })
    },
    cut: () => {
      if (!nodeIds.length) {
        return
      }

      return editor.commands().clipboard.cut({
        nodeIds
      })
    },
    duplicate: () => {
      if (!nodeIds.length) {
        return
      }

      const result = editor.commands().node.duplicate([...nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    delete: () => {
      if (!nodeIds.length) {
        return
      }

      editor.commands().node.deleteCascade([...nodeIds])
    }
  }
}
