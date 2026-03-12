import { useEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Node } from '@whiteboard/core/types'
import type { NodeDefinition, NodeRenderProps } from 'types/node'
import { createNodeRegistry } from './nodeRegistry'

const getDataString = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'string' ? value : ''
}

const getDataBool = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'boolean' ? value : false
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
  const fontSize = isSticky ? 14 : 13

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
        style={{ fontSize }}
      />
    )
  }

  return (
    <div
      className="wb-default-text-display"
      onDoubleClick={() => setEditing(true)}
      style={{
        fontSize,
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
          />
        ) : (
          <div
            className="wb-default-group-title"
            onDoubleClick={() => setEditing(true)}
          >
            {title || 'Group'}
          </div>
        )}
      </div>
      {collapsed && (
        <div className="wb-default-group-collapsed">
          Collapsed
        </div>
      )}
    </div>
  )
}

const createTextStyle = (variant: 'text' | 'sticky') => (props: NodeRenderProps): CSSProperties => {
  const isSticky = variant === 'sticky'
  const background = isSticky
    ? (props.node.data && typeof props.node.data.background === 'string'
      ? props.node.data.background
      : '#fef3c7')
    : 'transparent'
  const border =
    isSticky
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
    border: `${width}px solid ${stroke}`
  }
}

const groupStyle = (props: NodeRenderProps): CSSProperties => {
  const hovered = props.hovered
  const collapsed = getDataBool(props.node, 'collapsed')
  const borderColor = hovered ? '#2563eb' : props.selected ? '#3b82f6' : '#94a3b8'
  return {
    background: collapsed ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.06)',
    border: `1px dashed ${borderColor}`,
    boxShadow: props.selected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
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
    render: ({ node }) => getDataString(node, 'title') || node.type,
    getStyle: rectStyle
  },
  {
    type: 'text',
    label: 'Text',
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="text" />,
    getStyle: createTextStyle('text'),
    autoMeasure: true
  },
  {
    type: 'sticky',
    label: 'Sticky',
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="sticky" />,
    getStyle: createTextStyle('sticky'),
    autoMeasure: true
  },
  {
    type: 'group',
    label: 'Group',
    defaultData: { title: '', collapsed: false, autoFit: 'expand-only', padding: 24 },
    render: (props) => <GroupNodeRenderer {...props} />,
    getStyle: groupStyle,
    canRotate: false,
    autoMeasure: true
  }
]

export const createDefaultNodeRegistry = () => createNodeRegistry(DEFAULT_NODE_DEFINITIONS)
