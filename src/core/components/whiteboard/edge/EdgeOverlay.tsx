import { useSelectGlobalAtomValue } from '@/hooks'
import Id from '@/utils/id'
import { memo, useEffect, useState } from 'react'
import { getMarkerId } from '../../graph/utils/getMarkerId'
import { MarkerColor } from '@/consts'
import { EdgePosition, IEdgeOverlayState, IWhiteboardEdge, XYPosition } from '~/typings'
import { getBezierPath, getHandlePosition } from '../utils'
import { useAtom } from 'jotai'
import { getSmoothPolyPath } from '@/core/components/whiteboard/utils/getSmoothPoly'
import { getSetting, SettingAtom } from '@/core'
import { animatedEdgeClazz, dashEdgeClazz } from '@/core/components/whiteboard/edge/Edge'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { assignProperties } from '@/utils'
import { atom } from 'jotai'
import useAddEdge from '@/core/components/whiteboard/edge/useAddEdge'
import useRepositionEdge from '@/core/components/whiteboard/edge/useRepositionEdge'
import Colors from '../../../../consts/colors'
import { MetaStore } from '@/api/stores'

const revertPos = (currentPos: EdgePosition) => {
  switch (currentPos) {
    case 'top': {
      return 'bottom'
    }
    case 'right': {
      return 'left'
    }
    case 'left': {
      return 'right'
    }
    case 'bottom': {
      return 'top'
    }
  }
}

export const EdgeOverlayStateAtom = atom<IEdgeOverlayState>({})

