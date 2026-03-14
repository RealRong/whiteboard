import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject
} from 'react'
import type { CSSProperties } from 'react'
import { useInternalInstance } from '../common/hooks'
import { useInteractionView } from '../interaction/view'
import type { NodeToolbarMenuProps } from '../toolbar/model'
import type { NodeToolbarPlacement } from '../toolbar/view'
import type { NodeToolbarMenuKey } from '../toolbar/model'
import { ArrangeMenu } from '../toolbar/menus/ArrangeMenu'
import { FillMenu } from '../toolbar/menus/FillMenu'
import { GroupMenu } from '../toolbar/menus/GroupMenu'
import { MoreMenu } from '../toolbar/menus/MoreMenu'
import { StrokeMenu } from '../toolbar/menus/StrokeMenu'
import { TextMenu } from '../toolbar/menus/TextMenu'
import type { SurfaceView } from '../common/instance/view'

type MenuAnchor = {
  top: number
  bottom: number
  centerX: number
}

const SAFE_MARGIN = 12
const MENU_WIDTH = 220

const resolveHorizontalPosition = (
  centerX: number,
  containerWidth: number,
  estimatedWidth: number
) => {
  if (centerX <= estimatedWidth / 2 + SAFE_MARGIN) {
    return {
      left: SAFE_MARGIN,
      transform: ''
    }
  }
  if (centerX >= containerWidth - estimatedWidth / 2 - SAFE_MARGIN) {
    return {
      left: containerWidth - SAFE_MARGIN,
      transform: 'translateX(-100%)'
    }
  }
  return {
    left: centerX,
    transform: 'translateX(-50%)'
  }
}

const buildToolbarStyle = ({
  placement,
  x,
  y,
  containerWidth,
  itemCount
}: {
  placement: NodeToolbarPlacement
  x: number
  y: number
  containerWidth: number
  itemCount: number
}): CSSProperties => {
  const widthEstimate = Math.max(160, itemCount * 36 + 28)
  const horizontal = resolveHorizontalPosition(x, containerWidth, widthEstimate)
  return {
    left: horizontal.left,
    top: y,
    transform: [horizontal.transform, placement === 'top' ? 'translateY(-100%)' : 'translateY(0)']
      .filter(Boolean)
      .join(' ')
  }
}

const buildMenuStyle = ({
  anchor,
  containerWidth,
  containerHeight
}: {
  anchor: MenuAnchor
  containerWidth: number
  containerHeight: number
}): CSSProperties => {
  const horizontal = resolveHorizontalPosition(anchor.centerX, containerWidth, MENU_WIDTH)
  const placeBottom = containerHeight - anchor.bottom >= 240
  return {
    left: horizontal.left,
    top: placeBottom ? anchor.bottom + 8 : anchor.top - 8,
    transform: [horizontal.transform, placeBottom ? 'translateY(0)' : 'translateY(-100%)']
      .filter(Boolean)
      .join(' ')
  }
}

const renderMenu = (
  key: NodeToolbarMenuKey,
  props: NodeToolbarMenuProps
) => {
  switch (key) {
    case 'fill':
      return <FillMenu {...props} />
    case 'stroke':
      return <StrokeMenu {...props} />
    case 'text':
      return <TextMenu {...props} />
    case 'group':
      return <GroupMenu {...props} />
    case 'arrange':
      return <ArrangeMenu {...props} />
    case 'more':
      return <MoreMenu {...props} />
    default:
      return null
  }
}

export const NodeToolbarSurface = ({
  containerRef,
  view
}: {
  containerRef: RefObject<HTMLDivElement | null>
  view?: SurfaceView['toolbar']
}) => {
  const instance = useInternalInstance()
  const interaction = useInteractionView()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<NodeToolbarMenuKey, HTMLButtonElement | null>>>({})
  const closeMenu = useCallback(() => {
    instance.commands.surface.closeToolbarMenu()
  }, [instance])
  const toolbar = view?.value
  const activeMenuKey = view?.menuKey ?? null

  useEffect(() => {
    closeMenu()
  }, [
    closeMenu,
    toolbar?.placement,
    toolbar?.anchor.x,
    toolbar?.anchor.y,
    toolbar?.nodeIds
  ])

  useEffect(() => {
    if (!interaction.showNodeToolbar || !interaction.canOpenToolbarMenu) {
      closeMenu()
    }
  }, [closeMenu, interaction.canOpenToolbarMenu, interaction.showNodeToolbar])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) {
        return
      }
      closeMenu()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeMenu()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMenu])

  const container = containerRef.current
  const containerWidth = container?.clientWidth ?? 0
  const containerHeight = container?.clientHeight ?? 0

  const toolbarStyle = useMemo(() => {
    if (!toolbar) return undefined
    return buildToolbarStyle({
      placement: toolbar.placement,
      x: toolbar.anchor.x,
      y: toolbar.placement === 'top' ? toolbar.anchor.y - 12 : toolbar.anchor.y + 12,
      containerWidth,
      itemCount: toolbar.items.length
    })
  }, [containerWidth, toolbar])

  const activeItem = activeMenuKey
    ? toolbar?.items.find((item) => item.menuKey === activeMenuKey)
    : undefined
  const activeMenu = useMemo(() => {
    if (!activeMenuKey || !container) return undefined

    const button = buttonRefByKey.current[activeMenuKey]
    if (!button) return undefined

    const rect = button.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return {
      top: rect.top - containerRect.top,
      bottom: rect.bottom - containerRect.top,
      centerX: rect.left - containerRect.left + rect.width / 2
    }
  }, [activeMenuKey, container])

  const menuStyle = useMemo(() => {
    if (!activeMenu) return undefined
    return buildMenuStyle({
      anchor: activeMenu,
      containerWidth,
      containerHeight
    })
  }, [activeMenu, containerHeight, containerWidth])

  if (!interaction.showNodeToolbar || !toolbar || !toolbarStyle) return null

  const actionContext = {
    instance,
    nodes: toolbar.nodes,
    primaryNode: toolbar.primaryNode,
    primarySchema: toolbar.primarySchema,
    close: closeMenu
  }
  const activeMenuKeyValue = activeItem?.menuKey

  return (
    <div className="wb-node-toolbar-layer" ref={rootRef}>
      <div
        className="wb-node-toolbar"
        style={toolbarStyle}
        data-context-menu-ignore
        data-selection-ignore
        data-input-ignore
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
      >
        {toolbar.items.map((item) => {
          const active =
            item.active || activeMenuKey === item.menuKey
          return (
            <button
              key={item.key}
              type="button"
              className="wb-node-toolbar-button"
              data-active={active ? 'true' : undefined}
              title={item.label}
              ref={(element) => {
                if (item.menuKey) {
                  buttonRefByKey.current[item.menuKey] = element
                }
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                if (item.run) {
                  item.run(actionContext)
                  closeMenu()
                  return
                }
                if (!item.menuKey) return
                if (!interaction.canOpenToolbarMenu) return
                instance.commands.surface.toggleToolbarMenu(item.menuKey)
              }}
            >
              {item.icon}
            </button>
          )
        })}
      </div>
      {activeMenuKeyValue && menuStyle ? (
        <div
          className="wb-node-toolbar-menu"
          style={menuStyle}
          data-context-menu-ignore
          data-selection-ignore
          data-input-ignore
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
        >
          {renderMenu(activeMenuKeyValue, actionContext)}
        </div>
      ) : null}
    </div>
  )
}
