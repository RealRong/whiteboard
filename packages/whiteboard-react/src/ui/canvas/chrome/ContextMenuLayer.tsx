import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  ContextMenuItem,
  ContextMenuSession
} from '../../context-menu/types'
import { readContextMenu } from '../../context-menu/read'
import { useInstance } from '../../../runtime/hooks'

export const ContextMenuLayer = ({
  session,
  closeContextMenu,
  containerWidth,
  containerHeight
}: {
  session: ContextMenuSession
  closeContextMenu: (mode: 'dismiss' | 'action') => void
  containerWidth: number
  containerHeight: number
}) => {
  const instance = useInstance()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const view = useMemo(
    () => readContextMenu({
      instance,
      session,
      containerWidth,
      containerHeight
    }),
    [containerHeight, containerWidth, instance, session]
  )

  useEffect(() => {
    if (!view) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      closeContextMenu('dismiss')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeContextMenu('dismiss')
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeContextMenu, view])

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled) return
    item.run({
      instance,
      close: () => {
        closeContextMenu('action')
      }
    })
  }, [closeContextMenu, instance])

  if (!view) return null

  return (
    <div className="wb-context-menu-layer" ref={rootRef} data-context-menu-ignore>
      <div
        className="wb-context-menu"
        style={view.placement}
        data-context-menu-ignore
        data-selection-ignore
        data-input-ignore
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
      >
        {view.sections.map((section) => (
          <div key={section.key} className="wb-context-menu-section">
            {section.title ? (
              <div className="wb-context-menu-section-title">{section.title}</div>
            ) : null}
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className="wb-context-menu-item"
                data-tone={item.tone === 'danger' ? 'danger' : undefined}
                disabled={item.disabled}
                data-context-menu-item={item.key}
                onClick={() => {
                  if (item.disabled) return
                  handleItemClick(item)
                }}
                data-context-menu-ignore
                data-selection-ignore
                data-input-ignore
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
