import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import type { Point } from '@whiteboard/core/types'
import {
  useElementSize,
  useInternalInstance,
  useStoreValue
} from '../../../runtime/hooks'
import { useSelectionPresentation } from '../../node/selection'
import {
  buildToolbarMenuStyle,
  buildToolbarStyle,
  readMenuAnchor,
  type ToolbarItemKey
} from './layout'
import { resolveNodeMeta } from '../../node/registry'
import { FillMenu } from './menus/FillMenu'
import { LayoutMenu } from './menus/LayoutMenu'
import { MoreMenu } from './menus/MoreMenu'
import { DRAW_STROKE_WIDTHS } from './menus/options'
import { StrokeMenu } from './menus/StrokeMenu'
import { TextMenu } from './menus/TextMenu'
import {
  resolveSelectionFilter,
  resolveSelectionLayoutActions,
  resolveSelectionMoreMenuSections,
  type SelectionLayoutActions,
  type SelectionMenuFilter
} from './selectionMenu'
import { ToolbarIcon } from './nodeToolbarIcon'
import { resolveNodeToolbarModel } from './nodeToolbarModel'
import {
  commitNodeToolbarText,
  updateNodeToolbarTextFontSize
} from './nodeToolbarText'

type ToolbarMenuKey = ToolbarItemKey

export const NodeToolbar = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const surface = useElementSize(containerRef)
  const viewport = useStoreValue(instance.viewport)
  const presentation = useSelectionPresentation()
  const selection = presentation.selection
  const worldToScreen = useCallback(
    (point: Point) => instance.viewport.worldToScreen(point),
    [instance, viewport.center.x, viewport.center.y, viewport.zoom]
  )
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRefByKey = useRef<Partial<Record<ToolbarMenuKey, HTMLButtonElement | null>>>({})
  const [activeMenuKey, setActiveMenuKey] = useState<ToolbarMenuKey | null>(null)
  const closeMenu = useCallback(() => {
    setActiveMenuKey(null)
  }, [])
  const toolbar = resolveNodeToolbarModel({
    instance,
    selection,
    worldToScreen
  })

  const showsNodeToolbar = presentation.showToolbar

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
    if (!showsNodeToolbar) {
      closeMenu()
    }
  }, [closeMenu, showsNodeToolbar])

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

  if (!showsNodeToolbar || !toolbar) return null

  const toolbarStyle = buildToolbarStyle({
    placement: toolbar.placement,
    x: toolbar.anchor.x,
    y: toolbar.placement === 'top' ? toolbar.anchor.y - 12 : toolbar.anchor.y + 12,
    containerWidth: surface.width,
    itemCount: toolbar.items.length
  })

  const activeMenuAnchor = activeMenuKey
    ? readMenuAnchor({
        container: containerRef.current,
        button: buttonRefByKey.current[activeMenuKey]
      })
    : undefined
  const menuStyle = activeMenuAnchor
    ? buildToolbarMenuStyle({
        anchor: activeMenuAnchor,
        containerWidth: surface.width,
        containerHeight: surface.height
      })
    : undefined

  const layoutActions: SelectionLayoutActions = resolveSelectionLayoutActions({
    instance,
    nodes: toolbar.nodes,
    can: toolbar.can,
    close: closeMenu
  })
  const filter: SelectionMenuFilter | undefined = resolveSelectionFilter({
    instance,
    nodes: toolbar.nodes,
    summary: toolbar.summary,
    can: toolbar.can,
    resolveMeta: (node) => resolveNodeMeta(instance.host.registry, node),
    close: closeMenu
  })
  const moreSections = resolveSelectionMoreMenuSections({
    instance,
    nodes: toolbar.nodes,
    summary: toolbar.summary,
    can: toolbar.can,
    close: closeMenu
  })

  const renderMenu = () => {
    if (!activeMenuKey) return null

    switch (activeMenuKey) {
      case 'fill':
        return (
          <FillMenu
            value={toolbar.fillValue}
            onChange={(value) => {
              instance.commands.node.appearance.setFill(
                toolbar.nodes.map((node) => node.id),
                value
              )
            }}
          />
        )
      case 'stroke':
        return (
          <StrokeMenu
            widths={toolbar.drawOnlyStrokeMenu ? DRAW_STROKE_WIDTHS : undefined}
            stroke={toolbar.strokeValue}
            strokeWidth={toolbar.strokeWidthValue}
            opacity={toolbar.strokeOpacityValue}
            onStrokeChange={(value) => {
              instance.commands.node.appearance.setStroke(
                toolbar.nodes.map((node) => node.id),
                value
              )
            }}
            onStrokeWidthChange={(value) => {
              instance.commands.node.appearance.setStrokeWidth(
                toolbar.nodes.map((node) => node.id),
                value
              )
            }}
            onOpacityChange={toolbar.showStrokeOpacitySection ? (value) => {
              instance.commands.node.appearance.setOpacity(
                toolbar.nodes.map((node) => node.id),
                value
              )
            } : undefined}
          />
        )
      case 'text':
        return (
          <TextMenu
            value={toolbar.textValue}
            color={toolbar.textColor}
            fontSize={toolbar.textFontSize}
            showText={toolbar.showTextSection}
            showColor={toolbar.showTextColorSection}
            showFontSize={toolbar.showTextFontSizeSection}
            onTextCommit={toolbar.showTextSection ? (value) => {
              commitNodeToolbarText({
                instance,
                container: containerRef.current,
                node: toolbar.primaryNode,
                field: toolbar.textFieldKey,
                value
              })
            } : undefined}
            onColorChange={toolbar.showTextColorSection ? (value) => {
              instance.commands.node.text.setColor(
                [toolbar.primaryNode.id],
                value
              )
            } : undefined}
            onFontSizeChange={toolbar.showTextFontSizeSection ? (value) => {
              updateNodeToolbarTextFontSize({
                instance,
                container: containerRef.current,
                node: toolbar.primaryNode,
                field: toolbar.textFieldKey,
                value
              })
            } : undefined}
          />
        )
      case 'layout':
        return (
          <LayoutMenu
            canAlign={layoutActions.canAlign}
            canDistribute={layoutActions.canDistribute}
            onAlign={(mode) => {
              layoutActions.onAlign(mode)
            }}
            onDistribute={(mode) => {
              layoutActions.onDistribute(mode)
            }}
          />
        )
      case 'more':
        return (
          <MoreMenu
            summary={toolbar.nodes.length > 1
              ? toolbar.summary
              : undefined}
            filter={filter}
            sections={moreSections}
          />
        )
    }
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
          const active = item.active || activeMenuKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              className="wb-node-toolbar-button"
              data-active={active ? 'true' : undefined}
              title={item.label}
              ref={(element) => {
                buttonRefByKey.current[item.key] = element
              }}
              data-selection-ignore
              data-input-ignore
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={() => {
                setActiveMenuKey((current) => current === item.key ? null : item.key)
              }}
            >
              <ToolbarIcon itemKey={item.key} state={toolbar.iconState} />
            </button>
          )
        })}
      </div>
      {menuStyle && activeMenuKey ? (
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
          {renderMenu()}
        </div>
      ) : null}
    </div>
  )
}
