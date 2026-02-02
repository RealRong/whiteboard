import { useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, RefObject } from 'react'
import type { Core, MindmapLayoutOptions, MindmapNode, MindmapNodeId, MindmapTree, Node, Point, Rect } from '@whiteboard/core'
import { getSide, getSubtreeIds } from '@whiteboard/core'
import type { MindmapLayoutConfig, Size } from '../types'
import { useMindmapLayout } from '../hooks/useMindmapLayout'

type MindmapTreeViewProps = {
  tree: MindmapTree
  mindmapNode: Node
  nodeSize: Size
  layout: MindmapLayoutConfig
  core: Core
  screenToWorld: (point: Point) => Point
  containerRef?: RefObject<HTMLElement>
}

type DropTarget = {
  type: 'attach' | 'reorder'
  parentId: MindmapNodeId
  index: number
  side?: 'left' | 'right'
  targetId?: MindmapNodeId
  connectionLine?: { x1: number; y1: number; x2: number; y2: number }
  insertLine?: { x1: number; y1: number; x2: number; y2: number }
}

type DragPreview = {
  treeId: string
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: DropTarget
}

type DragRef = {
  pointerId: number
  nodeId: MindmapNodeId
  originParentId?: MindmapNodeId
  originIndex?: number
  offset: Point
  rect: Rect
  excludeIds: Set<MindmapNodeId>
}

