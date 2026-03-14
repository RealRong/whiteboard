import type { Node } from '@whiteboard/core/types'
import type { ReactNode } from 'react'
import type { NodeToolbarMenuProps } from '../model'

export const mergeStyle = (
  current: Record<string, string | number> | undefined,
  patch: Record<string, string | number>
) => ({
  ...(current ?? {}),
  ...patch
})

export const mergeData = (
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
) => ({
  ...(current ?? {}),
  ...patch
})

export const updateNodesStyle = (
  instance: NodeToolbarMenuProps['instance'],
  nodes: readonly Node[],
  patch: Record<string, string | number>
) => instance.commands.node.updateMany(nodes.map((node) => ({
  id: node.id,
  patch: {
    style: mergeStyle(node.style, patch)
  }
})))

export const updateNodeStyle = (
  instance: NodeToolbarMenuProps['instance'],
  node: Node,
  patch: Record<string, string | number>
) => instance.commands.node.update(node.id, {
  style: mergeStyle(node.style, patch)
})

export const runAndClose = (
  close: () => void,
  effect: Promise<unknown>
) => {
  void effect.finally(close)
}

export const ToolbarMenuSection = ({
  title,
  children
}: {
  title: string
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-menu-section">
    <div className="wb-node-toolbar-menu-title">{title}</div>
    {children}
  </div>
)

export const ToolbarChipRow = ({
  children
}: {
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-chip-row">
    {children}
  </div>
)

export const ToolbarChipColumn = ({
  children
}: {
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-chip-column">
    {children}
  </div>
)

export const ToolbarChip = ({
  active = false,
  disabled = false,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    className="wb-node-toolbar-chip"
    data-active={active ? 'true' : undefined}
    disabled={disabled}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
  >
    {children}
  </button>
)
