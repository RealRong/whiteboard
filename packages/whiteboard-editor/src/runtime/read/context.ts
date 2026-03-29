import type { ReadStore } from '@whiteboard/engine'
import type {
  ContextMenuView,
  SelectionMenuView
} from '../context'

export const createContextRead = ({
  menu,
  selection
}: {
  menu: ReadStore<ContextMenuView | null>
  selection: ReadStore<SelectionMenuView | null>
}) => ({
  menu,
  selection
})
