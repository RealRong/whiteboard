import type { ContextMenuSection } from '../types'
import type {
  NodeId,
  Operation,
  NodeInput,
  Point
} from '@whiteboard/core/types'
import type { DispatchResult } from '@whiteboard/core/types'
import { selectNodeIds } from '../../../features/node/actions'

type CreateNodePreset = {
  key: string
  label: string
  input: (world: Point) => NodeInput
}

const centerNodeInput = (
  world: Point,
  input: Omit<NodeInput, 'position'>
): NodeInput => {
  const width = input.size?.width ?? 160
  const height = input.size?.height ?? 80

  return {
    ...input,
    position: {
      x: world.x - width / 2,
      y: world.y - height / 2
    }
  }
}

const createNodePresets: readonly CreateNodePreset[] = [
  {
    key: 'create.text',
    label: 'Add text',
    input: (world) => centerNodeInput(world, {
      type: 'text',
      size: { width: 180, height: 44 },
      data: { text: '' }
    })
  },
  {
    key: 'create.sticky',
    label: 'Add sticky',
    input: (world) => centerNodeInput(world, {
      type: 'sticky',
      size: { width: 180, height: 140 },
      data: { text: '' }
    })
  },
  {
    key: 'create.rect',
    label: 'Add rectangle',
    input: (world) => centerNodeInput(world, {
      type: 'rect',
      size: { width: 180, height: 100 },
      data: { title: 'Rectangle' }
    })
  },
  {
    key: 'create.ellipse',
    label: 'Add ellipse',
    input: (world) => centerNodeInput(world, {
      type: 'ellipse',
      size: { width: 180, height: 100 },
      data: { title: 'Ellipse' }
    })
  },
  {
    key: 'create.diamond',
    label: 'Add diamond',
    input: (world) => centerNodeInput(world, {
      type: 'diamond',
      size: { width: 180, height: 120 },
      data: { title: 'Decision' }
    })
  },
  {
    key: 'create.triangle',
    label: 'Add triangle',
    input: (world) => centerNodeInput(world, {
      type: 'triangle',
      size: { width: 180, height: 130 },
      data: { title: 'Triangle' }
    })
  },
  {
    key: 'create.callout',
    label: 'Add callout',
    input: (world) => centerNodeInput(world, {
      type: 'callout',
      size: { width: 220, height: 130 },
      data: { text: 'Callout' }
    })
  },
  {
    key: 'create.arrow-sticker',
    label: 'Add arrow sticker',
    input: (world) => centerNodeInput(world, {
      type: 'arrow-sticker',
      size: { width: 220, height: 110 },
      data: { title: 'Arrow' }
    })
  },
  {
    key: 'create.highlight',
    label: 'Add highlight',
    input: (world) => centerNodeInput(world, {
      type: 'highlight',
      size: { width: 220, height: 90 },
      data: { text: 'Highlight' }
    })
  }
]

const closeAfterDispatch = (
  effect: Promise<DispatchResult>,
  close: () => void,
  onSuccess?: (result: DispatchResult) => void
) => {
  void effect
    .then((result) => {
      if (!result.ok) return
      onSuccess?.(result)
    })
    .finally(close)
}

const readCreatedNodeIds = (
  result: DispatchResult
): NodeId[] => {
  if (!result.ok) return []

  return result.changes.operations
    .filter((operation): operation is Extract<Operation, { type: 'node.create' }> =>
      operation.type === 'node.create'
    )
    .map((operation) => operation.node.id)
}

export const buildCanvasSections = ({
  world,
  activeContainerId,
  containerNodeIds
}: {
  world: Point
  activeContainerId?: NodeId
  containerNodeIds?: readonly NodeId[]
}): readonly ContextMenuSection[] => [
  {
    key: 'create',
    title: 'Create',
    items: createNodePresets.map((preset) => {
      const input = preset.input(world)
      return {
        key: preset.key,
        label: preset.label,
        run: ({ instance, close }) => {
          closeAfterDispatch(
            instance.commands.node.create(
              activeContainerId
                ? { ...input, parentId: activeContainerId }
                : input
            ),
            close,
            (result) => {
              selectNodeIds(instance, readCreatedNodeIds(result))
            }
          )
        }
      }
    })
  },
  {
    key: 'history',
    title: 'History',
    items: [
      {
        key: 'history.undo',
        label: 'Undo',
        run: ({ instance, close }) => {
          instance.commands.history.undo()
          close()
        }
      },
      {
        key: 'history.redo',
        label: 'Redo',
        run: ({ instance, close }) => {
          instance.commands.history.redo()
          close()
        }
      }
    ]
  },
  {
    key: 'selection',
    title: 'Selection',
    items: [
      {
        key: 'selection.select-all',
        label: 'Select all',
        run: ({ instance, close }) => {
          if (activeContainerId) {
            selectNodeIds(instance, containerNodeIds ?? [])
          } else {
            instance.commands.selection.selectAll()
          }
          close()
        }
      }
    ]
  }
]