const MindmapTreeView = ({ tree, mindmapNode, nodeSize, layout, core, screenToWorld, containerRef }: MindmapTreeViewProps) => {
  const computed = useMindmapLayout({
    tree,
    nodeSize,
    mode: layout.mode,
    options: layout.options
  })
  const [hoveredId, setHoveredId] = useState<MindmapNodeId | undefined>(undefined)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const dragRef = useRef<DragRef | null>(null)
  const [nodeOffset, setNodeOffset] = useState<Point>(() => ({ x: mindmapNode.position.x, y: mindmapNode.position.y }))
  const rootDragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)

  const lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = []
  Object.entries(tree.children).forEach(([parentId, childIds]) => {
    const parent = computed.node[parentId]
    if (!parent) return
    childIds.forEach((childId) => {
      const child = computed.node[childId]
      if (!child) return
      const side = parentId === tree.rootId ? tree.nodes[childId]?.side : undefined
      const { x1, y1, x2, y2 } = computeStaticConnectionLine(parent, child, side)
      lines.push({ id: `${parentId}-${childId}`, x1, y1, x2, y2 })
    })
  })

  const shiftX = -computed.bbox.x
  const shiftY = -computed.bbox.y
  const baseOffset = rootDragRef.current ? nodeOffset : mindmapNode.position
  const nodeRects = useMemo(() => {
    const map = new Map<MindmapNodeId, Rect>()
    Object.entries(computed.node).forEach(([id, rect]) => {
      map.set(id, {
        x: rect.x + shiftX + baseOffset.x,
        y: rect.y + shiftY + baseOffset.y,
        width: rect.width,
        height: rect.height
      })
    })
    return map
  }, [baseOffset.x, baseOffset.y, computed.node, shiftX, shiftY])


  const handleAddChild = useCallback(
    async (nodeId: MindmapNodeId, placement: 'left' | 'right' | 'up' | 'down') => {
      const payload = { kind: 'text', text: '' }
      const layoutHint = {
        nodeSize,
        mode: layout.mode,
        options: layout.options,
        anchorId: nodeId
      }
      if (nodeId === tree.rootId) {
        const children = tree.children[nodeId] ?? []
        const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
        const side =
          placement === 'left'
            ? 'left'
            : placement === 'right'
              ? 'right'
              : (layout.options?.side === 'left' || layout.options?.side === 'right'
                  ? layout.options.side
                  : 'right')
        await core.dispatch({
          type: 'mindmap.addChild',
          id: mindmapNode.id,
          parentId: nodeId,
          payload,
          options: { index, side, layout: layoutHint }
        })
        return
      }

      if (placement === 'up' || placement === 'down') {
        await core.dispatch({
          type: 'mindmap.addSibling',
          id: mindmapNode.id,
          nodeId,
          position: placement === 'up' ? 'before' : 'after',
          payload,
          options: { layout: layoutHint }
        })
        return
      }

      const side = getSide(tree, nodeId) ?? 'right'
      const towardRoot =
        (placement === 'left' && side === 'right') || (placement === 'right' && side === 'left')

      if (towardRoot) {
        const result = await core.dispatch({
          type: 'mindmap.addSibling',
          id: mindmapNode.id,
          nodeId,
          position: 'before',
          payload,
          options: { layout: layoutHint }
        })
        if (result.ok && result.value) {
          await core.dispatch({
            type: 'mindmap.moveSubtree',
            id: mindmapNode.id,
            nodeId,
            newParentId: result.value as MindmapNodeId,
            options: {
              index: 0,
              layout: {
                nodeSize,
                mode: layout.mode,
                options: layout.options,
                anchorId: result.value as MindmapNodeId
              }
            }
          })
        }
        return
      }

      await core.dispatch({
        type: 'mindmap.addChild',
        id: mindmapNode.id,
        parentId: nodeId,
        payload,
        options: { layout: layoutHint }
      })
    },
    [core, layout.mode, layout.options, layout.options?.side, mindmapNode.id, nodeSize, tree]
  )

  const getWorldPoint = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const element = containerRef?.current
      if (element) {
        const rect = element.getBoundingClientRect()
        return screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      }
      return screenToWorld({ x: event.clientX, y: event.clientY })
    },
    [containerRef, screenToWorld]
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: MindmapNodeId) => {
      if (event.button !== 0) return
      const rect = nodeRects.get(nodeId)
      if (!rect) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      const world = getWorldPoint(event)
      if (nodeId === tree.rootId) {
        setNodeOffset({ x: mindmapNode.position.x, y: mindmapNode.position.y })
        rootDragRef.current = {
          pointerId: event.pointerId,
          start: world,
          origin: { x: mindmapNode.position.x, y: mindmapNode.position.y }
        }
        return
      }
      const offsetPoint = { x: world.x - rect.x, y: world.y - rect.y }
      const originParentId = tree.nodes[nodeId]?.parentId
      const originIndex = originParentId ? (tree.children[originParentId] ?? []).indexOf(nodeId) : undefined
      dragRef.current = {
        pointerId: event.pointerId,
        nodeId,
        originParentId,
        originIndex,
        offset: offsetPoint,
        rect,
        excludeIds: new Set(getSubtreeIds(tree, nodeId))
      }
      setDragPreview({
        treeId: mindmapNode.id,
        nodeId,
        ghost: rect
      })
    },
    [getWorldPoint, mindmapNode.id, mindmapNode.position.x, mindmapNode.position.y, nodeRects, tree]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rootDrag = rootDragRef.current
      if (rootDrag && rootDrag.pointerId === event.pointerId) {
        event.preventDefault()
        const world = getWorldPoint(event)
        const dx = world.x - rootDrag.start.x
        const dy = world.y - rootDrag.start.y
        setNodeOffset({ x: rootDrag.origin.x + dx, y: rootDrag.origin.y + dy })
        return
      }
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      const world = getWorldPoint(event)
      const ghost = {
        x: world.x - drag.offset.x,
        y: world.y - drag.offset.y,
        width: drag.rect.width,
        height: drag.rect.height
      }
      const drop = computeDropTarget({
        tree,
        nodeRects,
        ghost,
        drag,
        layoutOptions: layout.options
      })
      setDragPreview({
        treeId: mindmapNode.id,
        nodeId: drag.nodeId,
        ghost,
        drop
      })
    },
    [getWorldPoint, layout.options, mindmapNode.id, nodeRects, tree]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rootDrag = rootDragRef.current
      if (rootDrag && rootDrag.pointerId === event.pointerId) {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.releasePointerCapture(event.pointerId)
        rootDragRef.current = null
        commitNodeOffset(mindmapNode, core, nodeOffset)
        return
      }
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.releasePointerCapture(event.pointerId)
      const drop = dragPreview?.drop
      if (drop && drop.parentId) {
        const shouldMove =
          drop.parentId !== drag.originParentId || drop.index !== drag.originIndex || drop.side !== undefined
        if (shouldMove) {
          const layoutHint = {
            nodeSize,
            mode: layout.mode,
            options: layout.options,
            anchorId: drop.parentId
          }
          void core.dispatch({
            type: 'mindmap.moveSubtree',
            id: mindmapNode.id,
            nodeId: drag.nodeId,
            newParentId: drop.parentId,
            options: { index: drop.index, side: drop.side, layout: layoutHint }
          })
        }
      }
      dragRef.current = null
      setDragPreview(null)
    },
    [core, dragPreview?.drop, layout.mode, layout.options, mindmapNode, nodeOffset, nodeSize, tree]
  )

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rootDrag = rootDragRef.current
    if (rootDrag && rootDrag.pointerId === event.pointerId) {
      event.preventDefault()
      rootDragRef.current = null
      return
    }
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    dragRef.current = null
    setDragPreview(null)
  }, [])

  return (
    <div style={{ position: 'absolute', left: baseOffset.x, top: baseOffset.y }}>
      <svg
        width={computed.bbox.width}
        height={computed.bbox.height}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        {lines.map((line) => (
          <line
            key={line.id}
            x1={line.x1 + shiftX}
            y1={line.y1 + shiftY}
            x2={line.x2 + shiftX}
            y2={line.y2 + shiftY}
            stroke="#2f2f33"
            strokeWidth={2}
            style={{ transition: dragPreview ? 'none' : 'all 160ms ease' }}
          />
        ))}
      </svg>
      {Object.entries(computed.node).map(([id, rect]) => {
        const node = tree.nodes[id]
        const label = getMindmapLabel(node)
        const dragActive = dragPreview?.nodeId === id
        const attachTarget = dragPreview?.drop?.type === 'attach' && dragPreview.drop.targetId === id
        return (
          <div
            key={id}
            data-mindmap-node-id={id}
            onPointerDown={(event) => handlePointerDown(event, id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerEnter={() => setHoveredId(id)}
            onPointerLeave={() => setHoveredId((prev) => (prev === id ? undefined : prev))}
            style={{
              position: 'absolute',
              left: rect.x + shiftX,
              top: rect.y + shiftY,
              width: rect.width,
              height: rect.height,
              borderRadius: 12,
              border: attachTarget ? '2px solid #2563eb' : '1px solid #111',
              background: '#fef7e8',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#2f2f33',
              userSelect: 'none',
              opacity: dragActive ? 0.35 : 1,
              transition: dragPreview ? 'none' : 'transform 160ms ease, opacity 160ms ease'
            }}
          >
            <div style={{ padding: '0 12px', textAlign: 'center', pointerEvents: 'none' }}>{label}</div>
            {!dragPreview && hoveredId === id && (
              <>
                <AddButton placement="up" onClick={() => handleAddChild(id, 'up')} />
                <AddButton placement="down" onClick={() => handleAddChild(id, 'down')} />
                <AddButton placement="left" onClick={() => handleAddChild(id, 'left')} />
                <AddButton placement="right" onClick={() => handleAddChild(id, 'right')} />
              </>
            )}
          </div>
        )
      })}
      {dragPreview && (
        <>
          <svg
            width={computed.bbox.width}
            height={computed.bbox.height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
          >
            {dragPreview.drop?.connectionLine && (
              <line
                x1={dragPreview.drop.connectionLine.x1 - baseOffset.x}
                y1={dragPreview.drop.connectionLine.y1 - baseOffset.y}
                x2={dragPreview.drop.connectionLine.x2 - baseOffset.x}
                y2={dragPreview.drop.connectionLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {dragPreview.drop?.insertLine && (
              <line
                x1={dragPreview.drop.insertLine.x1 - baseOffset.x}
                y1={dragPreview.drop.insertLine.y1 - baseOffset.y}
                x2={dragPreview.drop.insertLine.x2 - baseOffset.x}
                y2={dragPreview.drop.insertLine.y2 - baseOffset.y}
                stroke="#2563eb"
                strokeWidth={2}
              />
            )}
          </svg>
          <div
            style={{
              position: 'absolute',
              left: dragPreview.ghost.x - baseOffset.x,
              top: dragPreview.ghost.y - baseOffset.y,
              width: dragPreview.ghost.width,
              height: dragPreview.ghost.height,
              borderRadius: 12,
              border: '1px dashed #2563eb',
              background: 'rgba(59, 130, 246, 0.08)',
              pointerEvents: 'none'
            }}
          />
        </>
      )}
    </div>
  )
}

type MindmapLayerProps = {
  nodes: Node[]
  nodeSize: Size
  layout: MindmapLayoutConfig
  core: Core
  screenToWorld: (point: Point) => Point
  containerRef?: RefObject<HTMLElement>
}

export const MindmapLayer = ({ nodes, nodeSize, layout, core, screenToWorld, containerRef }: MindmapLayerProps) => {
  const mindmapNodes = useMemo(() => nodes.filter((node) => node.type === 'mindmap'), [nodes])
  return (
    <>
      {mindmapNodes.map((node) => {
        const tree = getMindmapTree(node)
        if (!tree) return null
        return (
          <MindmapTreeView
            key={node.id}
            tree={tree}
            mindmapNode={node}
            nodeSize={nodeSize}
            layout={layout}
            core={core}
            screenToWorld={screenToWorld}
            containerRef={containerRef}
          />
        )
      })}
    </>
  )
}

const getMindmapTree = (node: Node): MindmapTree | undefined => {
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return
  const direct = data as unknown as MindmapTree
  if (direct && typeof direct.rootId === 'string' && typeof direct.nodes === 'object' && typeof direct.children === 'object') {
    return direct
  }
  const nested = data.mindmap as MindmapTree | undefined
  if (nested && typeof nested.rootId === 'string') return nested
  const legacy = data.tree as MindmapTree | undefined
  if (legacy && typeof legacy.rootId === 'string') return legacy
  return
}

const commitNodeOffset = (mindmapNode: Node, core: Core, position: Point) => {
  if (Math.abs(mindmapNode.position.x - position.x) < 0.5 && Math.abs(mindmapNode.position.y - position.y) < 0.5) {
    return
  }
  void core.dispatch({
    type: 'node.update',
    id: mindmapNode.id,
    patch: { position: { x: position.x, y: position.y } }
  })
}

const AddButton = ({ placement, onClick }: { placement: 'up' | 'down' | 'left' | 'right'; onClick: () => void }) => {
  const base: CSSProperties = {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    background: '#ffffff',
    border: '1px solid #cbd5f5',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.15)',
    cursor: 'pointer'
  }
  const style =
    placement === 'up'
      ? { ...base, left: '50%', top: -10, transform: 'translate(-50%, -50%)' }
      : placement === 'down'
        ? { ...base, left: '50%', bottom: -10, transform: 'translate(-50%, 50%)' }
        : placement === 'left'
          ? { ...base, left: -10, top: '50%', transform: 'translate(-50%, -50%)' }
          : { ...base, right: -10, top: '50%', transform: 'translate(50%, -50%)' }
  return (
    <div
      style={style}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      +
    </div>
  )
}

const getNodeSide = (tree: MindmapTree, nodeId: MindmapNodeId) => getSide(tree, nodeId) ?? 'right'

const getRootSide = (
  options: MindmapLayoutOptions | undefined,
  rootRect: Rect,
  pointer: Point,
  preferred?: 'left' | 'right'
): 'left' | 'right' => {
  const mode = options?.side
  if (mode === 'left' || mode === 'right') return mode
  if (preferred) return preferred
  const centerX = rootRect.x + rootRect.width / 2
  return pointer.x < centerX ? 'left' : 'right'
}

const mapSideIndexToGlobalIndex = (
  tree: MindmapTree,
  children: MindmapNodeId[],
  side: 'left' | 'right',
  sideIndex: number
) => {
  const sideChildren = children.filter((id) => getNodeSide(tree, id) === side)
  if (sideChildren.length === 0) return children.length
  if (sideIndex <= 0) return children.indexOf(sideChildren[0])
  if (sideIndex >= sideChildren.length) {
    return children.indexOf(sideChildren[sideChildren.length - 1]) + 1
  }
  return children.indexOf(sideChildren[sideIndex])
}

const computeEdgeAlignment = (ghost: Rect, target: Rect) => {
  const ghostCenterX = ghost.x + ghost.width / 2
  const ghostCenterY = ghost.y + ghost.height / 2
  const targetCenterX = target.x + target.width / 2
  const targetCenterY = target.y + target.height / 2
  const dx = ghostCenterX - targetCenterX
  const dy = ghostCenterY - targetCenterY
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    const gap = Math.max(0, Math.abs(dx) - (ghost.width + target.width) / 2)
    if (dx >= 0) {
      return {
        key: 'left-to-right' as const,
        value: gap,
        line: {
          x1: ghost.x,
          y1: ghostCenterY,
          x2: target.x + target.width,
          y2: targetCenterY
        }
      }
    }
    return {
      key: 'right-to-left' as const,
      value: gap,
      line: {
        x1: ghost.x + ghost.width,
        y1: ghostCenterY,
        x2: target.x,
        y2: targetCenterY
      }
    }
  }
  const gap = Math.max(0, Math.abs(dy) - (ghost.height + target.height) / 2)
  if (dy >= 0) {
    return {
      key: 'top-to-bottom' as const,
      value: gap,
      line: {
        x1: ghostCenterX,
        y1: ghost.y,
        x2: targetCenterX,
        y2: target.y + target.height
      }
    }
  }
  return {
    key: 'bottom-to-top' as const,
    value: gap,
    line: {
      x1: ghostCenterX,
      y1: ghost.y + ghost.height,
      x2: targetCenterX,
      y2: target.y
    }
  }
}

const computeStaticConnectionLine = (
  parent: { x: number; y: number; width: number; height: number },
  child: { x: number; y: number; width: number; height: number },
  side?: 'left' | 'right'
) => {
  const parentCenterX = parent.x + parent.width / 2
  const parentCenterY = parent.y + parent.height / 2
  const childCenterY = child.y + child.height / 2
  if (side === 'left') {
    return {
      x1: parent.x,
      y1: parentCenterY,
      x2: child.x + child.width,
      y2: childCenterY
    }
  }
  if (side === 'right') {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  const childCenterX = child.x + child.width / 2
  if (childCenterX >= parentCenterX) {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  return {
    x1: parent.x,
    y1: parentCenterY,
    x2: child.x + child.width,
    y2: childCenterY
  }
}

const getMindmapLabel = (node: MindmapNode | undefined) => {
  if (!node?.data || typeof node.data !== 'object' || !('kind' in node.data)) return 'mindmap'
  const data = node.data as { kind: string; text?: string; name?: string; title?: string; url?: string }
  switch (data.kind) {
    case 'text':
      return data.text?.trim() ? data.text : 'Text'
    case 'file':
      return data.name?.trim() ? data.name : 'File'
    case 'link':
      return data.title?.trim() ? data.title : data.url ?? 'Link'
    case 'ref':
      return data.title?.trim() ? data.title : 'Ref'
    default:
      return data.kind ?? 'mindmap'
  }
}

const EDGE_SNAP_THRESHOLD = 24

const computeDropTarget = ({
  tree,
  nodeRects,
  ghost,
  drag,
  layoutOptions
}: {
  tree: MindmapTree
  nodeRects: Map<MindmapNodeId, Rect>
  ghost: Rect
  drag: DragRef
  layoutOptions?: MindmapLayoutOptions
}): DropTarget | undefined => {
  let hoveredId: MindmapNodeId | undefined
  let hoveredRect: Rect | undefined
  let hoveredAlign: ReturnType<typeof computeEdgeAlignment> | undefined
  let hoveredDistance = Number.POSITIVE_INFINITY
  nodeRects.forEach((rect, id) => {
    if (drag.excludeIds.has(id)) return
    const alignment = computeEdgeAlignment(ghost, rect)
    if (alignment.value < hoveredDistance) {
      hoveredDistance = alignment.value
      hoveredId = id
      hoveredRect = rect
      hoveredAlign = alignment
    }
  })
  if (!hoveredId || !hoveredRect || !hoveredAlign) return
  if (hoveredDistance > EDGE_SNAP_THRESHOLD) return
  const rootRect = nodeRects.get(tree.rootId)
  if (!rootRect) return
  const ghostCenter = { x: ghost.x + ghost.width / 2, y: ghost.y + ghost.height / 2 }
  const isHorizontal = hoveredAlign.key === 'left-to-right' || hoveredAlign.key === 'right-to-left'
  const isAttach = hoveredId === tree.rootId || isHorizontal

  if (isAttach) {
    const parentId = hoveredId
    const filteredChildren =
      parentId === drag.originParentId
        ? (tree.children[parentId] ?? []).filter((id) => id !== drag.nodeId)
        : (tree.children[parentId] ?? [])
    const side = parentId === tree.rootId ? getRootSide(layoutOptions, rootRect, ghostCenter) : undefined
    const index =
      parentId === tree.rootId && side
        ? mapSideIndexToGlobalIndex(tree, filteredChildren, side, filteredChildren.length)
        : filteredChildren.length
    const connectionLine = hoveredAlign.line
    return {
      type: 'attach',
      parentId,
      index,
      side,
      targetId: hoveredId,
      connectionLine
    }
  }

  const parentId = tree.nodes[hoveredId]?.parentId
  if (!parentId) return
  const filteredChildren =
    parentId === drag.originParentId
      ? (tree.children[parentId] ?? []).filter((id) => id !== drag.nodeId)
      : (tree.children[parentId] ?? [])
  const targetIndex = filteredChildren.indexOf(hoveredId)
  if (targetIndex < 0) return
  const before = ghostCenter.y < hoveredRect.y + hoveredRect.height / 2
  const side =
    parentId === tree.rootId
      ? getRootSide(layoutOptions, rootRect, ghostCenter, tree.nodes[hoveredId]?.side)
      : undefined
  const index =
    parentId === tree.rootId && side
      ? mapSideIndexToGlobalIndex(tree, filteredChildren, side, before ? targetIndex : targetIndex + 1)
      : before
        ? targetIndex
        : targetIndex + 1
  const lineY = before ? hoveredRect.y - 6 : hoveredRect.y + hoveredRect.height + 6
  return {
    type: 'reorder',
    parentId,
    index,
    side,
    targetId: hoveredId,
    insertLine: {
      x1: hoveredRect.x - 12,
      y1: lineY,
      x2: hoveredRect.x + hoveredRect.width + 12,
      y2: lineY
    }
  }
}
