import type {
  MouseEvent as ReactMouseEvent
} from 'react'
import { useEffect, useRef } from 'react'
import type { NodeId } from '@whiteboard/core/types'
import {
  useInternalInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import { isCanvasContentIgnoredTarget } from '../../../canvas/CanvasTargeting'
import { useNodeSizeObserver } from '../hooks/useNodeSizeObserver'
import { createNodeDragSession } from '../hooks/drag/session'
import { NodeItem } from './NodeItem'

export const NodeSceneLayer = () => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const registerMeasuredElement = useNodeSizeObserver()
  const dragSessionRef = useRef<ReturnType<typeof createNodeDragSession> | null>(null)

  if (!dragSessionRef.current) {
    dragSessionRef.current = createNodeDragSession(instance)
  }

  const dragSession = dragSessionRef.current!

  useEffect(() => () => {
    dragSession.cancel()
  }, [dragSession])

  const handleNodeDoubleClick = (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => {
    if (instance.state.tool.get() !== 'select') return

    if (isCanvasContentIgnoredTarget(event.target)) {
      return
    }

    const nodeEntry = instance.read.index.node.get(nodeId)
    if (!nodeEntry || nodeEntry.node.type !== 'group') {
      return
    }

    instance.commands.selection.clear()
    instance.commands.container.enter(nodeId)
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItem
          key={nodeId}
          nodeId={nodeId}
          registerMeasuredElement={registerMeasuredElement}
          selected={selectedSet.has(nodeId)}
          onNodePointerDown={dragSession.handleNodePointerDown}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      ))}
    </div>
  )
}
