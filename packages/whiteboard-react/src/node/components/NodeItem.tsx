import { useCallback, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { NodeContainerProps, NodeItemProps, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle, renderNodeDefinition } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useInstance } from '../../common/hooks'
import { NodeBlock } from './NodeBlock'

type NodeTransformHandlesProps = {
  node: NodeItemProps['item']['node']
  handles: NonNullable<NodeItemProps['transformHandles']>
  canRotate: boolean
}
const NODE_TRANSFORM_HANDLE_SIZE = 10

const NodeTransformHandles = ({
  node,
  handles,
  canRotate
}: NodeTransformHandlesProps) => {
  const instance = useInstance()
  const getZoom = instance.runtime.viewport.getZoom
  const filteredHandles = useMemo(
    () => (canRotate ? handles : handles.filter((handle) => handle.kind !== 'rotate')),
    [canRotate, handles]
  )

  return (
    <>
      {filteredHandles.map((handle) => {
        const half = NODE_TRANSFORM_HANDLE_SIZE / Math.max(getZoom(), 0.0001) / 2
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

export const NodeItem = ({ item, transformHandles }: NodeItemProps) => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const node = item.node
  const rect = item.rect
  const selected = item.selected
  const hovered = item.hovered
  const zoom = item.zoom
  const container = item.container
  const containerRef = useRef<HTMLDivElement>(null)
  const definition = useMemo(() => registry.get(node.type), [node.type, registry])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'

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
