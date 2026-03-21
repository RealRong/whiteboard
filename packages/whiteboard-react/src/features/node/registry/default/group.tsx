import { useEffect, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { Node } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from '../../../../types/node'
import {
  useEdit,
  useInternalInstance
} from '../../../../runtime/hooks'
import {
  createSchema,
  createTextField,
  dataField,
  getDataBool,
  getDataString,
  getStyleString,
  styleField
} from './shared'

const groupSchema = createSchema('group', 'Group', [
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
])

type GroupNodeChromeProps = {
  node: Node
  updateData: (patch: Record<string, unknown>) => void
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onHeaderDoubleClick?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export const GroupNodeChrome = ({
  node,
  updateData,
  onHeaderPointerDown,
  onHeaderDoubleClick
}: GroupNodeChromeProps) => {
  const instance = useInternalInstance()
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
      updateData({ title: draft })
    }
    instance.commands.edit.clear()
  }

  const toggleCollapse = () => {
    updateData({ collapsed: !collapsed })
  }

  return (
    <>
      <div
        className="wb-default-group-header"
        onPointerDown={onHeaderPointerDown}
        onDoubleClick={onHeaderDoubleClick}
      >
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
            style={{ color }}
          >
            {title || 'Group'}
          </div>
        )}
      </div>
      {collapsed ? (
        <div className="wb-default-group-collapsed" style={{ color }}>
          Collapsed
        </div>
      ) : null}
    </>
  )
}

const GroupNodeRenderer = ({ updateData, node }: NodeRenderProps) => {
  return (
    <div className="wb-default-group">
      <GroupNodeChrome
        node={node}
        updateData={updateData}
      />
    </div>
  )
}

const groupStyle = (props: NodeRenderProps): CSSProperties => {
  const collapsed = getDataBool(props.node, 'collapsed')
  const borderColor = typeof props.node.style?.stroke === 'string'
    ? props.node.style.stroke
    : props.hovered
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
    boxShadow: 'none',
    color: getStyleString(props.node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))',
    display: 'block',
    paddingTop: 28,
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8
  }
}

export const GroupNodeDefinition: NodeDefinition = {
  type: 'group',
  meta: {
    name: 'Group',
    family: 'container',
    icon: 'group',
    controls: ['fill', 'stroke', 'group']
  },
  scene: 'container',
  schema: groupSchema,
  defaultData: { title: '', collapsed: false, autoFit: 'expand-only', padding: 24 },
  render: (props) => <GroupNodeRenderer {...props} />,
  style: groupStyle,
  canRotate: false
}
