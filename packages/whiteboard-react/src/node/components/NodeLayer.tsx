import type { NodeId } from '@whiteboard/core'
import type { NodeTransformHandle, NodeViewItem } from '@whiteboard/engine'
import { useEffect, useState } from 'react'
import { useInstance } from '../../common/hooks'
import { NodeItem } from './NodeItem'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useNodeIds = () => {
  const instance = useInstance()
  const [nodeIds, setNodeIds] = useState<NodeId[]>(() => instance.view.node.ids())

  useEffect(() => {
    const update = () => {
      const next = instance.view.node.ids()
      setNodeIds((prev) => (isSameIdOrder(prev, next) ? prev : next))
    }
    update()
    return instance.view.node.watchIds(update)
  }, [instance])

  return nodeIds
}

const useNodeItem = (nodeId: NodeId) => {
  const instance = useInstance()
  const [item, setItem] = useState<NodeViewItem | undefined>(() => instance.view.node.item(nodeId))

  useEffect(() => {
    const update = () => {
      const next = instance.view.node.item(nodeId)
      setItem((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.node.watchItem(nodeId, update)
  }, [instance, nodeId])

  return item
}

const useNodeTransformHandles = (nodeId: NodeId) => {
  const instance = useInstance()
  const [handles, setHandles] = useState<NodeTransformHandle[] | undefined>(() =>
    instance.view.node.handles(nodeId)
  )

  useEffect(() => {
    const update = () => {
      const next = instance.view.node.handles(nodeId)
      setHandles((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.node.watchHandles(nodeId, update)
  }, [instance, nodeId])

  return handles
}

const NodeItemById = ({ nodeId }: { nodeId: NodeId }) => {
  const item = useNodeItem(nodeId)
  const transformHandles = useNodeTransformHandles(nodeId)

  if (!item) return null
  return <NodeItem item={item} transformHandles={transformHandles} />
}

export const NodeLayer = () => {
  const nodeIds = useNodeIds()

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItemById key={nodeId} nodeId={nodeId} />
      ))}
    </div>
  )
}
