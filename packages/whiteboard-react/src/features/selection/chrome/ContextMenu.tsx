import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type {
  ContextMenuGroupView as EditorContextMenuGroupView,
  ContextMenuItemView as EditorContextMenuItemView
} from '@whiteboard/editor'
import {
  useElementSize,
  useEditor,
  useStoreValue
} from '../../../runtime/hooks'
import { useOverlayDismiss } from '../../../runtime/overlay/useOverlayDismiss'
import { isContextMenuIgnoredTarget } from '../../../canvas/domTargets'
import {
  SelectionSummaryHeader,
  SelectionTypeFilterStrip
} from '../../node/components/SelectionSummaryHeader'
import {
  isDuplicateMenuOpen,
  readContextMenuPlacement
} from './layout'

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
  item: EditorContextMenuItemView
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
        onClick={item.onSelect}
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
  group: EditorContextMenuGroupView
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
  const editor = useEditor()
  const surface = useElementSize(containerRef)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastOpenRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const view = useStoreValue(editor.read.context.menu)
  const [submenuKey, setSubmenuKey] = useState<string | null>(null)

  const dismiss = useCallback((mode: 'dismiss' | 'action') => {
    editor.commands.context.dismiss(mode)
    setSubmenuKey(null)
  }, [editor])

  useEffect(() => {
    setSubmenuKey(null)
  }, [view])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const openFromEvent = (
      source: 'secondary-press' | 'context-menu',
      event: Pick<MouseEvent | PointerEvent, 'target' | 'clientX' | 'clientY'>
    ) => {
      const pointer = editor.read.pick.from(event, container)
      const opened = editor.commands.context.open({
        source,
        pointer
      })
      if (!opened) {
        return false
      }

      setSubmenuKey(null)
      lastOpenRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      }
      return true
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return
      if (editor.host.interaction.busy.get()) return
      if (isContextMenuIgnoredTarget(event.target)) return

      event.preventDefault()
      event.stopPropagation()
      openFromEvent('secondary-press', event)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (editor.host.interaction.busy.get()) return
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

      openFromEvent('context-menu', event)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [containerRef, editor])

  useOverlayDismiss({
    enabled: view !== null,
    rootRef,
    onDismiss: () => {
      dismiss('dismiss')
    }
  })

  if (!view) return null

  const placement = readContextMenuPlacement({
    screen: view.screen,
    containerWidth: surface.width,
    containerHeight: surface.height
  })
  const menuStyle = {
    left: placement.left,
    top: placement.top,
    transform: placement.transform
  }
  const renderState: ContextMenuRenderState = {
    submenuKey,
    submenuSide: placement.submenuSide,
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
