import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { buildTransformHandles, type TransformHandle } from '@whiteboard/core/node'
import type { NodeContainerProps, NodeItemProps, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle, renderNodeDefinition } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import {
  useInstance,
  useWhiteboardRenderSelector,
  useWhiteboardSelector
} from '../../common/hooks'
import { NodeBlock } from './NodeBlock'

type NodeTransformHandlesProps = {
  node: NodeItemProps['item']['node']
  handles: TransformHandle[]
  zoom: number
}
const NODE_TRANSFORM_HANDLE_SIZE = 10
const NODE_SIZE_EPSILON = 0.5
const NODE_ROTATE_HANDLE_OFFSET = 24

const NodeTransformHandles = ({
  node,
  handles,
  zoom
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

export const NodeItem = ({ item }: NodeItemProps) => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const node = item.node
  const rect = item.rect
  const container = item.container
  const activeTool = useWhiteboardSelector('tool')
  const selected = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedNodeIds.has(node.id),
    {
      keys: ['selection']
    }
  )
  const hovered = useWhiteboardRenderSelector(
    (snapshot) => snapshot.groupHover.nodeId === node.id,
    {
      keys: ['groupHover']
    }
  )
  const zoom = useWhiteboardSelector(
    (snapshot) => snapshot.viewport.zoom,
    {
      keys: ['viewport']
    }
  )
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
      rotation: container.rotation,
      canRotate,
      rotateHandleOffset: NODE_ROTATE_HANDLE_OFFSET,
      zoom
    })
  }, [activeTool, canRotate, container.rotation, node.locked, rect, selected, zoom])

  const nodeStyle = useMemo(
    () =>
      getNodeDefinitionStyle(definition, {
        query: instance.query,
        commands: instance.commands,
        node,
        rect,
        selected,
        hovered,
        zoom
      }),
    [definition, hovered, instance.commands, instance.query, node, rect, selected, zoom]
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
      instance.commands.host.nodeMeasured(node.id, size)
    },
    [instance.commands.host, node.id]
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

  const baseContainerProps = useMemo<NodeContainerProps>(
    () => ({
      rect,
      nodeId: node.id,
      selected,
      ref: setContainerRef,
      style: buildContainerStyle(container, nodeStyle)
    }),
    [container, node.id, nodeStyle, rect, selected, setContainerRef]
  )

  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      ...baseContainerProps,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave
    }),
    [
      baseContainerProps,
      handlePointerEnter,
      handlePointerLeave
    ]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      query: instance.query,
      commands: instance.commands,
      node,
      rect,
      selected,
      hovered,
      zoom,
      containerProps
    }),
    [containerProps, hovered, instance.commands, instance.query, node, rect, selected, zoom]
  )

  const content = useMemo(
    () => renderNodeDefinition(definition, renderProps),
    [definition, renderProps]
  )

  const shouldMountTransform = transformHandles.length > 0

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
      {shouldMountTransform ? (
        <NodeTransformHandles
          node={node}
          handles={transformHandles}
          zoom={zoom}
        />
      ) : null}
    </>
  )
}

const buildContainerStyle = (
  container: NodeItemProps['item']['container'],
  nodeStyle: CSSProperties
): CSSProperties => {
  const extraTransform = nodeStyle.transform
  const rotationTransform = container.rotation !== 0 ? `rotate(${container.rotation}deg)` : undefined
  const combinedTransform = [container.transformBase, extraTransform, rotationTransform].filter(Boolean).join(' ')

  return {
    ...nodeStyle,
    pointerEvents: 'auto',
    transform: combinedTransform,
    transformOrigin: rotationTransform ? container.transformOrigin : nodeStyle.transformOrigin
  }
}
