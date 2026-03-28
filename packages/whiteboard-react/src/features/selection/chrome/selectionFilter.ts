import type { Node } from '@whiteboard/core/types'
import type {
  NodeSelectionCan,
  NodeSummary
} from '../../node/summary'
import {
  createSelectionOperations,
  runMenuAction,
  type NodeMetaResolver,
  type SelectionMenuInstance
} from './selectionMenuActions'
import type { SelectionMenuFilter } from './selectionMenuTypes'

export const resolveSelectionFilter = ({
  instance,
  nodes,
  summary,
  can,
  resolveMeta,
  close
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  summary: NodeSummary
  can: NodeSelectionCan
  resolveMeta?: NodeMetaResolver
  close?: () => void
}): SelectionMenuFilter | undefined => {
  if (!can.filter) {
    return undefined
  }

  const operations = createSelectionOperations({
    instance,
    nodes,
    resolveMeta
  })

  return {
    types: summary.types,
    onSelect: (key) => runMenuAction(
      () => operations.filter(key),
      close
    )()
  }
}
