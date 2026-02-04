import { useEffect, useLayoutEffect, useMemo } from 'react'
import { NodeLayer } from './NodeLayer'
import { useGroupHover } from '../hooks/useGroupHover'
import { useSnapIndex } from '../hooks/useSnapIndex'
import { useGroupAutoFit } from '../hooks/useGroupAutoFit'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useSelection } from '../hooks/useSelection'
import { useNodeViewState } from '../hooks/useNodeViewState'
import { useEdgeConnect } from '../../edge/hooks/useEdgeConnect'
import { useWhiteboardInput } from '../../common/hooks/useWhiteboardInput'
import { useNodeSize } from '../../common/hooks/useNodeSize'
import { useMindmapNodeSize } from '../../common/hooks/useMindmapNodeSize'
import { useViewGraph } from '../../common/hooks/useViewGraph'
import { useSelectionStore } from '../../common/hooks/useSelectionStore'
import { useViewportStore } from '../../common/hooks/useViewportStore'
import { useDragGuides } from '../hooks/useDragGuides'
import { useViewNodesStore } from '../hooks/useViewNodesStore'
import { useSelectionApi } from '../hooks/useSelectionApi'

export const NodeLayerStack = () => {
  const input = useWhiteboardInput()
  const nodeSize = useNodeSize()
  const mindmapNodeSize = useMindmapNodeSize()
  const viewGraph = useViewGraph()
  const selectionState = useSelectionStore()
  const viewportState = useViewportStore()
  const edgeConnect = useEdgeConnect()
  const { hoverGroupId, handleHoverGroupChange } = useGroupHover()
  const { snapCandidates, getCandidates } = useSnapIndex(viewGraph.canvasNodes, nodeSize ?? { width: 1, height: 1 })
  const { setGuides } = useDragGuides()
  const { setViewNodes } = useViewNodesStore()
  const { setSelectionApi } = useSelectionApi()

  const nodeView = useNodeViewState(input.doc?.nodes ?? [], input.core!)
  const selection = useSelection({
    containerRef: input.containerRef ?? undefined,
    screenToWorld: input.screenToWorld ?? undefined,
    nodes: viewGraph.canvasNodes,
    nodeSize: nodeSize ?? undefined,
    enabled: selectionState.tool !== 'edge'
  })

  useGroupAutoFit({
    core: input.core!,
    nodes: input.doc?.nodes ?? [],
    nodeSize: nodeSize ?? { width: 1, height: 1 },
    padding: DEFAULT_GROUP_PADDING
  })

  useLayoutEffect(() => {
    setViewNodes(nodeView.viewNodes)
  }, [nodeView.viewNodes, setViewNodes])

  useEffect(() => {
    setSelectionApi(selection)
    return () => {
      setSelectionApi(null)
    }
  }, [selection, setSelectionApi])

  const selectionForLayer = selectionState.tool === 'edge' ? undefined : selection
  const group = useMemo(
    () => ({
      nodes: viewGraph.canvasNodes,
      nodeSize: nodeSize ?? { width: 1, height: 1 },
      padding: DEFAULT_GROUP_PADDING,
      hoveredGroupId: hoverGroupId,
      onHoverGroupChange: handleHoverGroupChange
    }),
    [handleHoverGroupChange, hoverGroupId, nodeSize, viewGraph.canvasNodes]
  )
  const mindmap = useMemo(() => {
    if (!input.screenToWorld) return undefined
    if (!input.core) return undefined
    if (!mindmapNodeSize) return undefined
    return {
      nodes: viewGraph.mindmapNodes,
      nodeSize: mindmapNodeSize,
      layout: input.mindmapLayout,
      core: input.core,
      screenToWorld: input.screenToWorld,
      containerRef: input.containerRef ?? undefined
    }
  }, [input, mindmapNodeSize, viewGraph.mindmapNodes])
  const snap = useMemo(
    () => ({
      enabled: selectionState.tool === 'select',
      candidates: snapCandidates,
      getCandidates,
      thresholdScreen: 8,
      zoom: viewportState.zoom,
      onGuidesChange: setGuides
    }),
    [getCandidates, setGuides, snapCandidates, selectionState.tool, viewportState.zoom]
  )

  return (
    <NodeLayer
      nodes={viewGraph.canvasNodes}
      core={input.core!}
      nodeSize={nodeSize ?? { width: 1, height: 1 }}
      zoom={viewportState.zoom}
      selection={selectionForLayer}
      edgeConnect={edgeConnect}
      tool={selectionState.tool as 'select' | 'edge'}
      containerRef={input.containerRef ?? undefined}
      screenToWorld={input.screenToWorld ?? undefined}
      group={group}
      mindmap={mindmap}
      snap={snap}
      transient={nodeView}
    />
  )
}
