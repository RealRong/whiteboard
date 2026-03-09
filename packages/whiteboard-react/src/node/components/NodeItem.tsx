import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { buildTransformHandles, type TransformHandle } from '@whiteboard/core/node'
import type { NodeContainerProps, NodeItemProps, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle, renderNodeDefinition } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useNodeDragInteraction } from '../hooks/useNodeDragInteraction'
import { useNodeTransformInteraction } from '../hooks/useNodeTransformInteraction'
import { useEdgeConnectInteraction } from '../../edge/hooks/useEdgeConnectInteraction'
import {
  useInstance,
  useSelectionContains,
  useViewportZoom,
  useWhiteboardSelector
} from '../../common/hooks'
import { useNodeInteractionPreviewSelector } from '../interaction/nodeInteractionPreviewState'
import { NodeBlock } from './NodeBlock'
import type { PointerEvent as ReactPointerEvent } from 'react'

type NodeTransformHandlesProps = {
  node: NodeItemProps['item']['node']
  handles: TransformHandle[]
  zoom: number
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    handle: TransformHandle
  ) => void
}
const NODE_CONNECT_SIDES = ['top', 'right', 'bottom', 'left'] as const
type NodeConnectSide = (typeof NODE_CONNECT_SIDES)[number]
type NodeConnectHandlesProps = {
  node: NodeItemProps['item']['node']
  rect: NodeItemProps['item']['rect']
  style: CSSProperties
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    side: NodeConnectSide
  ) => void
}
const NODE_TRANSFORM_HANDLE_SIZE = 10
const NODE_SIZE_EPSILON = 0.5
const NODE_ROTATE_HANDLE_OFFSET = 24

const NodeTransformHandles = ({
  node,
  handles,
  zoom,
  onHandlePointerDown
}: NodeTransformHandlesProps) => {
  return (
    <>
      {handles.map((handle) => {
        const half = NODE_TRANSFORM_HANDLE_SIZE / Math.max(zoom, 0.0001) / 2
        return (
          <div
            key={handle.id}
            data-selection-ignore
            data-input-role="node-transform-handle"
            data-node-id={node.id}
            data-transform-kind={handle.kind}
            data-resize-direction={handle.direction}
            className="wb-node-transform-handle"
            onPointerDown={(event) => {
              onHandlePointerDown(event, handle)
            }}
            style={{
              '--wb-node-handle-size': `${NODE_TRANSFORM_HANDLE_SIZE}px`,
              '--wb-node-handle-x': `${handle.position.x - half}px`,
              '--wb-node-handle-y': `${handle.position.y - half}px`,
              cursor: handle.cursor
            } as CSSProperties}
          />
        )
      })}
    </>
  )
}

const NodeConnectHandles = ({
  node,
  rect,
  style,
  onHandlePointerDown
}: NodeConnectHandlesProps) => {
  return (
    <div
      className="wb-node-connect-handle-layer"
      style={{
        ...style,
        width: rect.width,
        height: rect.height
      }}
    >
      {NODE_CONNECT_SIDES.map((side) => (
        <div
          key={side}
          data-selection-ignore
          data-input-role="node-edge-handle"
          data-node-id={node.id}
          data-handle-side={side}
          className={`wb-node-handle wb-node-handle-${side}`}
          onPointerDown={(event) => {
            onHandlePointerDown(event, side)
          }}
        />
      ))}
    </div>
  )
}

