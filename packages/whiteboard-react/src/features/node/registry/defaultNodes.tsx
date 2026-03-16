import { useEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { Node, NodeSchema, SchemaField } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from '../../../types/node'
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
  commands,
  node,
  selected,
  variant
}: NodeRenderProps & { variant: 'text' | 'sticky' }) => {
  const [editing, setEditing] = useState(false)
  const text = getDataString(node, 'text')
  const [draft, setDraft] = useState(text)
  const isSticky = variant === 'sticky'
  const fontSize = getStyleNumber(node, 'fontSize') ?? (isSticky ? 14 : 13)
  const color = getStyleString(node, 'color') ?? '#111827'

  useEffect(() => {
    setDraft(text)
  }, [text])

  const commit = () => {
    if (draft !== text) {
      void commands.node.updateData(node.id, { text: draft })
    }
    setEditing(false)
  }

  const cancel = () => {
    setDraft(text)
    setEditing(false)
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
      onDoubleClick={() => setEditing(true)}
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

const GroupNodeRenderer = ({ commands, node }: NodeRenderProps) => {
  const title = getDataString(node, 'title')
  const collapsed = getDataBool(node, 'collapsed')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const color = getStyleString(node, 'color') ?? '#0f172a'

  useEffect(() => {
    setDraft(title)
  }, [title])

  const commit = () => {
    if (draft !== title) {
      void commands.node.updateData(node.id, { title: draft })
    }
    setEditing(false)
  }

  const toggleCollapse = () => {
    void commands.node.updateData(node.id, { collapsed: !collapsed })
  }

  return (
    <div className="wb-default-group">
      <div
        data-selection-ignore
        className="wb-default-group-header"
      >
        <div
          className="wb-default-group-toggle"
          data-input-ignore
          data-selection-ignore
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
                setEditing(false)
              }
            }}
            className="wb-default-group-input"
            style={{ color }}
          />
        ) : (
          <div
            className="wb-default-group-title"
            style={{ color }}
            onDoubleClick={() => setEditing(true)}
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
    fill: '#ecfeff',
    stroke: '#0891b2',
    text: '#164e63'
  },
  diamond: {
    fill: '#fef3c7',
    stroke: '#d97706',
    text: '#78350f'
  },
  triangle: {
    fill: '#fee2e2',
    stroke: '#dc2626',
    text: '#7f1d1d'
  },
  'arrow-sticker': {
    fill: '#dbeafe',
    stroke: '#2563eb',
    text: '#1e3a8a'
  },
  callout: {
    fill: '#ffffff',
    stroke: '#334155',
    text: '#0f172a'
  },
  highlight: {
    fill: 'rgba(251, 191, 36, 0.32)',
    stroke: '#f59e0b',
    text: '#78350f'
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
    ? '#2563eb'
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

const ShapeNodeRenderer = ({
  node,
  variant
}: NodeRenderProps & { variant: ShapeVariant }) => (
  getNodeLabel(node, variant)
)

const ShapeNodeContainer = ({
  children,
  node,
  rect,
  selected,
  hovered,
  containerProps,
  variant
}: NodeRenderProps & {
  children: ReactNode
  variant: ShapeVariant
}) => {
  if (!containerProps) {
    return children
  }

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
      ref={containerProps.ref}
      className={`wb-shape-node wb-shape-node-${variant}`}
      data-node-id={containerProps.nodeId}
      onPointerDown={containerProps.onPointerDown}
      style={{
        ...containerProps.style,
        width: rect.width,
        height: rect.height
      }}
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
        {children}
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
  render: (props) => <ShapeNodeRenderer {...props} variant={type} />,
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
  renderContainer: (props, children) => (
    <ShapeNodeContainer {...props} variant={type}>
      {children}
    </ShapeNodeContainer>
  )
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
            : '#fef3c7'
        )
    )
    : 'transparent'
  const stroke = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : isSticky
      ? 'rgba(250, 204, 21, 0.6)'
      : undefined
  const strokeWidth = typeof props.node.style?.strokeWidth === 'number'
    ? props.node.style.strokeWidth
    : 1
  const border =
    stroke
      ? `${strokeWidth}px solid ${stroke}`
      : isSticky
        ? '1px solid rgba(250, 204, 21, 0.6)'
      : props.selected
        ? '1px solid rgba(59, 130, 246, 0.6)'
        : '1px solid rgba(148, 163, 184, 0.4)'
  return {
    background,
    border,
    borderRadius: isSticky ? 10 : 8,
    boxShadow: props.selected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
    display: 'block',
    padding: isSticky ? '16px' : '12px',
    textAlign: 'left'
  }
}

const rectStyle = (props: NodeRenderProps): CSSProperties => {
  const fill = typeof props.node.style?.fill === 'string' ? props.node.style.fill : '#ffffff'
  const stroke = typeof props.node.style?.stroke === 'string' ? props.node.style.stroke : '#1d1d1f'
  const width = typeof props.node.style?.strokeWidth === 'number' ? props.node.style.strokeWidth : 1
  return {
    background: fill,
    border: `${width}px solid ${stroke}`,
    color: getStyleString(props.node, 'color') ?? '#111827'
  }
}

const groupStyle = (props: NodeRenderProps): CSSProperties => {
  const hovered = props.hovered
  const collapsed = getDataBool(props.node, 'collapsed')
  const borderColor = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : hovered
      ? '#2563eb'
      : props.selected
        ? '#3b82f6'
        : '#94a3b8'
  const borderWidth = typeof props.node.style?.strokeWidth === 'number'
    ? props.node.style.strokeWidth
    : 1
  const fill = typeof props.node.style?.fill === 'string'
    ? props.node.style.fill
    : collapsed
      ? 'rgba(148, 163, 184, 0.08)'
      : 'rgba(148, 163, 184, 0.06)'
  return {
    background: fill,
    border: `${borderWidth}px dashed ${borderColor}`,
    boxShadow: props.selected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
    color: getStyleString(props.node, 'color') ?? '#0f172a',
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
    getStyle: rectStyle
  },
  {
    type: 'text',
    label: 'Text',
    schema: textSchema,
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="text" />,
    getStyle: createTextStyle('text'),
    autoMeasure: true
  },
  {
    type: 'sticky',
    label: 'Sticky',
    schema: stickySchema,
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="sticky" />,
    getStyle: createTextStyle('sticky'),
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
    getStyle: groupStyle,
    canRotate: false
  }
]

export const createDefaultNodeRegistry = () => createNodeRegistry(DEFAULT_NODE_DEFINITIONS)
