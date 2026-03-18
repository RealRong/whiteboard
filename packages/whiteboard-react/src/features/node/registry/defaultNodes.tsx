import { useEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { Node, NodeSchema, SchemaField } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from '../../../types/node'
import type { View as SelectionView } from '../../../runtime/selection'
import {
  useEdit,
  useInternalInstance,
  useSelection
} from '../../../runtime/hooks'
import { createNodeRegistry } from './nodeRegistry'

const getDataString = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'string' ? value : ''
}

const getDataBool = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'boolean' ? value : false
}

const getStyleString = (node: Node, key: string) => {
  const value = node.style && node.style[key]
  return typeof value === 'string' ? value : undefined
}

const getStyleNumber = (node: Node, key: string) => {
  const value = node.style && node.style[key]
  return typeof value === 'number' ? value : undefined
}

const getNodeLabel = (node: Node, fallback: string) =>
  getDataString(node, 'title') || getDataString(node, 'text') || fallback

const createField = (
  scope: 'data' | 'style',
  path: string,
  label: string,
  type: SchemaField['type'],
  extra: Partial<SchemaField> = {}
): SchemaField => ({
  id: `${scope}.${path}`,
  label,
  type,
  scope,
  path,
  ...extra
})

const dataField = (
  path: string,
  label: string,
  type: SchemaField['type'],
  extra?: Partial<SchemaField>
) => createField('data', path, label, type, extra)

const styleField = (
  path: string,
  label: string,
  type: SchemaField['type'],
  extra?: Partial<SchemaField>
) => createField('style', path, label, type, extra)

const createTextField = (path: 'title' | 'text') =>
  dataField(path, path === 'title' ? 'Title' : 'Text', path === 'title' ? 'string' : 'text')

const isSingleSelectedNode = (
  selection: SelectionView,
  nodeId: Node['id']
) => (
  selection.target.edgeId === undefined
  && selection.items.count === 1
  && selection.target.nodeIds[0] === nodeId
)

const activateEditableField = ({
  nodeId,
  field,
  selection,
  instance
}: {
  nodeId: Node['id']
  field: 'text' | 'title'
  selection: SelectionView
  instance: ReturnType<typeof useInternalInstance>
}) => {
  if (!instance.read.tool.is('select')) {
    return
  }

  if (isSingleSelectedNode(selection, nodeId)) {
    instance.commands.edit.start(nodeId, field)
    return
  }

  instance.commands.selection.replace([nodeId])
}

const rectSchema: NodeSchema = {
  type: 'rect',
  label: 'Rect',
  fields: [
    createTextField('title'),
    styleField('fill', 'Fill', 'color'),
    styleField('stroke', 'Stroke', 'color'),
    styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 }),
    styleField('color', 'Text color', 'color')
  ]
}

const textSchema: NodeSchema = {
  type: 'text',
  label: 'Text',
  fields: [
    createTextField('text'),
    styleField('color', 'Text color', 'color'),
    styleField('fontSize', 'Font size', 'number', { min: 8, step: 1 })
  ]
}

const stickySchema: NodeSchema = {
  type: 'sticky',
  label: 'Sticky',
  fields: [
    createTextField('text'),
    styleField('fill', 'Fill', 'color'),
    styleField('color', 'Text color', 'color'),
    styleField('fontSize', 'Font size', 'number', { min: 8, step: 1 }),
    styleField('stroke', 'Stroke', 'color'),
    styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 })
  ]
}

const groupSchema: NodeSchema = {
  type: 'group',
  label: 'Group',
  fields: [
    createTextField('title'),
    dataField('collapsed', 'Collapsed', 'boolean'),
    dataField('autoFit', 'Auto fit', 'enum', {
      options: [
        { label: 'Expand only', value: 'expand-only' },
        { label: 'Manual', value: 'manual' }
      ]
    }),
    dataField('padding', 'Padding', 'number', { min: 0, step: 1 }),
    styleField('fill', 'Fill', 'color'),
    styleField('stroke', 'Stroke', 'color'),
    styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 }),
    styleField('color', 'Text color', 'color')
  ]
}

