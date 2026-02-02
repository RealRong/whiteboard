import { useEffect, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { Node } from '@whiteboard/core'
import type { NodeDefinition, NodeRenderProps, NodeRegistry } from './nodeRegistry'
import { createNodeRegistry } from './nodeRegistry'

const getDataString = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'string' ? value : ''
}

const getDataBool = (node: Node, key: string) => {
  const value = node.data && node.data[key]
  return typeof value === 'boolean' ? value : false
}

const setNodeData = (node: Node, patch: Record<string, unknown>) => {
  return { ...(node.data ?? {}), ...patch }
}

const TextNodeRenderer = ({
  core,
  node,
  selected,
  variant
}: NodeRenderProps & { variant: 'text' | 'sticky' }) => {
  const [editing, setEditing] = useState(false)
  const text = getDataString(node, 'text')
  const [draft, setDraft] = useState(text)

  useEffect(() => {
    setDraft(text)
  }, [text])

  const commit = () => {
    core.dispatch({
      type: 'node.update',
      id: node.id,
      patch: {
        data: setNodeData(node, { text: draft })
      }
    })
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
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  const content = editing ? (
    <textarea
      data-selection-ignore
      value={draft}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      onPointerDown={(event) => {
        event.stopPropagation()
      }}
      style={{
        width: '100%',
        height: '100%',
        resize: 'none',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: variant === 'sticky' ? 14 : 13,
        fontFamily: 'inherit',
        color: '#111827',
        lineHeight: 1.4
      }}
    />
  ) : (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: variant === 'sticky' ? 14 : 13,
        lineHeight: 1.4,
        color: '#111827',
        opacity: selected ? 1 : 0.9
      }}
    >
      {text || (variant === 'sticky' ? 'Sticky' : 'Text')}
    </div>
  )

  return content
}

const GroupNodeRenderer = ({ core, node }: NodeRenderProps) => {
  const title = getDataString(node, 'title')
  const collapsed = getDataBool(node, 'collapsed')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  useEffect(() => {
    setDraft(title)
  }, [title])

  const commit = () => {
    core.dispatch({
      type: 'node.update',
      id: node.id,
      patch: {
        data: setNodeData(node, { title: draft })
      }
    })
    setEditing(false)
  }

  const toggleCollapse = () => {
    core.dispatch({
      type: 'node.update',
      id: node.id,
      patch: {
        data: setNodeData(node, { collapsed: !collapsed })
      }
    })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        data-selection-ignore
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          right: 6,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: '#0f172a',
          userSelect: 'none'
        }}
      >
        <div
          data-selection-ignore
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            toggleCollapse()
          }}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: '1px solid #94a3b8',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            cursor: 'pointer'
          }}
        >
          {collapsed ? '+' : '-'}
        </div>
        {editing ? (
          <input
            data-selection-ignore
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
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 12,
              flex: 1
            }}
          />
        ) : (
          <div
            onDoubleClick={(event) => {
              event.stopPropagation()
              setEditing(true)
            }}
            style={{ flex: 1, cursor: 'text' }}
          >
            {title || 'Group'}
          </div>
        )}
      </div>
      {collapsed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#64748b'
          }}
        >
          Collapsed
        </div>
      )}
    </div>
  )
}

const createTextStyle = (variant: 'text' | 'sticky') => (props: NodeRenderProps): CSSProperties => {
  const background =
    variant === 'sticky'
      ? (props.node.data && typeof props.node.data.background === 'string' ? props.node.data.background : '#fef3c7')
      : 'transparent'
  const border =
    variant === 'sticky'
      ? '1px solid rgba(250, 204, 21, 0.6)'
      : props.selected
        ? '1px solid rgba(59, 130, 246, 0.6)'
        : '1px solid rgba(148, 163, 184, 0.4)'
  return {
    background,
    border,
    borderRadius: variant === 'sticky' ? 10 : 8,
    boxShadow: props.selected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
    display: 'block',
    padding: variant === 'sticky' ? '16px' : '12px',
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

const createDefaultNodes = (): NodeDefinition[] => [
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
    getStyle: createTextStyle('text')
  },
  {
    type: 'sticky',
    label: 'Sticky',
    defaultData: { text: '' },
    render: (props) => <TextNodeRenderer {...props} variant="sticky" />,
    getStyle: createTextStyle('sticky')
  },
  {
    type: 'group',
    label: 'Group',
    defaultData: { title: '', collapsed: false, autoFit: 'expand-only', padding: 24 },
    render: (props) => <GroupNodeRenderer {...props} />,
    getStyle: groupStyle,
    canRotate: false
  }
]

export const createDefaultNodeRegistry = () => {
  const registry: NodeRegistry = createNodeRegistry()
  createDefaultNodes().forEach((definition) => registry.register(definition))
  return registry
}

export const getNodeDefinitionStyle = (definition: NodeDefinition | undefined, props: NodeRenderProps): CSSProperties => {
  if (!definition?.getStyle) return {}
  return definition.getStyle(props)
}

export const renderNodeDefinition = (definition: NodeDefinition | undefined, props: NodeRenderProps): ReactNode => {
  if (!definition) return props.node.type
  return definition.render(props)
}
