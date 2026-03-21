import type { CSSProperties, ReactNode } from 'react'
import type { Node } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from '../../../../types/node'
import {
  createSchema,
  createTextField,
  getNodeLabel,
  getStyleNumber,
  getStyleString,
  styleField
} from './shared'

type ShapeVariant =
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'arrow-sticker'
  | 'callout'
  | 'highlight'

const rectSchema = createSchema('rect', 'Rect', [
  createTextField('title'),
  styleField('fill', 'Fill', 'color'),
  styleField('stroke', 'Stroke', 'color'),
  styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 }),
  styleField('color', 'Text color', 'color')
])

const rectStyle = (props: NodeRenderProps): CSSProperties => {
  const fill = typeof props.node.style?.fill === 'string'
    ? props.node.style.fill
    : 'hsl(var(--ui-surface, 0 0% 100%))'
  const stroke = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const width = typeof props.node.style?.strokeWidth === 'number'
    ? props.node.style.strokeWidth
    : 1

  return {
    background: fill,
    border: `${width}px solid ${stroke}`,
    color: getStyleString(props.node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  }
}

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
): ReactNode => {
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
    <div className={`wb-shape-node wb-shape-node-${variant}`}>
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
  meta: {
    name: label,
    family: 'shape',
    icon: type,
    controls: ['fill', 'stroke']
  },
  defaultData,
  render: (props) => <ShapeNode {...props} variant={type} />,
  schema: createSchema(type, label, [
    createTextField(typeof defaultData.text === 'string' ? 'text' : 'title'),
    styleField('fill', 'Fill', 'color'),
    styleField('stroke', 'Stroke', 'color'),
    styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 }),
    styleField('color', 'Text color', 'color')
  ]),
  style: () => ({
    border: 'none',
    boxShadow: 'none',
    background: 'transparent',
    borderRadius: 0
  })
})

export const RectNodeDefinition: NodeDefinition = {
  type: 'rect',
  meta: {
    name: 'Rect',
    family: 'shape',
    icon: 'rect',
    controls: ['fill', 'stroke']
  },
  schema: rectSchema,
  render: ({ node }) => getNodeLabel(node, node.type),
  style: rectStyle
}

export const ShapeNodeDefinitions: NodeDefinition[] = [
  createShapeDefinition('ellipse', 'Ellipse', { title: 'Ellipse' }),
  createShapeDefinition('diamond', 'Diamond', { title: 'Decision' }),
  createShapeDefinition('triangle', 'Triangle', { title: 'Triangle' }),
  createShapeDefinition('arrow-sticker', 'Arrow', { title: 'Arrow' }),
  createShapeDefinition('callout', 'Callout', { text: 'Callout' }),
  createShapeDefinition('highlight', 'Highlight', { text: 'Highlight' })
]
