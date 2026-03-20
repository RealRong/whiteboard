import type {
  MindmapNodeData,
  NodeId,
  NodeInput,
  Point
} from '@whiteboard/core/types'
import type { EditField } from '../../runtime/edit'
import type { WhiteboardInstance } from '../../runtime/instance'

export type InsertPresetGroup =
  | 'text'
  | 'sticky'
  | 'shape'
  | 'mindmap'

export type InsertPresetResult = {
  nodeId: NodeId
  edit?: {
    nodeId: NodeId
    field: EditField
  }
}

export type InsertPreset = {
  key: string
  group: InsertPresetGroup
  label: string
  description?: string
  canNest?: boolean
  create: (options: {
    instance: WhiteboardInstance
    world: Point
    parentId?: NodeId
  }) => InsertPresetResult | undefined
}

export type StickyTone = {
  key: string
  label: string
  fill: string
}

export type MindmapTemplate = {
  key: string
  label: string
  description: string
  root: MindmapNodeData
  children?: readonly {
    data: MindmapNodeData
    side?: 'left' | 'right'
  }[]
}

const STICKY_TONES: readonly StickyTone[] = [
  {
    key: 'sticky.yellow',
    label: 'Yellow',
    fill: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))'
  },
  {
    key: 'sticky.blue',
    label: 'Blue',
    fill: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))'
  },
  {
    key: 'sticky.green',
    label: 'Green',
    fill: 'hsl(var(--tag-green-background, 146.7 24.3% 92.7%))'
  },
  {
    key: 'sticky.pink',
    label: 'Pink',
    fill: 'hsl(var(--tag-pink-background, 331.8 63% 94.7%))'
  },
  {
    key: 'sticky.purple',
    label: 'Purple',
    fill: 'hsl(var(--tag-purple-background, 274.3 53.8% 94.9%))'
  },
  {
    key: 'sticky.red',
    label: 'Red',
    fill: 'hsl(var(--tag-red-background, 5.7 77.8% 94.7%))'
  },
  {
    key: 'sticky.orange',
    label: 'Orange',
    fill: 'hsl(var(--tag-orange-background, 26.9 78.4% 92.7%))'
  },
  {
    key: 'sticky.gray',
    label: 'Gray',
    fill: 'hsl(var(--tag-gray-background, 40 9.1% 93.5%))'
  }
] as const

export const STICKY_INSERT_OPTIONS = STICKY_TONES

export const MINDMAP_INSERT_TEMPLATES: readonly MindmapTemplate[] = [
  {
    key: 'mindmap.blank',
    label: 'Blank map',
    description: 'Central topic only',
    root: {
      kind: 'text',
      text: 'Central topic'
    }
  },
  {
    key: 'mindmap.project',
    label: 'Project',
    description: 'Goals, timeline, tasks, notes',
    root: {
      kind: 'text',
      text: 'Project'
    },
    children: [
      { data: { kind: 'text', text: 'Goals' }, side: 'left' },
      { data: { kind: 'text', text: 'Timeline' }, side: 'right' },
      { data: { kind: 'text', text: 'Tasks' }, side: 'left' },
      { data: { kind: 'text', text: 'Notes' }, side: 'right' }
    ]
  },
  {
    key: 'mindmap.research',
    label: 'Research',
    description: 'Question, sources, findings, next',
    root: {
      kind: 'text',
      text: 'Research'
    },
    children: [
      { data: { kind: 'text', text: 'Question' }, side: 'left' },
      { data: { kind: 'text', text: 'Sources' }, side: 'right' },
      { data: { kind: 'text', text: 'Findings' }, side: 'left' },
      { data: { kind: 'text', text: 'Next steps' }, side: 'right' }
    ]
  },
  {
    key: 'mindmap.meeting',
    label: 'Meeting',
    description: 'Agenda, discussion, decisions, actions',
    root: {
      kind: 'text',
      text: 'Meeting'
    },
    children: [
      { data: { kind: 'text', text: 'Agenda' }, side: 'left' },
      { data: { kind: 'text', text: 'Discussion' }, side: 'right' },
      { data: { kind: 'text', text: 'Decisions' }, side: 'left' },
      { data: { kind: 'text', text: 'Action items' }, side: 'right' }
    ]
  }
] as const

type InsertPlacement = 'center' | 'point'

const placeNodeInput = (
  world: Point,
  input: Omit<NodeInput, 'position'>,
  placement: InsertPlacement = 'center'
): NodeInput => {
  const width = input.size?.width ?? 160
  const height = input.size?.height ?? 80

  return {
    ...input,
    position: placement === 'point'
      ? world
      : {
          x: world.x - width / 2,
          y: world.y - height / 2
        }
  }
}

const createNodePreset = ({
  key,
  group,
  label,
  description,
  focus,
  placement,
  input
}: {
  key: string
  group: InsertPresetGroup
  label: string
  description?: string
  focus?: EditField
  placement?: InsertPlacement
  input: (world: Point) => Omit<NodeInput, 'position'>
}): InsertPreset => ({
  key,
  group,
  label,
  description,
  create: ({ instance, world, parentId }) => {
    const result = instance.commands.node.create(
      placeNodeInput(world, {
        ...input(world),
        parentId
      }, placement)
    )
    if (!result.ok) {
      return
    }

    return {
      nodeId: result.data.nodeId,
      edit: focus
        ? {
            nodeId: result.data.nodeId,
            field: focus
          }
        : undefined
    }
  }
})