const TextNodeRenderer = ({
  updateData,
  node,
  selected,
  variant
}: NodeRenderProps & { variant: 'text' | 'sticky' }) => {
  const instance = useInternalInstance()
  const selection = useSelection()
  const edit = useEdit()
  const editing = edit?.nodeId === node.id && edit.field === 'text'
  const text = getDataString(node, 'text')
  const [draft, setDraft] = useState(text)
  const isSticky = variant === 'sticky'
  const fontSize = getStyleNumber(node, 'fontSize') ?? (isSticky ? 14 : 13)
  const color = getStyleString(node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))'

  useEffect(() => {
    setDraft(text)
  }, [text])

  const commit = () => {
    if (draft !== text) {
      void updateData({ text: draft })
    }
    instance.commands.edit.clear()
  }

  const cancel = () => {
    setDraft(text)
    instance.commands.edit.clear()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  if (editing) {
    return (
      <textarea
        data-selection-ignore
        data-input-ignore
        className="wb-default-text-editor"
        value={draft}
        autoFocus
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        style={{ fontSize, color }}
      />
    )
  }

  return (
    <div
      className="wb-default-text-display"
      data-node-editable-field="text"
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      onClick={() => {
        activateEditableField({
          instance,
          selection,
          nodeId: node.id,
          field: 'text'
        })
      }}
      style={{
        fontSize,
        color,
        opacity: selected ? 1 : 0.9
      }}
    >
      {text || (isSticky ? 'Sticky' : 'Text')}
    </div>
  )
}

const GroupNodeRenderer = ({ updateData, node }: NodeRenderProps) => {
  const instance = useInternalInstance()
  const selection = useSelection()
  const edit = useEdit()
  const title = getDataString(node, 'title')
  const collapsed = getDataBool(node, 'collapsed')
  const editing = edit?.nodeId === node.id && edit.field === 'title'
  const [draft, setDraft] = useState(title)
  const color = getStyleString(node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))'

  useEffect(() => {
    setDraft(title)
  }, [title])

  const commit = () => {
    if (draft !== title) {
      void updateData({ title: draft })
    }
    instance.commands.edit.clear()
  }

  const toggleCollapse = () => {
    void updateData({ collapsed: !collapsed })
  }

  return (
    <div className="wb-default-group">
      <div className="wb-default-group-header">
        <div
          className="wb-default-group-toggle"
          data-input-ignore
          data-selection-ignore
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={toggleCollapse}
        >
          {collapsed ? '+' : '-'}
        </div>
        {editing ? (
          <input
            data-selection-ignore
            data-input-ignore
            value={draft}
            autoFocus
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(title)
                instance.commands.edit.clear()
              }
            }}
            className="wb-default-group-input"
            style={{ color }}
          />
        ) : (
          <div
            className="wb-default-group-title"
            data-node-editable-field="title"
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onClick={() => {
              activateEditableField({
                instance,
                selection,
                nodeId: node.id,
                field: 'title'
              })
            }}
            style={{ color }}
          >
            {title || 'Group'}
          </div>
        )}
      </div>
      {collapsed && (
        <div className="wb-default-group-collapsed" style={{ color }}>
          Collapsed
        </div>
      )}
    </div>
  )
}

type ShapeVariant =
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'arrow-sticker'
  | 'callout'
  | 'highlight'

const SHAPE_DEFAULTS: Record<
  ShapeVariant,
  {
    fill: string
    stroke: string
    text: string
  }
> = {
  ellipse: {
    fill: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))',
    stroke: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))',
    text: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))'
  },
  diamond: {
    fill: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
    stroke: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%))',
    text: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%))'
  },
  triangle: {
    fill: 'hsl(var(--tag-red-background, 5.7 77.8% 94.7%))',
    stroke: 'hsl(var(--tag-red-foreground, 4 58.4% 54.7%))',
    text: 'hsl(var(--tag-red-foreground, 4 58.4% 54.7%))'
  },
  'arrow-sticker': {
    fill: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))',
    stroke: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))',
    text: 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))'
  },
  callout: {
    fill: 'hsl(var(--ui-surface, 0 0% 100%))',
    stroke: 'hsl(var(--ui-text-secondary, 37.5 3.3% 47.5%))',
    text: 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  },
  highlight: {
    fill: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%) / 0.9)',
    stroke: 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%) / 0.6)',
    text: 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  }
}