export const NodeItem = ({ item }: NodeItemProps) => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const previewUpdate = useNodeInteractionPreviewSelector(
    (snapshot) => snapshot.updatesById.get(item.node.id)
  )
  const node = useMemo(() => {
    if (!previewUpdate) return item.node
    const next = { ...item.node }
    if (previewUpdate.position) {
      next.position = previewUpdate.position
    }
    if (previewUpdate.size) {
      next.size = previewUpdate.size
    }
    if (typeof previewUpdate.rotation === 'number') {
      next.rotation = previewUpdate.rotation
    }
    return next
  }, [item.node, previewUpdate])
  const rect = useMemo(() => {
    if (!previewUpdate?.position && !previewUpdate?.size) return item.rect
    return {
      x: previewUpdate.position?.x ?? item.rect.x,
      y: previewUpdate.position?.y ?? item.rect.y,
      width: previewUpdate.size?.width ?? item.rect.width,
      height: previewUpdate.size?.height ?? item.rect.height
    }
  }, [item.rect, previewUpdate])
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  const activeTool = useWhiteboardSelector('tool')
  const selected = useSelectionContains(node.id)
  const hovered = useNodeInteractionPreviewSelector(
    (snapshot) => snapshot.hoveredGroupId === node.id
  )
  const zoom = useViewportZoom()
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const measureFrameRef = useRef<number | null>(null)
  const pendingSizeRef = useRef<{ width: number; height: number } | null>(null)
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null)
  const definition = useMemo(() => registry.get(node.type), [node.type, registry])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'

  const transformHandles = useMemo<TransformHandle[]>(() => {
    if (activeTool !== 'select') return []
    if (!selected || node.locked) return []
    return buildTransformHandles({
      rect,
      rotation,
      canRotate,
      rotateHandleOffset: NODE_ROTATE_HANDLE_OFFSET,
      zoom
    })
  }, [activeTool, canRotate, node.locked, rect, rotation, selected, zoom])

  const nodeStyle = useMemo(
    () =>
      getNodeDefinitionStyle(definition, {
        read: instance.read,
        commands: instance.commands,
        node,
        rect,
        selected,
        hovered,
        zoom
      }),
    [definition, hovered, instance.commands, instance.read, node, rect, selected, zoom]
  )

  const emitMeasuredSize = useCallback(
    (size: { width: number; height: number }) => {
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return
      if (size.width <= 0 || size.height <= 0) return
      const prev = lastSizeRef.current
      if (
        prev
        && Math.abs(prev.width - size.width) < NODE_SIZE_EPSILON
        && Math.abs(prev.height - size.height) < NODE_SIZE_EPSILON
      ) {
        return
      }
      lastSizeRef.current = size
      instance.commands.node.updateMany(
        [{
          id: node.id,
          patch: { size }
        }],
        { source: 'system' }
      )
    },
    [instance.commands.node, node.id]
  )

  const flushPendingMeasure = useCallback(() => {
    measureFrameRef.current = null
    const pending = pendingSizeRef.current
    pendingSizeRef.current = null
    if (!pending) return
    emitMeasuredSize(pending)
  }, [emitMeasuredSize])

  const scheduleMeasure = useCallback(
    (size: { width: number; height: number }) => {
      pendingSizeRef.current = size
      if (measureFrameRef.current !== null) return
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        flushPendingMeasure()
        return
      }
      measureFrameRef.current = window.requestAnimationFrame(flushPendingMeasure)
    },
    [flushPendingMeasure]
  )

  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (containerRef.current === element) return
      if (containerRef.current && resizeObserverRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current)
      }
      containerRef.current = element
      if (!element) return

      const rect = element.getBoundingClientRect()
      scheduleMeasure({ width: rect.width, height: rect.height })

      if (typeof ResizeObserver === 'undefined') return
      if (!resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const target = entry.target as HTMLElement | null
            if (!target || target !== containerRef.current) continue
            const box = entry.borderBoxSize?.[0]
            scheduleMeasure({
              width: box?.inlineSize ?? entry.contentRect.width,
              height: box?.blockSize ?? entry.contentRect.height
            })
          }
        })
      }
      resizeObserverRef.current.observe(element)
    },
    [scheduleMeasure]
  )

  useEffect(() => () => {
    if (measureFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(measureFrameRef.current)
      measureFrameRef.current = null
    }
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null
  }, [])

  const handlePointerEnter = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: node.id } })
  }, [instance, node.id])

  const handlePointerLeave = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: undefined } })
  }, [instance])

  const { handleNodeConnectPointerDown, handleConnectHandlePointerDown } = useEdgeConnectInteraction()
  const { handleNodePointerDown } = useNodeDragInteraction({
    nodeId: node.id
  })
  const handleContainerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (handleNodeConnectPointerDown(event, node.id)) return
      handleNodePointerDown(event)
    },
    [handleNodeConnectPointerDown, handleNodePointerDown, node.id]
  )
  const handleNodeConnectHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, side: NodeConnectSide) => {
      handleConnectHandlePointerDown(event, node.id, side)
    },
    [handleConnectHandlePointerDown, node.id]
  )

  const baseContainerProps = useMemo<NodeContainerProps>(
    () => ({
      rect,
      nodeId: node.id,
      selected,
      ref: setContainerRef,
      style: buildContainerStyle(rect, rotation, nodeStyle)
    }),
    [node.id, nodeStyle, rect, rotation, selected, setContainerRef]
  )

  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      ...baseContainerProps,
      onPointerDown: handleContainerPointerDown,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave
    }),
    [
      baseContainerProps,
      handleContainerPointerDown,
      handlePointerEnter,
      handlePointerLeave
    ]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      read: instance.read,
      commands: instance.commands,
      node,
      rect,
      selected,
      hovered,
      zoom,
      containerProps
    }),
    [containerProps, hovered, instance.commands, instance.read, node, rect, selected, zoom]
  )

  const content = useMemo(
    () => renderNodeDefinition(definition, renderProps),
    [definition, renderProps]
  )

  const connectHandleOverlayStyle = useMemo(
    () => buildConnectHandleOverlayStyle(rect, rotation, nodeStyle),
    [nodeStyle, rect, rotation]
  )
  const shouldMountConnectHandles = activeTool === 'edge' && (selected || hovered)
  const shouldMountTransform = transformHandles.length > 0
  const { handleTransformPointerDown } = useNodeTransformInteraction({
    nodeId: node.id
  })

  return (
    <>
      {definition?.renderContainer ? (
        definition.renderContainer(renderProps, content)
      ) : (
        <NodeBlock
          rect={rect}
          label={content}
          nodeId={node.id}
          selected={selected}
          ref={containerProps.ref}
          style={containerProps.style}
          onPointerDown={containerProps.onPointerDown}
          onPointerEnter={containerProps.onPointerEnter}
          onPointerLeave={containerProps.onPointerLeave}
        />
      )}
      {shouldMountConnectHandles ? (
        <NodeConnectHandles
          node={node}
          rect={rect}
          style={connectHandleOverlayStyle}
          onHandlePointerDown={handleNodeConnectHandlePointerDown}
        />
      ) : null}
      {shouldMountTransform ? (
        <NodeTransformHandles
          node={node}
          handles={transformHandles}
          zoom={zoom}
          onHandlePointerDown={handleTransformPointerDown}
        />
      ) : null}
    </>
  )
}

const buildContainerTransformStyle = (
  rect: NodeItemProps['item']['rect'],
  rotation: number,
  nodeStyle: CSSProperties
) => {
  const extraTransform = nodeStyle.transform
  const baseTransform = `translate(${rect.x}px, ${rect.y}px)`
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}deg)` : undefined
  const transform = [baseTransform, extraTransform, rotationTransform]
    .filter(Boolean)
    .join(' ')

  return {
    transform: transform || undefined,
    transformOrigin: rotationTransform ? 'center center' : nodeStyle.transformOrigin
  }
}

const buildContainerStyle = (
  rect: NodeItemProps['item']['rect'],
  rotation: number,
  nodeStyle: CSSProperties
): CSSProperties => {
  const transformStyle = buildContainerTransformStyle(rect, rotation, nodeStyle)

  return {
    ...nodeStyle,
    pointerEvents: 'auto',
    ...transformStyle
  }
}

const buildConnectHandleOverlayStyle = (
  rect: NodeItemProps['item']['rect'],
  rotation: number,
  nodeStyle: CSSProperties
): CSSProperties => {
  const transformStyle = buildContainerTransformStyle(rect, rotation, nodeStyle)

  return {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    ...transformStyle
  }
}
