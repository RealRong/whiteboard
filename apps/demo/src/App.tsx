import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Whiteboard, type WhiteboardInstance } from '@whiteboard/react'
import type { Document, NodeInput } from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import { scenarios } from './scenarios'

const resolveScenario = (id: string) =>
  scenarios.find((item) => item.id === id) ?? scenarios[0]

const INSERTABLE_NODES: Array<{
  type: NodeInput['type']
  label: string
  size: NonNullable<NodeInput['size']>
  data?: Record<string, unknown>
}> = [
  {
    type: 'ellipse',
    label: '椭圆',
    size: { width: 200, height: 130 },
    data: { title: 'Ellipse' }
  },
  {
    type: 'diamond',
    label: '菱形',
    size: { width: 180, height: 180 },
    data: { title: 'Decision' }
  },
  {
    type: 'triangle',
    label: '三角形',
    size: { width: 190, height: 160 },
    data: { title: 'Triangle' }
  },
  {
    type: 'arrow-sticker',
    label: '箭头',
    size: { width: 220, height: 120 },
    data: { title: 'Arrow' }
  },
  {
    type: 'callout',
    label: '气泡',
    size: { width: 280, height: 160 },
    data: { text: 'Callout' }
  },
  {
    type: 'highlight',
    label: '高亮',
    size: { width: 240, height: 110 },
    data: { text: 'Highlight' }
  }
]

export const App = () => {
  const [activeId, setActiveId] = useState(scenarios[0].id)
  const [doc, setDoc] = useState<Document>(() => resolveScenario(activeId).create())
  const instanceRef = useRef<WhiteboardInstance | null>(null)
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  const insertCountRef = useRef(0)

  const onDocumentChange = useCallback((next: Document) => {
    setDoc(next)
  }, [])

  const stats = useMemo(() => {
    const nodeCount = doc.nodes.order.length
    const edgeCount = doc.edges.order.length
    const mindmapCount = doc.nodes.order.filter((id) => doc.nodes.entities[id]?.type === 'mindmap').length
    return { nodeCount, edgeCount, mindmapCount }
  }, [doc])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance) return
    insertCountRef.current = 0
    instance.commands.viewport.reset()
    instance.commands.selection.clear()
  }, [activeId])

  const handleSelect = (id: string) => {
    const scenario = resolveScenario(id)
    setActiveId(scenario.id)
    setDoc(scenario.create())
  }

  const handleBoardPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 2) return
      const instance = instanceRef.current
      if (!instance) return
      panRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore capture errors
      }
      event.preventDefault()
    },
    []
  )

  const handleBoardPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = panRef.current
      if (!pan || pan.pointerId !== event.pointerId) return
      const instance = instanceRef.current
      if (!instance) return
      const deltaX = event.clientX - pan.lastX
      const deltaY = event.clientY - pan.lastY
      if (deltaX === 0 && deltaY === 0) return
      pan.lastX = event.clientX
      pan.lastY = event.clientY
      const zoom = instance.viewport.get().zoom
      if (!Number.isFinite(zoom) || zoom <= 0) return
      instance.commands.viewport.panBy({
        x: -deltaX / zoom,
        y: -deltaY / zoom
      })
      event.preventDefault()
    },
    []
  )

  const stopPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    panRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore capture errors
    }
    event.preventDefault()
  }, [])

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleInsertNode = useCallback((
    template: typeof INSERTABLE_NODES[number]
  ) => {
    const instance = instanceRef.current
    if (!instance) return

    const index = insertCountRef.current
    insertCountRef.current += 1

    const column = index % 3
    const row = Math.floor(index / 3) % 3
    const offsetX = (column - 1) * 42
    const offsetY = (row - 1) * 34
    const center = instance.viewport.get().center
    const parentId = instance.state.container.get().id
    const id = createId('demo-node')
    const payload: NodeInput = {
      id,
      type: template.type,
      position: {
        x: center.x - template.size.width / 2 + offsetX,
        y: center.y - template.size.height / 2 + offsetY
      },
      size: template.size,
      data: template.data,
      parentId
    }

    const result = instance.commands.node.create(payload)
    if (!result.ok) return

    instance.commands.selection.replace([id])
  }, [])

  return (
    <div className="demo-root">
      <aside className="demo-menu">
        <div className="demo-menu-header">
          <div className="demo-title">Whiteboard Demo</div>
          <div className="demo-subtitle">左上角切换场景</div>
        </div>
        <div className="demo-menu-list">
          {scenarios.map((scenario) => {
            const active = scenario.id === activeId
            return (
              <button
                key={scenario.id}
                className={active ? 'demo-menu-item active' : 'demo-menu-item'}
                onClick={() => handleSelect(scenario.id)}
              >
                <div className="demo-menu-item-title">{scenario.label}</div>
                <div className="demo-menu-item-desc">{scenario.description}</div>
              </button>
            )
          })}
        </div>
        <div className="demo-insert-panel">
          <div className="demo-insert-title">插入图形</div>
          <div className="demo-insert-grid">
            {INSERTABLE_NODES.map((item) => (
              <button
                key={item.type}
                className="demo-insert-item"
                onClick={() => {
                  handleInsertNode(item)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-menu-footer">
          <div>节点: {stats.nodeCount}</div>
          <div>连线: {stats.edgeCount}</div>
          <div>思维导图: {stats.mindmapCount}</div>
          <div className="demo-menu-hint">触控板两指平移 / 捏合缩放，右键拖拽平移</div>
        </div>
      </aside>
      <div
        className="demo-board"
        onPointerDownCapture={handleBoardPointerDownCapture}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
        onContextMenu={handleContextMenu}
      >
        <Whiteboard
          ref={instanceRef}
          document={doc}
          onDocumentChange={onDocumentChange}
          options={{
            className: 'wb-theme-notion',
            style: { width: '100%', height: '100%' },
            tool: 'select',
            mindmapLayout: { mode: 'simple' }
          }}
        />
      </div>
    </div>
  )
}
