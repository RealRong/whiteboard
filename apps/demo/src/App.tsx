import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { produce } from 'immer'
import { Whiteboard, type WhiteboardInstance } from '@whiteboard/react'
import type { Document } from '@whiteboard/core/types'
import { scenarios } from './scenarios'

const resolveScenario = (id: string) =>
  scenarios.find((item) => item.id === id) ?? scenarios[0]

export const App = () => {
  const [activeId, setActiveId] = useState(scenarios[0].id)
  const [doc, setDoc] = useState<Document>(() => resolveScenario(activeId).create())
  const instanceRef = useRef<WhiteboardInstance | null>(null)
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)

  const onDocChange = useCallback((recipe: (draft: Document) => void) => {
    setDoc((prev) => produce(prev, (draft) => recipe(draft)))
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
    instance.viewport.reset()
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
      instance.viewport.panBy({
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
          doc={doc}
          onDocChange={onDocChange}
          config={{
            style: { width: '100%', height: '100%' },
            tool: 'select',
            mindmapLayout: { mode: 'simple' }
          }}
        />
      </div>
    </div>
  )
}