const getShapeColors = (
  variant: ShapeVariant,
  node: Node,
  selected: boolean,
  hovered: boolean
) => {
  const defaults = SHAPE_DEFAULTS[variant]
  const stroke = selected
    ? 'hsl(var(--ui-accent, 209.8 76.7% 51.2%))'
    : (getStyleString(node, 'stroke') ?? defaults.stroke)
  const fill = getStyleString(node, 'fill') ?? defaults.fill
  const text = getStyleString(node, 'color') ?? defaults.text
  const strokeWidth = getStyleNumber(node, 'strokeWidth') ?? (hovered ? 1.8 : 1.4)

  return {
    fill,
    stroke,
    text,
    strokeWidth
  }
}

const renderShapeGraphic = (
  variant: ShapeVariant,
  fill: string,
  stroke: string,
  strokeWidth: number
) => {
  switch (variant) {
    case 'ellipse':
      return (
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="38"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )
    case 'diamond':
      return (
        <polygon
          points="50,4 96,50 50,96 4,50"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'triangle':
      return (
        <polygon
          points="50,6 94,92 6,92"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'arrow-sticker':
      return (
        <polygon
          points="6,28 58,28 58,12 94,50 58,88 58,72 6,72"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'callout':
      return (
        <path
          d="M16 10 H84 Q92 10 92 18 V58 Q92 66 84 66 H56 L36 90 L40 66 H16 Q8 66 8 58 V18 Q8 10 16 10 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )
    case 'highlight':
      return (
        <>
          <rect
            x="8"
            y="24"
            width="84"
            height="52"
            rx="18"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <path
            d="M14 75 C28 82, 42 68, 57 75 S83 82, 92 74"
            fill="none"
            stroke={stroke}
            strokeOpacity="0.45"
            strokeWidth={Math.max(1, strokeWidth - 0.2)}
            strokeLinecap="round"
          />
        </>
      )
  }
}

const ShapeNode = ({
  node,
  selected,
  hovered,
  variant
}: NodeRenderProps & {
  variant: ShapeVariant
}) => {
  const { fill, stroke, text, strokeWidth } = getShapeColors(
    variant,
    node,
    selected,
    hovered
  )
  const labelStyle: CSSProperties =
    variant === 'highlight'
      ? {
          color: text,
          fontWeight: 700,
          textAlign: 'left',
          padding: '0 18px'
        }
      : variant === 'callout'
        ? {
            color: text,
            textAlign: 'left',
            padding: '0 18px 14px'
          }
        : variant === 'arrow-sticker'
          ? {
              color: text,
              maxWidth: '56%',
              padding: '0 18px 0 8px'
            }
          : variant === 'diamond'
            ? {
                color: text,
                maxWidth: '64%'
              }
            : {
                color: text,
                maxWidth: '72%'
              }

  return (
    <div
      className={`wb-shape-node wb-shape-node-${variant}`}
    >
      <svg
        className="wb-shape-node-svg"
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >
        {renderShapeGraphic(variant, fill, stroke, strokeWidth)}
      </svg>
      <div className="wb-shape-node-label" style={labelStyle}>
        {getNodeLabel(node, variant)}
      </div>
    </div>
  )
}

const createShapeDefinition = (
  type: ShapeVariant,
  label: string,
  defaultData: Record<string, unknown>
): NodeDefinition => ({
  type,
  label,
  defaultData,
  render: (props) => <ShapeNode {...props} variant={type} />,
  schema: {
    type,
    label,
    fields: [
      createTextField(typeof defaultData.text === 'string' ? 'text' : 'title'),
      styleField('fill', 'Fill', 'color'),
      styleField('stroke', 'Stroke', 'color'),
      styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 }),
      styleField('color', 'Text color', 'color')
    ]
  },
  style: () => ({
    border: 'none',
    boxShadow: 'none',
    background: 'transparent',
    borderRadius: 0
  })
})

const createTextStyle = (variant: 'text' | 'sticky') => (props: NodeRenderProps): CSSProperties => {
  const isSticky = variant === 'sticky'
  const background = isSticky
    ? (
      typeof props.node.style?.fill === 'string'
        ? props.node.style.fill
        : (
          props.node.data && typeof props.node.data.background === 'string'
            ? props.node.data.background
            : 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))'
        )
        )
    : 'transparent'
  const stroke = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : isSticky
      ? 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%) / 0.6)'
      : undefined
  const strokeWidth = typeof props.node.style?.strokeWidth === 'number'
    ? props.node.style.strokeWidth
    : 1
  const border =
    stroke
      ? `${strokeWidth}px solid ${stroke}`
      : isSticky
        ? '1px solid hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%) / 0.6)'
      : props.selected
        ? '1px solid hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.6)'
        : '1px solid hsl(var(--ui-border-subtle, 40 5.7% 89.6%) / 0.7)'
  return {
    background,
    border,
    borderRadius: isSticky ? 10 : 8,
    boxShadow: props.selected ? '0 0 0 2px hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.2)' : 'none',
    display: 'block',
    padding: isSticky ? '16px' : '12px',
    textAlign: 'left'
  }
}

