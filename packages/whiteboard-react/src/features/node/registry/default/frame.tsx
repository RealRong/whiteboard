import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { CSSProperties } from 'react'
import type { Node } from '@whiteboard/core/types'
import type { NodeDefinition, NodeWrite } from '../../../../types/node'
import {
  useEdit,
  useInternalInstance,
  usePickRef
} from '../../../../runtime/hooks'
import {
  FRAME_DEFAULT_FILL,
  FRAME_DEFAULT_STROKE,
  FRAME_DEFAULT_STROKE_WIDTH,
  FRAME_DEFAULT_TEXT_COLOR,
  FRAME_DEFAULT_TITLE
} from '../../frame'
import {
  createSchema,
  createTextField,
  getDataString,
  getStyleNumber,
  getStyleString,
  styleField
} from './shared'

const frameSchema = createSchema('frame', 'Frame', [
  createTextField('title'),
  styleField('fill', 'Fill', 'color', {
    defaultValue: FRAME_DEFAULT_FILL
  }),
  styleField('stroke', 'Stroke', 'color', {
    defaultValue: FRAME_DEFAULT_STROKE
  }),
  styleField('strokeWidth', 'Stroke width', 'number', {
    min: 0,
    step: 1,
    defaultValue: FRAME_DEFAULT_STROKE_WIDTH
  }),
  styleField('color', 'Text color', 'color', {
    defaultValue: FRAME_DEFAULT_TEXT_COLOR
  })
])

type FrameNodeChromeProps = {
  node: Node
  write: Pick<NodeWrite, 'data'>
  onDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export const FrameNodeChrome = ({
  node,
  write,
  onDoubleClick
}: FrameNodeChromeProps) => {
  const instance = useInternalInstance()
  const edit = useEdit()
  const title = getDataString(node, 'title') || FRAME_DEFAULT_TITLE
  const editing = edit?.nodeId === node.id && edit.field === 'title'
  const [draft, setDraft] = useState(title)
  const color = getStyleString(node, 'color') ?? FRAME_DEFAULT_TEXT_COLOR
  const headerRef = usePickRef({
    kind: 'node',
    id: node.id,
    part: 'shell'
  })

  useEffect(() => {
    setDraft(title)
  }, [title])

  const commit = () => {
    const nextTitle = draft.trim() || FRAME_DEFAULT_TITLE
    if (nextTitle !== title) {
      write.data({ title: nextTitle })
    }
    instance.commands.edit.clear()
  }

  return (
    <div
      ref={headerRef}
      className="wb-frame-header"
      onDoubleClick={onDoubleClick}
    >
      {editing ? (
        <input
          data-selection-ignore
          data-input-ignore
          value={draft}
          autoFocus
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
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
          className="wb-frame-input"
          style={{ color }}
        />
      ) : (
        <div
          className="wb-frame-title"
          data-node-editable-field="title"
          style={{ color }}
        >
          {title}
        </div>
      )}
    </div>
  )
}

const frameStyle = (node: Node): CSSProperties => {
  const stroke = getStyleString(node, 'stroke') ?? FRAME_DEFAULT_STROKE
  const strokeWidth = getStyleNumber(node, 'strokeWidth') ?? FRAME_DEFAULT_STROKE_WIDTH
  const fill = getStyleString(node, 'fill') ?? FRAME_DEFAULT_FILL

  return {
    background: fill,
    border: `${strokeWidth}px solid ${stroke}`,
    borderRadius: 12,
    boxShadow: 'none',
    display: 'block'
  }
}

export const FrameNodeDefinition: NodeDefinition = {
  type: 'frame',
  meta: {
    name: 'Frame',
    family: 'container',
    icon: 'frame',
    controls: ['fill', 'stroke', 'text']
  },
  role: 'frame',
  schema: frameSchema,
  defaultData: {
    title: FRAME_DEFAULT_TITLE
  },
  render: () => null,
  style: (props) => frameStyle(props.node),
  canRotate: false,
  enter: true
}
