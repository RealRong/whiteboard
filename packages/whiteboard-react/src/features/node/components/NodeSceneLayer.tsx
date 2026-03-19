import { useEffect, useRef } from 'react'
import {
  useInternalInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import type { MarqueeSession } from '../../../canvas/Marquee'
import { useNodeSizeObserver } from '../hooks/useNodeSizeObserver'
import { createNodePressSession } from '../hooks/drag/session'
import { NodeItem } from './NodeItem'

export const NodeSceneLayer = ({
  marquee
}: {
  marquee: MarqueeSession
}) => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const press = useStoreValue(instance.internals.node.press)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const registerMeasuredElement = useNodeSizeObserver()
  const pressSessionRef = useRef<ReturnType<typeof createNodePressSession> | null>(null)

  if (!pressSessionRef.current) {
    pressSessionRef.current = createNodePressSession(instance, marquee)
  }

  const pressSession = pressSessionRef.current!

  useEffect(() => () => {
    pressSession.cancel()
  }, [pressSession])
  const showsNodeSelection = press === null || press === 'repeat'

  return (
    <div className="wb-node-layer">
      {nodeIds.map((nodeId) => (
        <NodeItem
          key={nodeId}
          nodeId={nodeId}
          registerMeasuredElement={registerMeasuredElement}
          selected={selectedSet.has(nodeId) && showsNodeSelection}
          onNodePointerDown={pressSession.handleNodePointerDown}
          onNodeDoubleClick={pressSession.handleNodeDoubleClick}
        />
      ))}
    </div>
  )
}