const rectStyle = (props: NodeRenderProps): CSSProperties => {
  const fill = typeof props.node.style?.fill === 'string' ? props.node.style.fill : 'hsl(var(--ui-surface, 0 0% 100%))'
  const stroke = typeof props.node.style?.stroke === 'string' ? props.node.style.stroke : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const width = typeof props.node.style?.strokeWidth === 'number' ? props.node.style.strokeWidth : 1
  return {
    background: fill,
    border: `${width}px solid ${stroke}`,
    color: getStyleString(props.node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  }
}

const groupStyle = (props: NodeRenderProps): CSSProperties => {
  const hovered = props.hovered
  const collapsed = getDataBool(props.node, 'collapsed')
  const borderColor = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : hovered
      ? 'hsl(var(--ui-accent, 209.8 76.7% 51.2%))'
      : props.selected
        ? 'hsl(var(--ui-accent, 209.8 76.7% 51.2%))'
        : 'hsl(var(--ui-border-strong, 40 9.1% 93.5%))'
  const borderWidth = typeof props.node.style?.strokeWidth === 'number'
    ? props.node.style.strokeWidth
    : 1
  const fill = typeof props.node.style?.fill === 'string'
    ? props.node.style.fill
    : collapsed
      ? 'hsl(var(--ui-surface-strong, 40 5.7% 89.6%) / 0.45)'
      : 'hsl(var(--ui-surface-muted, 40 9.1% 93.5%) / 0.45)'
  return {
    background: fill,
    border: `${borderWidth}px dashed ${borderColor}`,
    boxShadow: props.selected ? '0 0 0 2px hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.2)' : 'none',
    color: getStyleString(props.node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
    display: 'block',
    paddingTop: 28,
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8
  }
}

const DEFAULT_NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: 'rect',
    label: 'Rect',
    schema: rectSchema,
    render: ({ node }) => getDataString(node, 'title') || node.type,
    style: rectStyle
  },
  {
    type: 'text',
    label: 'Text',
    schema: textSchema,
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="text" />,
    style: createTextStyle('text'),
    autoMeasure: true
  },
  {
    type: 'sticky',
    label: 'Sticky',
    schema: stickySchema,
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="sticky" />,
    style: createTextStyle('sticky'),
    autoMeasure: true
  },
  createShapeDefinition('ellipse', 'Ellipse', { title: 'Ellipse' }),
  createShapeDefinition('diamond', 'Diamond', { title: 'Decision' }),
  createShapeDefinition('triangle', 'Triangle', { title: 'Triangle' }),
  createShapeDefinition('arrow-sticker', 'Arrow', { title: 'Arrow' }),
  createShapeDefinition('callout', 'Callout', { text: 'Callout' }),
  createShapeDefinition('highlight', 'Highlight', { text: 'Highlight' }),
  {
    type: 'group',
    label: 'Group',
    schema: groupSchema,
    defaultData: { title: '', collapsed: false, autoFit: 'expand-only', padding: 24 },
    render: (props) => <GroupNodeRenderer {...props} />,
    style: groupStyle,
    canRotate: false
  }
]

export const createDefaultNodeRegistry = () => createNodeRegistry(DEFAULT_NODE_DEFINITIONS)
