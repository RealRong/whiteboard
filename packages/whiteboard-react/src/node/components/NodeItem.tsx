import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { PointerEvent } from 'react'
import { getSelectionModeFromEvent } from '@whiteboard/engine'
import type { NodeContainerProps, NodeHandleSide, NodeItemProps, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle, renderNodeDefinition } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useInstance } from '../../common/hooks'
import { NodeBlock } from './NodeBlock'

type NodeTransformHandlesProps = {
  node: NodeItemProps['item']['node']
  rect: NodeItemProps['item']['rect']
  rotation: number
  handles: NonNullable<NodeItemProps['transformHandles']>
  canRotate: boolean
}

type NodeTransformHandle = NodeTransformHandlesProps['handles'][number]
const NODE_TRANSFORM_HANDLE_SIZE = 10

const NodeTransformHandles = ({
  node,
  rect,
  rotation,
  handles,
  canRotate
}: NodeTransformHandlesProps) => {
  const instance = useInstance()
  const getZoom = instance.runtime.viewport.getZoom
  const filteredHandles = useMemo(
    () => (canRotate ? handles : handles.filter((handle) => handle.kind !== 'rotate')),
    [canRotate, handles]
  )
  const nodeRotation = typeof rotation === 'number' ? rotation : typeof node.rotation === 'number' ? node.rotation : 0
  const enabled = filteredHandles.length > 0

  const handlePointerDown = useCallback(
    (handle: NodeTransformHandle, event: PointerEvent<HTMLDivElement>) => {
      if (!enabled || node.locked) return
      if (event.button !== 0) return
      let handled = false

      if (handle.kind === 'resize' && handle.direction) {
        handled = instance.runtime.interaction.nodeTransform.startResize({
          nodeId: node.id,
          pointerId: event.pointerId,
          handle: handle.direction,
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          rotation: nodeRotation
        })
      }

      if (handle.kind === 'rotate') {
        handled = instance.runtime.interaction.nodeTransform.startRotate({
          nodeId: node.id,
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          rect,
          rotation: nodeRotation
        })
      }

      if (!handled) return
      event.preventDefault()
      event.stopPropagation()
    },
    [enabled, instance.runtime.interaction.nodeTransform, node.id, node.locked, nodeRotation, rect]
  )

  const getHandleProps = useCallback(
    (handle: NodeTransformHandle) => ({
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => handlePointerDown(handle, event)
    }),
    [handlePointerDown]
  )

  return (
    <>
      {filteredHandles.map((handle) => {
        const props = getHandleProps(handle)
        const half = NODE_TRANSFORM_HANDLE_SIZE / Math.max(getZoom(), 0.0001) / 2
        return (
          <div
            key={handle.id}
            data-selection-ignore
            data-kind={handle.kind}
            className="wb-node-transform-handle"
            style={{
              '--wb-node-handle-size': `${NODE_TRANSFORM_HANDLE_SIZE}px`,
              '--wb-node-handle-x': `${handle.position.x - half}px`,
              '--wb-node-handle-y': `${handle.position.y - half}px`,
              cursor: handle.cursor
            } as CSSProperties}
            {...props}
          />
        )
      })}
    </>
  )
}

export const NodeItem = ({ item, transformHandles }: NodeItemProps) => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const node = item.node
  const rect = item.rect
  const selected = item.selected
  const hovered = item.hovered
  const zoom = item.zoom
  const container = item.container
  const activeTool = item.activeTool
  const containerRef = useRef<HTMLDivElement>(null)
  const definition = useMemo(() => registry.get(node.type), [node.type, registry])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
  const core = instance.runtime.core
  const clientToWorld = instance.runtime.viewport.clientToWorld

  const nodeStyle = useMemo(
    () =>
      getNodeDefinitionStyle(definition, {
        core,
        commands: instance.commands,
        node,
        rect,
        selected,
        hovered,
        zoom
      }),
    [core, definition, hovered, instance.commands, node, rect, selected, zoom]
  )

  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (containerRef.current === element) return
      if (containerRef.current) {
        instance.runtime.dom.nodeSize.unobserve(node.id)
      }
      containerRef.current = element
      if (element) {
        instance.runtime.dom.nodeSize.observe(node.id, element, true)
      }
    },
    [instance.runtime.dom.nodeSize, node.id]
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activeTool === 'edge') {
        const worldPoint = clientToWorld(event.clientX, event.clientY)
        const handled = instance.runtime.interaction.edgeConnect.handleNodePointerDown(
          node.id,
          worldPoint,
          event.pointerId
        )
        if (!handled) return
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (event.button === 0) {
        const mode = getSelectionModeFromEvent(event.nativeEvent)
        if (mode === 'toggle') {
          instance.commands.selection.toggle([node.id])
        } else {
          instance.commands.selection.select([node.id], mode)
        }
      }

      const handled = instance.runtime.interaction.nodeDrag.start({
        nodeId: node.id,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
      if (!handled) return
      event.preventDefault()
    },
    [activeTool, clientToWorld, instance, node.id]
  )

  const handlePointerEnter = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: node.id } })
  }, [instance, node.id])

  const handlePointerLeave = useCallback(() => {
    instance.commands.interaction.update({ hover: { nodeId: undefined } })
  }, [instance])

  const handleEdgeHandlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => {
      event.preventDefault()
      event.stopPropagation()
      instance.runtime.interaction.edgeConnect.startFromHandle(node.id, side, event.pointerId)
    },
    [instance, node.id]
  )

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
      onPointerDown: handlePointerDown,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: handlePointerLeave
    }),
    [
      baseContainerProps,
      handlePointerDown,
      handlePointerEnter,
      handlePointerLeave
    ]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      core,
      commands: instance.commands,
      node,
      rect,
      selected,
      hovered,
      zoom,
      containerProps
    }),
    [containerProps, core, hovered, instance.commands, node, rect, selected, zoom]
  )

  const content = useMemo(
    () => renderNodeDefinition(definition, renderProps),
    [definition, renderProps]
  )

  const resolvedTransformHandles = transformHandles ?? []
  const shouldMountTransform = resolvedTransformHandles.length > 0

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
          showHandles={false}
          ref={containerProps.ref}
          style={containerProps.style}
          onHandlePointerDown={handleEdgeHandlePointerDown}
          onPointerDown={containerProps.onPointerDown}
          onPointerEnter={containerProps.onPointerEnter}
          onPointerLeave={containerProps.onPointerLeave}
        />
      )}
      {shouldMountTransform ? (
        <NodeTransformHandles
          node={node}
          rect={rect}
          rotation={container.rotation}
          handles={resolvedTransformHandles}
          canRotate={canRotate}
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