const EdgeOverlay = memo(() => {
  const [overlayState, setOverlayState] = useAtom(EdgeOverlayStateAtom)
  const [path, setPath] = useState<string>()
  const instance = useWhiteboardInstance()
  const currentEdge = overlayState.currentEdgeId ? instance.getEdge?.(overlayState.currentEdgeId) : undefined
  console.log('here to')
  useAddEdge(instance)
  useRepositionEdge(instance)

  assignProperties(instance, {
    edgeOps: {
      endAction: () => setOverlayState({}),
      getEdgeFuncs: edgeId => {
        return instance.values.ID_TO_EDGE_MAP.get(edgeId)
      },
      insertEdge: e => {
        if (!e.sourceId || !e.targetId) return
        const setting = getSetting()
        if (setting.whiteboard.enableAddLinkBetweenObjectsWhenConnect) {
          const sourceNode = instance.getNode?.(e.sourceId)
          const targetNode = instance.getNode?.(e.targetId)
          if (sourceNode?.type === 'metaObject' && targetNode?.type === 'metaObject') {
            MetaStore.addMetaLink(
              {
                sourceId: sourceNode.metaObjectId,
                targetId: targetNode.metaObjectId
              },
              true
            )
          }
        }
        const newE = { id: Id.getId(), ...e }
        instance.updateWhiteboard?.(w => {
          w.edges?.set(newE.id, newE)
        }, true)
      },
      repositionEdge: (edgeId, direction, mousePos) => {
        const edge = instance.getEdge?.(edgeId)
        if (edge) {
          if (direction === 'source') {
            setOverlayState({
              isReposition: true,
              targetNodeId: edge.targetId,
              targetPosition: edge.targetPosition,
              currentEdgeId: edgeId,
              repositionDirection: direction,
              currentMousePosition: mousePos
            })
          } else {
            setOverlayState({
              isReposition: true,
              targetNodeId: undefined,
              targetPosition: undefined,
              sourceNodeId: edge.sourceId,
              currentEdgeId: edgeId,
              repositionDirection: direction,
              sourcePosition: edge.sourcePosition,
              currentMousePosition: mousePos
            })
          }
        }
      },
      getEdgeOverlayState: () => overlayState,
      hasEdge: (sourceNodeId, sourcePosition, targetNodeId, targetPosition) => {
        const allEdges = instance.getAllEdge?.()
        return (
          allEdges?.some(
            e =>
              e.sourceId === sourceNodeId &&
              e.targetId === targetNodeId &&
              e.sourcePosition === sourcePosition &&
              e.targetPosition === targetPosition
          ) ?? false
        )
      },
      startDrawEdge: sourceNodeId => {
        setOverlayState({ isAdding: true, sourceNodeId: sourceNodeId })
      }
    }
  })
  const defaultLineType = useSelectGlobalAtomValue(SettingAtom, s => s.whiteboard.defaultLineType)
  useEffect(() => {
    if (!overlayState.isAdding && !overlayState.isReposition) {
      setPath(undefined)
    }
    if (!overlayState.sourceNodeId && !overlayState.targetNodeId) {
      setPath(undefined)
      return
    }
    if (!overlayState.currentMousePosition) return
    let sourcePos: EdgePosition | undefined = undefined
    let sourceXY: XYPosition | undefined = undefined
    let targetPos: EdgePosition | undefined = undefined
    let targetXY: XYPosition | undefined = undefined
    if (!overlayState.sourcePosition) {
      if (!overlayState.targetPosition) return
      sourceXY = overlayState.currentMousePosition
      sourcePos = revertPos(overlayState.targetPosition)
    } else {
      if (!overlayState.sourceNodeId) return
      sourcePos = overlayState.sourcePosition
      sourceXY = getHandlePosition(overlayState.sourceNodeId, sourcePos, instance)
    }
    if (!overlayState.targetPosition) {
      if (!overlayState.sourcePosition) return
      targetXY = overlayState.currentMousePosition
      targetPos = revertPos(overlayState.sourcePosition)
    } else {
      if (!overlayState.targetNodeId) return
      targetPos = overlayState.targetPosition
      targetXY = getHandlePosition(overlayState.targetNodeId, targetPos, instance)
    }
    if (!targetXY) return
    let path = []
    // console.log(sourcePos, sourceXY)
    const lineType = currentEdge?.lineType || defaultLineType
    if (lineType === 'curve') {
      path = getBezierPath({
        sourceX: sourceXY.x,
        sourceY: sourceXY.y,
        targetX: targetXY.x,
        targetY: targetXY.y,
        sourcePosition: sourcePos,
        targetPosition: targetPos
      })
    } else if (lineType === 'polyline') {
      path = getSmoothPolyPath({
        sourceX: sourceXY.x,
        sourceY: sourceXY.y,
        targetX: targetXY.x,
        targetY: targetXY.y,
        sourcePosition: sourcePos,
        targetPosition: targetPos,
        borderRadius: 5
      })
    } else {
      path = [`M ${sourceXY.x},${sourceXY.y} L ${targetXY.x},${targetXY.y}`]
    }
    setPath(path[0])
  }, [
    overlayState.sourcePosition,
    overlayState.sourceNodeId,
    overlayState.targetNodeId,
    overlayState.targetPosition,
    overlayState.currentMousePosition,
    overlayState.isReposition,
    overlayState.isAdding
  ])

  return (
    <g>
      <path
        className={
          currentEdge?.lineStyle === 'animatedDash' ? animatedEdgeClazz : currentEdge?.lineStyle === 'dash' ? dashEdgeClazz : undefined
        }
        fill="none"
        markerEnd={`url(#${getMarkerId('end', Colors.getAdaptColor(currentEdge?.color || MarkerColor.PRIMARY)!)})`}
        stroke={Colors.getAdaptColor(currentEdge?.color || MarkerColor.PRIMARY)}
        d={path}
        strokeWidth={
          currentEdge?.lineStyle === 'animatedDash' || currentEdge?.lineStyle === 'dash'
            ? 4
            : currentEdge?.lineStyle === 'regular'
              ? 4
              : currentEdge?.lineStyle === 'thick'
                ? 6
                : 2
        }
      ></path>
    </g>
  )
})

export default EdgeOverlay