const createMindmapPreset = (
  template: MindmapTemplate
): InsertPreset => ({
  key: template.key,
  group: 'mindmap',
  label: template.label,
  description: template.description,
  canNest: false,
  create: ({ instance, world }) => {
    const result = instance.commands.mindmap.create({
      rootData: template.root
    })
    if (!result.ok) {
      return
    }

    template.children?.forEach((child) => {
      instance.commands.mindmap.addChild(
        result.data.mindmapId,
        result.data.rootId,
        child.data,
        {
          side: child.side
        }
      )
    })

    const rect = instance.read.index.node.get(result.data.mindmapId)?.rect
    const width = rect?.width ?? 260
    const height = rect?.height ?? 180
    instance.commands.mindmap.moveRoot({
      nodeId: result.data.mindmapId,
      position: {
        x: world.x - width / 2,
        y: world.y - height / 2
      },
      threshold: 0
    })

    return {
      nodeId: result.data.mindmapId
    }
  }
})

export const TEXT_INSERT_PRESET = createNodePreset({
  key: 'text',
  group: 'text',
  label: 'Text',
  description: 'Empty text block',
  focus: 'text',
  placement: 'point',
  input: () => ({
    type: 'text',
    size: { width: 48, height: 24 },
    data: { text: '' }
  })
})

export const STICKY_INSERT_PRESETS: readonly InsertPreset[] = STICKY_TONES.map((tone) =>
  createNodePreset({
    key: tone.key,
    group: 'sticky',
    label: tone.label,
    focus: 'text',
    input: () => ({
      type: 'sticky',
      size: { width: 200, height: 150 },
      data: {
        text: '',
        background: tone.fill
      },
      style: {
        fill: tone.fill,
        color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
        stroke: 'hsl(var(--ui-text-primary, 40 2.1% 28%) / 0.12)',
        strokeWidth: 1
      }
    })
  })
)

export const SHAPE_INSERT_PRESETS: readonly InsertPreset[] = [
  createNodePreset({
    key: 'shape.rect',
    group: 'shape',
    label: 'Rectangle',
    input: () => ({
      type: 'rect',
      size: { width: 180, height: 100 },
      data: { title: 'Rectangle' },
      style: {
        fill: 'hsl(var(--ui-surface, 0 0% 100%))',
        stroke: 'hsl(var(--ui-border-subtle, 40 5.7% 89.6%))',
        strokeWidth: 1,
        color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.ellipse',
    group: 'shape',
    label: 'Ellipse',
    input: () => ({
      type: 'ellipse',
      size: { width: 180, height: 100 },
      data: { title: 'Ellipse' },
      style: {
        fill: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))',
        stroke: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))',
        strokeWidth: 1,
        color: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.diamond',
    group: 'shape',
    label: 'Diamond',
    input: () => ({
      type: 'diamond',
      size: { width: 180, height: 120 },
      data: { title: 'Decision' },
      style: {
        fill: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
        stroke: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%))',
        strokeWidth: 1,
        color: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.triangle',
    group: 'shape',
    label: 'Triangle',
    input: () => ({
      type: 'triangle',
      size: { width: 180, height: 130 },
      data: { title: 'Triangle' },
      style: {
        fill: 'hsl(var(--tag-red-background, 5.7 77.8% 94.7%))',
        stroke: 'hsl(var(--tag-red-foreground, 4 58.4% 54.7%))',
        strokeWidth: 1,
        color: 'hsl(var(--tag-red-foreground, 4 58.4% 54.7%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.callout',
    group: 'shape',
    label: 'Callout',
    input: () => ({
      type: 'callout',
      size: { width: 240, height: 140 },
      data: { text: 'Callout' },
      style: {
        fill: 'hsl(var(--ui-surface, 0 0% 100%))',
        stroke: 'hsl(var(--ui-text-secondary, 37.5 3.3% 47.5%))',
        strokeWidth: 1,
        color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.arrow-sticker',
    group: 'shape',
    label: 'Arrow',
    input: () => ({
      type: 'arrow-sticker',
      size: { width: 220, height: 110 },
      data: { title: 'Arrow' },
      style: {
        fill: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))',
        stroke: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))',
        strokeWidth: 1,
        color: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))'
      }
    })
  }),
  createNodePreset({
    key: 'shape.highlight',
    group: 'shape',
    label: 'Highlight',
    input: () => ({
      type: 'highlight',
      size: { width: 220, height: 90 },
      data: { text: 'Highlight' },
      style: {
        fill: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%) / 0.9)',
        stroke: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%) / 0.6)',
        strokeWidth: 1,
        color: 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
      }
    })
  })
] as const

export const MINDMAP_INSERT_PRESETS: readonly InsertPreset[] = MINDMAP_INSERT_TEMPLATES.map(createMindmapPreset)

export const INSERT_PRESETS: readonly InsertPreset[] = [
  TEXT_INSERT_PRESET,
  ...STICKY_INSERT_PRESETS,
  ...SHAPE_INSERT_PRESETS,
  ...MINDMAP_INSERT_PRESETS
] as const

const INSERT_PRESET_INDEX = new Map(
  INSERT_PRESETS.map((preset) => [preset.key, preset] as const)
)

const STICKY_TONE_INDEX = new Map(
  STICKY_TONES.map((tone) => [tone.key, tone] as const)
)

export const DEFAULT_STICKY_PRESET_KEY = STICKY_INSERT_PRESETS[0].key
export const DEFAULT_SHAPE_PRESET_KEY = SHAPE_INSERT_PRESETS[0].key
export const DEFAULT_MINDMAP_PRESET_KEY = MINDMAP_INSERT_PRESETS[0].key

export const getInsertPreset = (
  key: string
) => INSERT_PRESET_INDEX.get(key)

export const readStickyInsertTone = (
  key: string | undefined
) => key
  ? STICKY_TONE_INDEX.get(key)
  : undefined

export const readInsertPresetGroup = (
  key: string | undefined
) => key
  ? INSERT_PRESET_INDEX.get(key)?.group
  : undefined
