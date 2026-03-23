import type { CSSProperties, ReactNode } from 'react'
import {
  isShapeKind,
  readShapeKind,
  type ShapeKind
} from '@whiteboard/core/node'
import type { Node, NodeInput } from '@whiteboard/core/types'
import type { NodeMeta } from '../../types/node'
export {
  isShapeKind,
  readShapeKind,
  type ShapeKind
} from '@whiteboard/core/node'

export type ShapeGroup = 'basic' | 'flowchart' | 'annotation'

type ShapeLabelInset = Pick<
  CSSProperties,
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
>

export type ShapeSpec = {
  kind: ShapeKind
  label: string
  group: ShapeGroup
  defaultSize: {
    width: number
    height: number
  }
  defaultText: string
  defaults: {
    fill: string
    stroke: string
    color: string
  }
  previewFill?: string
  labelInset: ShapeLabelInset
}

type ShapeColors = {
  fill: string
  stroke: string
  strokeWidth: number
}

const DEFAULT_FILL = 'hsl(var(--ui-surface, 0 0% 100%))'
const DEFAULT_STROKE = 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
const DEFAULT_TEXT = 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
const BLUE_FILL = 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))'
const BLUE_STROKE = 'hsl(var(--tag-blue-foreground, 211.4 57.3% 50.4%))'
const YELLOW_FILL = 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%) / 0.9)'
const YELLOW_STROKE = 'hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%) / 0.72)'
const PREVIEW_FILL = 'var(--wb-toolbar-preview-fill)'
const PREVIEW_FILL_BLUE = 'var(--wb-toolbar-preview-fill-blue)'
const PREVIEW_FILL_YELLOW_SOFT = 'var(--wb-toolbar-preview-fill-yellow-soft)'

const SHAPE_META_CONTROLS = ['fill', 'stroke', 'text'] as const
const DEFAULT_SHAPE_KIND: ShapeKind = 'rect'

export const SHAPE_SPECS: readonly ShapeSpec[] = [
  {
    kind: 'rect',
    label: 'Rectangle',
    group: 'basic',
    defaultSize: { width: 180, height: 100 },
    defaultText: 'Rectangle',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16
    }
  },
  {
    kind: 'rounded-rect',
    label: 'Rounded',
    group: 'basic',
    defaultSize: { width: 180, height: 100 },
    defaultText: 'Rounded',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: 16,
      right: 18,
      bottom: 16,
      left: 18
    }
  },
  {
    kind: 'pill',
    label: 'Terminator',
    group: 'flowchart',
    defaultSize: { width: 200, height: 100 },
    defaultText: 'Start',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: 20,
      right: 28,
      bottom: 20,
      left: 28
    }
  },
  {
    kind: 'ellipse',
    label: 'Ellipse',
    group: 'basic',
    defaultSize: { width: 180, height: 110 },
    defaultText: 'Ellipse',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '20%',
      right: '18%',
      bottom: '20%',
      left: '18%'
    }
  },
  {
    kind: 'diamond',
    label: 'Diamond',
    group: 'basic',
    defaultSize: { width: 180, height: 120 },
    defaultText: 'Decision',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '22%',
      right: '24%',
      bottom: '22%',
      left: '24%'
    }
  },
  {
    kind: 'triangle',
    label: 'Triangle',
    group: 'basic',
    defaultSize: { width: 180, height: 130 },
    defaultText: 'Triangle',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '34%',
      right: '20%',
      bottom: 18,
      left: '20%'
    }
  },
  {
    kind: 'hexagon',
    label: 'Hexagon',
    group: 'basic',
    defaultSize: { width: 190, height: 110 },
    defaultText: 'Hexagon',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: 16,
      right: '18%',
      bottom: 16,
      left: '18%'
    }
  },
  {
    kind: 'parallelogram',
    label: 'Data',
    group: 'flowchart',
    defaultSize: { width: 200, height: 110 },
    defaultText: 'Input / Output',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '14%',
      right: '21%',
      bottom: '14%',
      left: '21%'
    }
  },
  {
    kind: 'cylinder',
    label: 'Database',
    group: 'flowchart',
    defaultSize: { width: 180, height: 130 },
    defaultText: 'Database',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '20%',
      right: '16%',
      bottom: '18%',
      left: '16%'
    }
  },
  {
    kind: 'document',
    label: 'Document',
    group: 'flowchart',
    defaultSize: { width: 190, height: 130 },
    defaultText: 'Document',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '12%',
      right: '12%',
      bottom: '22%',
      left: '12%'
    }
  },
  {
    kind: 'predefined-process',
    label: 'Subprocess',
    group: 'flowchart',
    defaultSize: { width: 210, height: 110 },
    defaultText: 'Subprocess',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '14%',
      right: '22%',
      bottom: '14%',
      left: '22%'
    }
  },
  {
    kind: 'callout',
    label: 'Callout',
    group: 'annotation',
    defaultSize: { width: 240, height: 140 },
    defaultText: 'Callout',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '12%',
      right: '12%',
      bottom: '24%',
      left: '12%'
    }
  },
  {
    kind: 'cloud',
    label: 'Cloud',
    group: 'annotation',
    defaultSize: { width: 220, height: 140 },
    defaultText: 'Cloud',
    defaults: {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL,
    labelInset: {
      top: '22%',
      right: '16%',
      bottom: '18%',
      left: '16%'
    }
  },
  {
    kind: 'arrow-sticker',
    label: 'Arrow',
    group: 'annotation',
    defaultSize: { width: 220, height: 110 },
    defaultText: 'Arrow',
    defaults: {
      fill: BLUE_FILL,
      stroke: BLUE_STROKE,
      color: BLUE_STROKE
    },
    previewFill: PREVIEW_FILL_BLUE,
    labelInset: {
      top: '14%',
      right: '40%',
      bottom: '14%',
      left: '10%'
    }
  },
  {
    kind: 'highlight',
    label: 'Highlight',
    group: 'annotation',
    defaultSize: { width: 220, height: 90 },
    defaultText: 'Highlight',
    defaults: {
      fill: YELLOW_FILL,
      stroke: YELLOW_STROKE,
      color: DEFAULT_TEXT
    },
    previewFill: PREVIEW_FILL_YELLOW_SOFT,
    labelInset: {
      top: '18%',
      right: '10%',
      bottom: '18%',
      left: '10%'
    }
  }
] as const

