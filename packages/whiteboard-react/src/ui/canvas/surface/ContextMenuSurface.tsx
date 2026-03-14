import { useCallback, useEffect, useRef } from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import { ContextMenuSectionView } from '../../chrome/context-menu/sections/ContextMenuSectionView'
import type { ContextMenuItem } from '../../chrome/context-menu/types'
import type { SurfaceView } from '../../../runtime/view'

export const ContextMenuSurface = ({
  view
}: {
  view?: SurfaceView['contextMenu']
}) => {
  const instance = useInternalInstance()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!view) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      instance.commands.surface.closeContextMenu('dismiss')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      instance.commands.surface.closeContextMenu('dismiss')
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [instance, view])

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled) return
    item.run({
      instance,
      close: () => {
        instance.commands.surface.closeContextMenu('action')
      }
    })
  }, [instance])

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
          <ContextMenuSectionView
            key={section.key}
            section={section}
            onItemClick={handleItemClick}
          />
        ))}
      </div>
    </div>
  )
}
