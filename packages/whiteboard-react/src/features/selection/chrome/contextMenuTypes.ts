export type ContextMenuItem = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onClick?: () => unknown
  children?: readonly ContextMenuItem[]
}

export type ContextMenuGroup = {
  key: string
  title?: string
  items: readonly ContextMenuItem[]
}
