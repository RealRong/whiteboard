import { useMemo } from 'react'
import {
  resolveNodeChromeView,
  resolveNodeSelectionView,
  resolveSelectionPresentation,
  type NodeChromeView,
  type NodeSelectionView,
  type SelectionPresentation
} from '@whiteboard/editor'
import { resolveNodeMeta } from './registry'
import {
  useEdit,
  useInternalInstance,
  useTool
} from '../../runtime/hooks'
import { useStoreValue } from '../../runtime/hooks/useStoreValue'

export {
  resolveNodeChromeView,
  resolveNodeSelectionView,
  resolveSelectionBoxView,
  resolveSelectionPresentation
} from '@whiteboard/editor'
export type {
  NodeChromeView,
  NodeSelectionView,
  SelectionBoxView,
  SelectionPresentation
} from '@whiteboard/editor'

export const useSelection = (): NodeSelectionView => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveNodeSelectionView(selection, {
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  }), [instance, selection])
}

export const useNodeChrome = (): NodeChromeView => {
  const instance = useInternalInstance()
  const tool = useTool()
  const edit = useEdit()
  const selection = useStoreValue(instance.read.selection)
  const mode = useStoreValue(instance.interaction.mode)
  const interaction = useStoreValue(instance.state.interaction)

  return useMemo(() => resolveNodeChromeView({
    tool,
    edit,
    selection,
    mode,
    chrome: interaction.chrome
  }), [edit, interaction.chrome, mode, selection, tool])
}

export const useSelectionPresentation = (): SelectionPresentation => {
  const selection = useSelection()
  const chrome = useNodeChrome()

  return useMemo(
    () => resolveSelectionPresentation(selection, chrome),
    [chrome, selection]
  )
}
