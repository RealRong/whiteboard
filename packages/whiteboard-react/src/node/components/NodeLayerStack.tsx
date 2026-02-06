import { useEffect, useLayoutEffect, useMemo } from 'react'
import { NodeLayer } from './NodeLayer'
import { useGroupAutoFit } from '../lifecycle'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useGroupRuntime, useNodeRuntime, useSelection, useSnapRuntime } from '../hooks'
import {
  useDoc,
  useInstance,
  useViewportStore,
  useViewGraph,
  useWhiteboardConfig
} from '../../common/hooks'

export const NodeLayerStack = () => {
  const doc = useDoc()
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()
  const viewGraph = useViewGraph()
  const selection = useSelection()
  const viewportState = useViewportStore()
  const nodeRuntime = useNodeRuntime(doc?.nodes ?? [], instance.core)
  const { setRuntime: setGroupRuntime } = useGroupRuntime()
  const { runtime: snapRuntimeModel, setRuntime: setSnapRuntime } = useSnapRuntime({
    nodes: viewGraph.canvasNodes,
    nodeSize,
    enabled: selection.tool === 'select',
    zoom: viewportState.zoom,
    thresholdScreen: 8
  })

  useGroupAutoFit({
    core: instance.core,
    nodes: doc?.nodes ?? [],
    nodeSize,
    padding: DEFAULT_GROUP_PADDING
  })

  useLayoutEffect(() => {
    nodeRuntime.setViewNodes(nodeRuntime.nodeView.viewNodes)
  }, [nodeRuntime.nodeView.viewNodes, nodeRuntime.setViewNodes])

  const groupRuntimeModel = useMemo(
    () => ({
      nodes: viewGraph.canvasNodes,
      nodeSize,
      padding: DEFAULT_GROUP_PADDING
    }),
    [nodeSize, viewGraph.canvasNodes]
  )

  useEffect(() => {
    setGroupRuntime(groupRuntimeModel)
  }, [groupRuntimeModel, setGroupRuntime])

  useEffect(() => {
    setSnapRuntime(snapRuntimeModel)
  }, [setSnapRuntime, snapRuntimeModel])

  useEffect(() => {
    nodeRuntime.setNodeTransient(nodeRuntime.transientApi)
  }, [nodeRuntime.setNodeTransient, nodeRuntime.transientApi])

  return (
    <NodeLayer />
  )
}
