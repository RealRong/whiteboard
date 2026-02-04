import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { NodeLayer } from './NodeLayer'
import { useGroupHover } from '../hooks/useGroupHover'
import { useSnapIndex } from '../hooks/useSnapIndex'
import { useGroupAutoFit } from '../hooks/useGroupAutoFit'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { dragGuidesAtom } from '../state/dragGuidesAtom'
import { whiteboardInputAtom, mindmapNodeSizeAtom, nodeSizeAtom } from '../../common/state/whiteboardInputAtoms'
import { viewGraphAtom } from '../../common/state/whiteboardDerivedAtoms'
import { useSelection } from '../hooks/useSelection'
import { selectionAtom, viewportAtom } from '../../common/state/whiteboardAtoms'
import { useNodeViewState } from '../hooks/useNodeViewState'
import { viewNodesAtom } from '../state/viewNodesAtom'
import { selectionApiAtom } from '../state/selectionApiAtom'
import { useEdgeConnect } from '../../edge/hooks/useEdgeConnect'

export const NodeLayerStack = () => {
  const input = useAtomValue(whiteboardInputAtom)
  const nodeSize = useAtomValue(nodeSizeAtom)
  const mindmapNodeSize = useAtomValue(mindmapNodeSizeAtom)
  const viewGraph = useAtomValue(viewGraphAtom)
  const selectionState = useAtomValue(selectionAtom)
  const viewportState = useAtomValue(viewportAtom)
  const edgeConnect = useEdgeConnect()
  const { hoverGroupId, handleHoverGroupChange } = useGroupHover()
  const { snapCandidates, getCandidates } = useSnapIndex(viewGraph.canvasNodes, nodeSize ?? { width: 1, height: 1 })
  const setDragGuides = useSetAtom(dragGuidesAtom)
  const setViewNodes = useSetAtom(viewNodesAtom)
  const setSelectionApi = useSetAtom(selectionApiAtom)

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
      onGuidesChange: setDragGuides
    }),
    [getCandidates, setDragGuides, snapCandidates, selectionState.tool, viewportState.zoom]
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