const SHAPE_SPEC_BY_KIND = new Map(
  SHAPE_SPECS.map((spec) => [spec.kind, spec] as const)
)

const SHAPE_MIN = 3
const SHAPE_MAX = 97
const SHAPE_MID = 50

const readShapeStrokeLinecap = (
  kind: ShapeKind
): 'round' | 'butt' => kind === 'cloud' || kind === 'highlight' ? 'round' : 'butt'

const renderShapeGraphic = (
  kind: ShapeKind,
  colors: ShapeColors
): ReactNode => {
  const common = {
    fill: colors.fill,
    stroke: colors.stroke,
    strokeWidth: colors.strokeWidth,
    strokeLinejoin: 'round' as const,
    strokeLinecap: readShapeStrokeLinecap(kind)
  }

  switch (kind) {
    case 'rect':
      return <rect x={SHAPE_MIN} y={SHAPE_MIN} width={SHAPE_MAX - SHAPE_MIN} height={SHAPE_MAX - SHAPE_MIN} rx="2" {...common} />
    case 'rounded-rect':
      return <rect x={SHAPE_MIN} y={SHAPE_MIN} width={SHAPE_MAX - SHAPE_MIN} height={SHAPE_MAX - SHAPE_MIN} rx="14" {...common} />
    case 'pill':
      return <rect x={SHAPE_MIN} y={SHAPE_MIN} width={SHAPE_MAX - SHAPE_MIN} height={SHAPE_MAX - SHAPE_MIN} rx="48" {...common} />
    case 'ellipse':
      return <ellipse cx={SHAPE_MID} cy={SHAPE_MID} rx="47" ry="47" {...common} />
    case 'diamond':
      return <polygon points={`${SHAPE_MID},${SHAPE_MIN} ${SHAPE_MAX},${SHAPE_MID} ${SHAPE_MID},${SHAPE_MAX} ${SHAPE_MIN},${SHAPE_MID}`} {...common} />
    case 'triangle':
      return <polygon points={`${SHAPE_MID},${SHAPE_MIN} ${SHAPE_MAX},${SHAPE_MAX} ${SHAPE_MIN},${SHAPE_MAX}`} {...common} />
    case 'hexagon':
      return <polygon points={`22,${SHAPE_MIN} 78,${SHAPE_MIN} ${SHAPE_MAX},${SHAPE_MID} 78,${SHAPE_MAX} 22,${SHAPE_MAX} ${SHAPE_MIN},${SHAPE_MID}`} {...common} />
    case 'parallelogram':
      return <polygon points={`20,${SHAPE_MIN} ${SHAPE_MAX},${SHAPE_MIN} 80,${SHAPE_MAX} ${SHAPE_MIN},${SHAPE_MAX}`} {...common} />
    case 'cylinder':
      return (
        <>
          <path
            d="M10 14 C10 4 90 4 90 14 V86 C90 96 10 96 10 86 Z"
            {...common}
          />
          <ellipse cx={SHAPE_MID} cy="14" rx="40" ry="10" {...common} />
          <path
            d="M10 86 C10 76 90 76 90 86"
            fill="none"
            stroke={colors.stroke}
            strokeWidth={colors.strokeWidth}
            strokeLinecap="round"
          />
        </>
      )
    case 'document':
      return (
        <path
          d="M3 3 H97 V84 C84 96 68 74 50 84 C32 96 16 74 3 84 Z"
          {...common}
        />
      )
    case 'predefined-process':
      return (
        <>
          <rect x={SHAPE_MIN} y={SHAPE_MIN} width={SHAPE_MAX - SHAPE_MIN} height={SHAPE_MAX - SHAPE_MIN} rx="2" {...common} />
          <path
            d={`M18 ${SHAPE_MIN} V${SHAPE_MAX} M82 ${SHAPE_MIN} V${SHAPE_MAX}`}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={colors.strokeWidth}
          />
        </>
      )
    case 'callout':
      return (
        <path
          d="M9 4 H91 C95 4 97 8 97 13 V71 C97 78 92 82 86 82 H58 L35 97 L40 82 H14 C8 82 3 78 3 71 V13 C3 8 5 4 9 4 Z"
          {...common}
        />
      )
    case 'cloud':
      return (
        <path
          d="M23 86 H76 C88 86 97 77 97 65 C97 53 89 44 77 43 C74 27 62 17 50 17 C39 17 29 23 23 33 C11 33 3 42 3 53 C3 65 12 75 23 75 C22 81 22 84 23 86 Z"
          {...common}
        />
      )
    case 'arrow-sticker':
      return (
        <polygon
          points={`3,25 58,25 58,4 97,50 58,96 58,75 3,75`}
          {...common}
        />
      )
    case 'highlight':
      return (
        <>
          <rect x="3" y="22" width="94" height="56" rx="18" {...common} />
          <path
            d="M8 79 C25 89 41 69 57 79 S83 89 96 78"
            fill="none"
            stroke={colors.stroke}
            strokeWidth={Math.max(1, colors.strokeWidth - 0.2)}
            strokeLinecap="round"
          />
        </>
      )
  }
}

