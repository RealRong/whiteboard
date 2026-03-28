import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Point } from '@whiteboard/core/types'
import {
  readContextMenuView,
  restoreContextMenuSelection,
  snapshotContextMenuSelection,
  type ContextMenuSelectionSnapshot
} from './contextMenuModel'
import {
  useElementSize,
  useInternalInstance
} from '../../../runtime/hooks'
import { isContextMenuIgnoredTarget } from '../../../runtime/input/target'
import {
  readContextOpen,
  resolveContextTarget,
  type ContextTarget
} from '../../../runtime/input/pointer'
import {
  SelectionSummaryHeader,
  SelectionTypeFilterStrip
} from '../../node/components/SelectionSummaryHeader'
import { resolveNodeMeta } from '../../node/registry'
import {
  type ContextMenuGroup,
  type ContextMenuItem
} from './contextMenuTypes'
import {
  isDuplicateMenuOpen,
  readContextMenuPlacement
} from './layout'

type ContextMenuSession = {
  screen: Point
  target: ContextTarget
  selection: ContextMenuSelectionSnapshot
} | null

type ContextMenuSide = 'left' | 'right'
type ContextMenuRenderState = {
  submenuKey: string | null
  submenuSide: ContextMenuSide
  openSubmenu: (key: string) => void
  clearSubmenu: () => void
}

const MenuIgnoreAttrs = {
  'data-context-menu-ignore': '',
  'data-selection-ignore': '',
  'data-input-ignore': ''
} as const

const ContextMenuItemView = ({
  item,
  state
}: {
  item: ContextMenuItem
  state: ContextMenuRenderState
}) => {
  const open = state.submenuKey === item.key
  const children = item.children?.length

  if (!children) {
    return (
      <button
        key={item.key}
        type="button"
        className="wb-context-menu-item"
        data-tone={item.tone === 'danger' ? 'danger' : undefined}
        disabled={item.disabled}
        data-context-menu-item={item.key}
        onClick={item.onClick}
        onPointerEnter={state.clearSubmenu}
        onFocus={state.clearSubmenu}
        {...MenuIgnoreAttrs}
      >
        <span>{item.label}</span>
      </button>
    )
  }

  return (
    <div
      key={item.key}
      className="wb-context-menu-item-shell"
      data-open={open ? 'true' : undefined}
      onPointerEnter={() => {
        state.openSubmenu(item.key)
      }}
      onFocus={() => {
        state.openSubmenu(item.key)
      }}
      data-context-menu-ignore
    >
      <button
        type="button"
        className="wb-context-menu-item"
        aria-haspopup="menu"
        aria-expanded={open}
        data-context-menu-item={item.key}
        {...MenuIgnoreAttrs}
      >
        <span>{item.label}</span>
        <span className="wb-context-menu-item-caret" aria-hidden="true">›</span>
      </button>
      {open ? (
        <div
          className="wb-context-submenu"
          data-side={state.submenuSide}
          {...MenuIgnoreAttrs}
        >
          {item.children?.map((child) => (
            <ContextMenuItemView
              key={child.key}
              item={child}
              state={state}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const ContextMenuGroupView = ({
  group,
  state
}: {
  group: ContextMenuGroup
  state: ContextMenuRenderState
}) => (
  <div className="wb-context-menu-section">
    {group.title ? (
      <div className="wb-context-menu-section-title">{group.title}</div>
    ) : null}
    {group.items.map((item) => (
      <ContextMenuItemView
        key={item.key}
        item={item}
        state={state}
      />
    ))}
  </div>
)

export const ContextMenu = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const surface = useElementSize(containerRef)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastOpenRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const [session, setSession] = useState<ContextMenuSession>(null)
  const [submenuKey, setSubmenuKey] = useState<string | null>(null)

  const dismiss = useCallback((mode: 'dismiss' | 'action') => {
    setSession((current) => {
      if (mode === 'dismiss' && current) {
        restoreContextMenuSelection(instance, current.selection)
      }
      return null
    })
    setSubmenuKey(null)
  }, [instance])

  const dismissAction = useCallback(() => {
    dismiss('action')
  }, [dismiss])

  const open = useCallback((result: {
    target: ContextTarget
    leaveFrame: boolean
    screen: Point
  }) => {
    if (result.leaveFrame) {
      instance.commands.frame.exit()
    }

    const selection = instance.read.selection.get()
    setSession({
      screen: result.screen,
      target: result.target,
      selection: snapshotContextMenuSelection(
        selection.target.nodeIds,
        selection.target.edgeIds
      )
    })
    setSubmenuKey(null)
  }, [instance])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const openFromEvent = (
      event: Pick<MouseEvent | PointerEvent, 'target' | 'clientX' | 'clientY'>
    ) => {
      const input = instance.read.pick.from(event, container)
      const result = readContextOpen(instance, input)
      if (!result) return

      lastOpenRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      }
      open({
        ...result,
        screen: input.point.screen
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return
      if (instance.interaction.busy.get()) return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      openFromEvent(event)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (instance.interaction.busy.get()) return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()

      if (isDuplicateMenuOpen(lastOpenRef.current, {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      })) {
        return
      }

      openFromEvent(event)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [containerRef, instance, open])

  const view = useMemo(() => {
    if (!session) return undefined

    const target = resolveContextTarget(instance, session.target)
    const menu = readContextMenuView({
      instance,
      target,
      close: dismissAction,
      resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
    })
    if (!menu) {
      return undefined
    }

    return {
      placement: readContextMenuPlacement({
        screen: session.screen,
        containerWidth: surface.width,
        containerHeight: surface.height
      }),
      summary: menu.summary,
      filter: menu.filter,
      groups: menu.groups
    }
  }, [dismissAction, instance, session, surface.height, surface.width])

  useEffect(() => {
    if (!view) return

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      dismiss('dismiss')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      dismiss('dismiss')
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dismiss, view])

  if (!view) return null

  const menuStyle = {
    left: view.placement.left,
    top: view.placement.top,
    transform: view.placement.transform
  }
  const renderState: ContextMenuRenderState = {
    submenuKey,
    submenuSide: view.placement.submenuSide,
    openSubmenu: (key) => {
      setSubmenuKey(key)
    },
    clearSubmenu: () => {
      setSubmenuKey(null)
    }
  }

  return (
    <div className="wb-context-menu-layer" ref={rootRef} data-context-menu-ignore>
      <div
        className="wb-context-menu"
        style={menuStyle}
        {...MenuIgnoreAttrs}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onPointerLeave={() => {
          renderState.clearSubmenu()
        }}
      >
        {view.summary ? (
          <SelectionSummaryHeader summary={view.summary} />
        ) : null}
        {view.filter ? (
          <div className="wb-context-menu-section">
            <div className="wb-context-menu-section-title">Filter</div>
            <SelectionTypeFilterStrip
              types={view.filter.types}
              onSelect={view.filter.onSelect}
            />
          </div>
        ) : null}
        {view.groups.map((group) => (
          <ContextMenuGroupView
            key={group.key}
            group={group}
            state={renderState}
          />
        ))}
      </div>
    </div>
  )
}
