import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import { useInstance, useInteraction, useSelection, useTool } from '../../../runtime/hooks'
import { buildToolbarMenuStyle, buildToolbarStyle } from '../../node-toolbar/layout'
import { toolbarItemDefinitions } from '../../node-toolbar/items'
import { useNodeToolbar } from '../../node-toolbar/model'
import type { NodeToolbarItemKey, NodeToolbarMenuKey } from '../../node-toolbar/types'

const isToolbarMenuKey = (
  key: NodeToolbarItemKey
): key is NodeToolbarMenuKey => key !== 'lock'

const readMenuAnchor = ({
  container,
  button
}: {
  container: HTMLDivElement | null
  button: HTMLButtonElement | null | undefined
}) => {
  if (!container || !button) return undefined

  const rect = button.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    top: rect.top - containerRect.top,
    bottom: rect.bottom - containerRect.top,
    centerX: rect.left - containerRect.left + rect.width / 2
  }
}

export const NodeToolbarLayer = ({
  containerRef,
  containerWidth,
  containerHeight
}: {
  containerRef: RefObject<HTMLDivElement | null>
  containerWidth: number
  containerHeight: number
}) => {
  const instance = useInstance()
  const tool = useTool()
  const interaction = useInteraction()
  const selection = useSelection()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<NodeToolbarMenuKey, HTMLButtonElement | null>>>({})
  const [activeMenuKey, setActiveMenuKey] = useState<NodeToolbarMenuKey | null>(null)
  const closeMenu = useCallback(() => {
    setActiveMenuKey(null)
  }, [])
  const toolbar = useNodeToolbar()
  const showNodeToolbar =
    tool === 'select'
    && interaction === 'idle'
    && selection.target.edgeId === undefined
    && selection.items.count > 0

  useEffect(() => {
    closeMenu()
  }, [
    closeMenu,
    toolbar?.placement,
    toolbar?.anchor.x,
    toolbar?.anchor.y,
    toolbar?.nodes
  ])

  useEffect(() => {
    if (!showNodeToolbar) {
      closeMenu()
    }
  }, [closeMenu, showNodeToolbar])

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
  }, [])

  if (!showNodeToolbar || !toolbar) return null

  const toolbarStyle = buildToolbarStyle({
    placement: toolbar.placement,
    x: toolbar.anchor.x,
    y: toolbar.placement === 'top' ? toolbar.anchor.y - 12 : toolbar.anchor.y + 12,
    containerWidth,
    itemCount: toolbar.items.length
  })

  const activeMenuAnchor = activeMenuKey
    ? readMenuAnchor({
        container: containerRef.current,
        button: buttonRefByKey.current[activeMenuKey]
      })
    : undefined
  const activeMenuDefinition = activeMenuKey
    ? toolbarItemDefinitions[activeMenuKey]
    : undefined
  const menuStyle = activeMenuAnchor
    ? buildToolbarMenuStyle({
        anchor: activeMenuAnchor,
        containerWidth,
        containerHeight
      })
    : undefined

  const actionContext = {
    instance,
    nodes: toolbar.nodes,
    primaryNode: toolbar.primaryNode,
    primarySchema: toolbar.primarySchema,
    close: closeMenu
  }

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
          const definition = toolbarItemDefinitions[item.key]
          const active = item.active || activeMenuKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              className="wb-node-toolbar-button"
              data-active={active ? 'true' : undefined}
              title={item.label}
              ref={(element) => {
                if (isToolbarMenuKey(item.key) && definition.renderMenu) {
                  buttonRefByKey.current[item.key] = element
                }
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                if (definition.run) {
                  definition.run(actionContext, item.active)
                  closeMenu()
                  return
                }
                if (!isToolbarMenuKey(item.key) || !definition.renderMenu) return
                const menuKey = item.key
                setActiveMenuKey((current) => current === menuKey ? null : menuKey)
              }}
            >
              {definition.icon}
            </button>
          )
        })}
      </div>
      {activeMenuDefinition?.renderMenu && menuStyle ? (
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
          {activeMenuDefinition.renderMenu(actionContext)}
        </div>
      ) : null}
    </div>
  )
}
