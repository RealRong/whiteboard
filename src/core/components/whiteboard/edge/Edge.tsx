import { FC, memo, MouseEventHandler, useEffect, useRef, useState } from 'react'
import { IWhiteboardEdge, XYPosition } from '~/typings'
import { WhiteboardAtom } from '../StateHooks'
import { getBezierPath, getEdgeData } from '../utils'
import { getMarkerId } from '../../graph/utils/getMarkerId'
import { MarkerColor } from '@/consts'
import { useSelectAtomValue, useToggle, useUpdateEffect } from '@/hooks'
import Colors from '@/consts/colors'
import { css, keyframes } from '@emotion/css'
import { getSmoothPolyPath } from '@/core/components/whiteboard/utils/getSmoothPoly'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { EdgeOverlayStateAtom } from '@/core/components/whiteboard/edge/EdgeOverlay'
import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { createPortal } from 'react-dom'
import { selectAtom } from 'jotai/utils'
import { isEqual } from 'lodash'
import { useAtomValue } from 'jotai'

const keyframe = keyframes({
  '0%': {
    strokeDashoffset: 16
  }
})

export const animatedEdgeClazz = css({
  strokeDasharray: 8,
  animation: `${keyframe} 0.5s linear infinite`
})
export const dashEdgeClazz = css({
  strokeDasharray: 8
})

