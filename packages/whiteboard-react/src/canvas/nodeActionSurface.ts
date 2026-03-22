import type {
  NodeActionItem,
  NodeSelectionActions
} from '../features/node/actions'
import type { NodeTypeSummary } from '../features/node/summary'
import type { MoreMenuSection } from './menus/MoreMenu'
import { closeAfter } from './actions'

export type NodeMenuItem = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onClick?: () => void
  children?: readonly NodeMenuItem[]
}

export type NodeMenuGroup = {
  key: string
  title?: string
  items: readonly NodeMenuItem[]
}

export type NodeMenuFilter = {
  types: readonly NodeTypeSummary[]
  onSelect: (type: string) => void
}

const bindNodeMenuItems = (
  items: readonly NodeMenuItem[],
  close: () => void
): NodeMenuItem[] => (
  items.map((item) => ({
    ...item,
    onClick: item.onClick
      ? () => {
        closeAfter(item.onClick?.(), close)
      }
      : undefined,
    children: item.children
      ? bindNodeMenuItems(item.children, close)
      : undefined
  }))
)

const toNodeMenuItems = (
  items: readonly NodeActionItem[]
): NodeMenuItem[] => (
  items.map((item) => ({
    key: item.key,
    label: item.label,
    tone: item.tone,
    disabled: item.disabled,
    onClick: item.onClick
  }))
)

export const bindNodeMenuGroup = (
  group: NodeMenuGroup,
  close: () => void
): NodeMenuGroup => ({
  ...group,
  items: bindNodeMenuItems(group.items, close)
})

export const readNodeMenuFilter = (
  actions: NodeSelectionActions,
  close: () => void
): NodeMenuFilter | undefined => {
  if (!actions.filter.visible) {
    return undefined
  }

  return {
    types: actions.filter.types,
    onSelect: (type) => {
      closeAfter(actions.filter.onSelect(type), close)
    }
  }
}

export const readNodeContextMenuGroups = (
  actions: NodeSelectionActions,
  close: () => void
): NodeMenuGroup[] => (
  actions.sections.map((section) => bindNodeMenuGroup(
    section.kind === 'submenu'
      ? {
          key: section.key,
          items: [
            {
              key: `${section.key}.menu`,
              label: section.title,
              children: toNodeMenuItems(section.items)
            }
          ]
        }
      : {
          key: section.key,
          title: section.title,
          items: toNodeMenuItems(section.items)
        },
    close
  ))
)

export const readNodeMoreMenuSections = (
  actions: NodeSelectionActions,
  close: () => void
): MoreMenuSection[] => (
  actions.sections
    .filter((section) => section.key !== 'layout')
    .map((section) => ({
      key: section.key,
      title: section.title,
      items: section.items.map((item) => ({
        ...item,
        onClick: () => {
          closeAfter(item.onClick(), close)
        }
      }))
    }))
)
