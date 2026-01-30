import { css } from '@emotion/css'
import EdgeOverlay from './EdgeOverlay'
import TreeEdge from './Edge'
import { useWhiteboardEdges } from '../StateHooks'
import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useUpdate } from 'react-use'

const clazz = css({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
  pointerEvents: 'none'
})
const TreeEdgeContainer = memo(() => {
  const treeEdges = useWhiteboardEdges()
  const instance = useWhiteboardInstance()
  const edgeLayerRef = useRef<SVGGElement>(null)
  const edgeLabelLayerRef = useRef<SVGGElement>(null)
  instance.getEdgeLayer = () => edgeLayerRef.current
  instance.getEdgeLabelLayer = () => edgeLabelLayerRef.current
  useEffect(() => {
    instance.buildNodeToEdgeIndex?.()
  }, [treeEdges])
  const update = useUpdate()
  useLayoutEffect(() => {
    // wait for label container to initialize, then render edge layer
    update()
  }, [])
  return (
    <>
      <svg
        className={clazz}
        ref={edgeLabelLayerRef}
        role="data-container"
        style={{
          zIndex: 2
        }}
      ></svg>

      <svg className={clazz} role="data-container">
        <g ref={edgeLayerRef}>
          {edgeLabelLayerRef.current &&
            Array.from(treeEdges.values()).map(edge => {
              return <TreeEdge key={edge.id} edge={edge} />
            })}
        </g>
        <EdgeOverlay />
      </svg>
    </>
  )
})

export default TreeEdgeContainer