const EdgeSelectAtom = selectAtom(
  WhiteboardStateAtom,
  s => ({
    pointerMode: s.pointerMode,
    currentHighlight: s.highlightedIds
  }),
  (a, b) => isEqual(a, b)
)
const TreeEdge: FC<{
  edge: IWhiteboardEdge
  lineType?: IWhiteboardEdge['lineType']
  hideArrow?: boolean
  hideLabel?: boolean
  disablePopover?: boolean
  disableReposition?: boolean
  clickEditLabel?: boolean
  strokeWidth?: string | number
  onLabelChange?: (value: string) => void
  isMindmapConnection?: boolean
}> = memo(
  ({
    edge,
    lineType: outLineType,
    onLabelChange,
    hideLabel = false,
    clickEditLabel,
    hideArrow = false,
    disablePopover = false,
    strokeWidth,
    disableReposition = false,
    isMindmapConnection
  }) => {
    const { id, sourceId, targetId, targetPosition = 'left', sourcePosition = 'right', metaLinkId, lineType, lineStyle = 'straight' } = edge
    const [innerLink, setInnerLink] = useState<Partial<IWhiteboardEdge>>(edge)
    const [isEditingLabel, toggleIsEditingLabel] = useToggle(false)
    const defaultLineType = outLineType ?? useSelectAtomValue(WhiteboardAtom, s => s?.lineType)
    const { currentHighlight, pointerMode } = useAtomValue(EdgeSelectAtom)
    const realLineType = lineType || defaultLineType
    const labelRef = useRef<HTMLDivElement>(null)
    const labelContainerRef = useRef<SVGGElement>(null)
    const isReposition = useSelectAtomValue(EdgeOverlayStateAtom, s => s.isReposition)
    const currentEdgeId = useSelectAtomValue(EdgeOverlayStateAtom, s => s.currentEdgeId)
    const underlineRef = useRef<SVGPathElement>(null)
    const edgeRef = useRef<SVGPathElement>(null)
    const instance = useWhiteboardInstance()
    const pathRef = useRef<string>()
    const labelPosRef = useRef<XYPosition>()
    const gRef = useRef<SVGGElement>(null)
    const underEdgeRef = useRef<SVGPathElement>(null)
    const targetNode = useSelectAtomValue(WhiteboardAtom, s => s?.nodes?.get(targetId))
    const targetBorderColor = targetNode?.border
    const targetBorderType = targetNode?.borderType
    const drawPath = () => {
      try {
        instance.edgeOps?.getEdgeFuncs(edge.id)?.removeTransform()
        const sourceNode = instance.getNode?.(sourceId)
        const targetNode = instance.getNode?.(targetId)

        if (sourceNode?.collapse || targetNode?.collapse || !sourceNode || !targetNode) {
          underlineRef.current?.removeAttribute('d')
          edgeRef.current?.removeAttribute('d')
          labelContainerRef.current?.style.setProperty('display', 'none')
          return
        }
        const edgeData = getEdgeData(sourceId, targetId, sourcePosition, targetPosition, instance, isMindmapConnection)
        if (edgeData) {
          if (isMindmapConnection) {
            const target = instance.getNode?.(targetId)
            const targetUnderline = target?.borderType === 'underline'
            if (targetUnderline) {
              const targetPos = instance.nodeOps?.getNodeFuncs(targetId)?.getRealtimeBox()
              if (targetPos && targetUnderline) {
                underlineRef.current?.setAttribute(
                  'd',
                  `M ${targetPos.left},${targetPos.top + targetPos.height} L ${targetPos.left + targetPos.width},${
                    targetPos.top + targetPos.height
                  }`
                )
              }
            } else {
              underlineRef.current?.removeAttribute('d')
            }
          }
          const { sourceXY, targetXY } = edgeData
          let path = ''
          let labelX = 0
          let labelY = 0
          if (realLineType === 'curve') {
            ;[path, labelX, labelY] = getBezierPath({
              sourceX: sourceXY.x,
              sourceY: sourceXY.y,
              targetX: targetXY.x,
              targetY: targetXY.y,
              sourcePosition,
              targetPosition
            })
          }
          if (realLineType === 'straight') {
            path = `M ${sourceXY.x},${sourceXY.y} L ${targetXY.x},${targetXY.y}`
            labelX = (sourceXY.x + targetXY.x) / 2
            labelY = (sourceXY.y + targetXY.y) / 2
          }
          if (realLineType === 'tightCurve') {
            ;[path, labelX, labelY] = getSmoothPolyPath({
              sourceX: sourceXY.x,
              sourceY: sourceXY.y,
              sourcePosition,
              targetPosition,
              targetX: targetXY.x,
              targetY: targetXY.y,
              borderRadius: 40,
              bendOnlyLast: true
            })
          }
          if (realLineType === 'polyline') {
            ;[path, labelX, labelY] = getSmoothPolyPath({
              sourceX: sourceXY.x,
              sourceY: sourceXY.y,
              sourcePosition,
              targetPosition,
              targetX: targetXY.x,
              targetY: targetXY.y,
              borderRadius: 4
            })
          }
          edgeRef.current?.setAttribute('d', path)
          underEdgeRef.current?.setAttribute('d', path)
          pathRef.current = path
          labelPosRef.current = {
            x: labelX,
            y: labelY
          }
          labelContainerRef.current?.setAttribute('transform', `translate(${labelX} ${labelY})`)
          labelContainerRef.current?.style.setProperty('display', 'initial')
        }
      } catch (e) {
        console.error(e)
      }
    }

    instance.values.ID_TO_EDGE_MAP.set(id, {
      drawPath,
      edit: () => toggleIsEditingLabel(true),
      transformEdge: (x, y) => {
        const g = gRef.current
        const l = labelContainerRef.current
        if (g) {
          g.style.transform = `translate(${x}px,${y}px)`
        }
        if (l) {
          l.style.transform = `translate(${x}px,${y}px)`
        }
      },
      removeTransform: () => {
        const g = gRef.current
        const l = labelContainerRef.current
        if (g) {
          g.style.removeProperty('transform')
        }
        if (l) {
          l.style.removeProperty('transform')
        }
      }
    })
    const clickHandler: MouseEventHandler = e => {
      if (clickEditLabel) {
        toggleIsEditingLabel(true)
      }
      if (disablePopover) return
      const pos = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
      if (pos) {
        instance.toolbarOps?.openEdgeToolbar(edge.id, pos)
      }
    }
    const labelLayer = instance.getEdgeLabelLayer?.()
    useEffect(() => {
      if (labelRef.current && !hideLabel) {
        labelRef.current.innerText = edge.label || ''
        if (edge.label !== innerLink.label) {
          setInnerLink(s => ({ ...s, label: edge.label }))
        }
      }
    }, [edge?.label, hideLabel])

    const handlePointerDown = (e: PointerEvent) => {
      if (disableReposition) return
      e.preventDefault()
      const node = e.currentTarget as SVGElement
      const nextPointerHandler = (e: PointerEvent) => {
        if (e.type === 'pointerup') {
          node.removeEventListener('pointermove', nextPointerHandler)
          document.removeEventListener('pointerup', nextPointerHandler)
        }
        if (e.type === 'pointermove') {
          if (Math.abs(e.movementX) >= 1 || Math.abs(e.movementY) >= 1) {
            const node = e.currentTarget as SVGElement
            const bounding = node.getBoundingClientRect()
            const { sourceXY, targetXY } = getEdgeData(sourceId, targetId, sourcePosition, targetPosition, instance)
            const center = bounding.left + bounding.width / 2
            let drag: 'source' | 'target' = 'source'

            if (e.clientX < center) {
              if (sourceXY.x > targetXY.x) {
                drag = 'target'
              }
            } else {
              if (sourceXY.x < targetXY.x) {
                drag = 'target'
              }
            }
            const mousePos = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
            if (mousePos) {
              instance.edgeOps?.repositionEdge(edge.id, drag, mousePos)
            }
          }
        }
      }

      if (e.button === 0) {
        node.addEventListener('pointermove', nextPointerHandler)
        document.addEventListener('pointerup', nextPointerHandler)
      }

      // right to left
    }
    useUpdateEffect(() => {
      if (isEditingLabel) {
        const keydownHandler = (e: KeyboardEvent) => {
          e.stopPropagation()
        }
        document.addEventListener('keydown', keydownHandler, true)
        drawPath()
        labelRef.current?.focus()
        return () => {
          document.removeEventListener('keydown', keydownHandler, true)
        }
      } else {
        if (innerLink.label !== undefined && innerLink.label !== edge.label) {
          updateEdge({ label: innerLink.label })
          onLabelChange?.(innerLink.label)
        }
      }
    }, [isEditingLabel])

    const updateEdge = (edge: Partial<IWhiteboardEdge>) => {
      instance.updateEdge?.(id, e => ({ ...e, ...edge }))
    }

    useEffect(() => {
      drawPath()
    }, [sourceId, sourcePosition, targetPosition, targetId, realLineType, targetBorderType, targetBorderColor])

    const repositionCurrent = isReposition && currentEdgeId === edge.id
    return (
      <>
        <g
          ref={gRef}
          onClick={clickHandler}
          onPointerDown={handlePointerDown}
          style={{
            pointerEvents: 'none',
            cursor: 'pointer',
            opacity: currentHighlight ? (currentHighlight.edgeIds.has(edge.id) ? 1 : 0.2) : 1,
            display: repositionCurrent ? 'none' : 'unset'
          }}
        >
          <path
            className={lineStyle === 'animatedDash' ? animatedEdgeClazz : lineStyle === 'dash' ? dashEdgeClazz : undefined}
            pointerEvents="none"
            ref={edgeRef}
            fill="none"
            markerEnd={hideArrow ? undefined : `url(#${getMarkerId('end', Colors.getAdaptColor(edge?.color || MarkerColor.PRIMARY)!)})`}
            stroke={Colors.getAdaptColor(edge?.color || MarkerColor.PRIMARY)}
            strokeWidth={
              strokeWidth ??
              (lineStyle === 'animatedDash' || lineStyle === 'dash' ? 4 : lineStyle === 'regular' ? 4 : lineStyle === 'thick' ? 6 : 2)
            }
          ></path>
          {isMindmapConnection && targetBorderType === 'underline' && (
            <path
              ref={underlineRef}
              stroke={
                targetBorderColor ? Colors.getAdaptColor(targetBorderColor) : Colors.getAdaptColor(edge?.color || MarkerColor.PRIMARY)
              }
              strokeWidth={
                strokeWidth ??
                (lineStyle === 'animatedDash' || lineStyle === 'dash' ? 4 : lineStyle === 'regular' ? 4 : lineStyle === 'thick' ? 6 : 2)
              }
            />
          )}
          {((!disableReposition && !disablePopover) || clickEditLabel) && (
            <path
              ref={underEdgeRef}
              pointerEvents={pointerMode === 'pan' ? 'none' : 'auto'}
              stroke={'transparent'}
              strokeWidth={'calc(20 * var(--zoom-level)'}
              fill="none"
              cursor={'pointer'}
            />
          )}
        </g>
        {!hideLabel &&
          (innerLink?.label || isEditingLabel || edge.label) &&
          labelLayer &&
          createPortal(
            <foreignObject
              transform={labelPosRef.current ? `translate(${labelPosRef.current.x},${labelPosRef.current.y})` : undefined}
              ref={labelContainerRef}
              width={9999}
              height={9999}
              style={{ overflow: 'visible', pointerEvents: 'none', opacity: repositionCurrent ? 0 : 1 }}
              onPointerDown={e => e.stopPropagation()}
            >
              <div
                ref={labelRef}
                contentEditable={true}
                className={EdgeClassName}
                onBlur={() => {
                  toggleIsEditingLabel(false)
                }}
                onClick={e => {
                  e.stopPropagation()
                  setTimeout(() => toggleIsEditingLabel(true))
                }}
                style={{
                  maxWidth: '16em',
                  fontSize: isMindmapConnection ? 12 : 14,
                  padding: isMindmapConnection ? '3px' : '6px',
                  minWidth: 1,
                  width: 'max-content',
                  height: 'fit-content',
                  pointerEvents: pointerMode === 'pan' ? 'none' : 'auto'
                }}
                onInput={e => {
                  setInnerLink({
                    ...innerLink,
                    label: e.currentTarget.innerText || ''
                  })
                }}
              ></div>
            </foreignObject>,
            labelLayer
          )}
      </>
    )
  }
)

const EdgeClassName = css({
  transform: 'translateX(-50%) translateY(-50%)',
  outline: 'none',
  borderRadius: 6,
  background: Colors.Background.Secondary,
  whiteSpace: 'pre-wrap',
  fontWeight: 500,
  cursor: 'text',
  textTransform: 'none'
})
export default TreeEdge