export const readShapeSpec = (
  kind: ShapeKind | undefined
): ShapeSpec => SHAPE_SPEC_BY_KIND.get(kind ?? DEFAULT_SHAPE_KIND) ?? SHAPE_SPEC_BY_KIND.get(DEFAULT_SHAPE_KIND)!

export const readShapeMeta = (
  node: Pick<Node, 'data'>
): NodeMeta => {
  const spec = readShapeSpec(readShapeKind(node))

  return {
    key: `shape:${spec.kind}`,
    name: spec.label,
    family: 'shape',
    icon: spec.kind,
    controls: SHAPE_META_CONTROLS
  }
}

export const createShapeNodeInput = (
  kind: ShapeKind
): Omit<NodeInput, 'position'> => {
  const spec = readShapeSpec(kind)

  return {
    type: 'shape',
    size: { ...spec.defaultSize },
    data: {
      kind,
      text: spec.defaultText
    },
    style: {
      fill: spec.defaults.fill,
      stroke: spec.defaults.stroke,
      strokeWidth: 1,
      color: spec.defaults.color
    }
  }
}

export const SHAPE_MENU_SECTIONS: readonly {
  key: ShapeGroup
  title: string
  items: readonly ShapeSpec[]
}[] = [
  {
    key: 'basic',
    title: 'Basic',
    items: SHAPE_SPECS.filter((spec) => spec.group === 'basic')
  },
  {
    key: 'flowchart',
    title: 'Flowchart',
    items: SHAPE_SPECS.filter((spec) => spec.group === 'flowchart')
  },
  {
    key: 'annotation',
    title: 'Annotation',
    items: SHAPE_SPECS.filter((spec) => spec.group === 'annotation')
  }
] as const

export const ShapeGlyph = ({
  kind,
  size,
  width,
  height,
  strokeWidth = 1.5,
  fill = 'none',
  stroke = 'currentColor',
  className
}: {
  kind: ShapeKind
  size?: number
  width?: number | string
  height?: number | string
  strokeWidth?: number
  fill?: string
  stroke?: string
  className?: string
}) => (
  <svg
    viewBox="0 0 100 100"
    width={width ?? size}
    height={height ?? size ?? width}
    preserveAspectRatio="none"
    aria-hidden="true"
    className={className}
    fill="none"
  >
    {renderShapeGraphic(kind, {
      fill,
      stroke,
      strokeWidth
    })}
  </svg>
)

export const readShapePreviewFill = (
  kind: ShapeKind
): string => readShapeSpec(kind).previewFill ?? PREVIEW_FILL
