import { useEffect, useRef, useState } from 'react'
import { Whiteboard } from '@whiteboard/react'
import { createCore, type Document, type Plugin, type SchemaField } from '@whiteboard/core'
import { produce } from 'immer'
import './App.css'

const edgeStyleFields: SchemaField[] = [
  { id: 'stroke', label: 'Stroke', type: 'color', scope: 'style', path: 'stroke', defaultValue: '#2f2f33' },
  {
    id: 'strokeWidth',
    label: 'Stroke Width',
    type: 'number',
    scope: 'style',
    path: 'strokeWidth',
    min: 1,
    max: 12,
    step: 0.5,
    defaultValue: 2
  },
  { id: 'animated', label: 'Animated', type: 'boolean', scope: 'style', path: 'animated' },
  {
    id: 'animationSpeed',
    label: 'Animation Speed',
    type: 'number',
    scope: 'style',
    path: 'animationSpeed',
    min: 0.3,
    max: 3,
    step: 0.1,
    visibleIf: { scope: 'style', path: 'animated', equals: true }
  },
  {
    id: 'markerStart',
    label: 'Marker Start',
    type: 'enum',
    scope: 'style',
    path: 'markerStart',
    options: [
      { label: 'None', value: '' },
      { label: 'Arrow', value: 'arrow' }
    ]
  },
  {
    id: 'markerEnd',
    label: 'Marker End',
    type: 'enum',
    scope: 'style',
    path: 'markerEnd',
    options: [
      { label: 'None', value: '' },
      { label: 'Arrow', value: 'arrow' }
    ]
  }
]

const demoSchemaPlugin: Plugin = {
  manifest: { id: 'demo.schema', version: '0.1.0' },
  schemas: {
    nodes: [
      {
        type: 'rect',
        label: 'Rect',
        fields: [
          { id: 'title', label: 'Title', type: 'string', path: 'title', defaultValue: 'Rect' },
          { id: 'fill', label: 'Fill', type: 'color', scope: 'style', path: 'fill', defaultValue: '#ffffff' },
          { id: 'stroke', label: 'Stroke', type: 'color', scope: 'style', path: 'stroke', defaultValue: '#111827' },
          {
            id: 'strokeWidth',
            label: 'Stroke Width',
            type: 'number',
            scope: 'style',
            path: 'strokeWidth',
            min: 1,
            max: 6,
            step: 0.5,
            defaultValue: 1
          }
        ]
      },
      {
        type: 'text',
        label: 'Text',
        fields: [{ id: 'text', label: 'Text', type: 'text', path: 'text', defaultValue: '' }]
      },
      {
        type: 'sticky',
        label: 'Sticky',
        fields: [{ id: 'text', label: 'Text', type: 'text', path: 'text', defaultValue: '' }]
      },
      {
        type: 'group',
        label: 'Group',
        fields: [
          { id: 'title', label: 'Title', type: 'string', path: 'title', defaultValue: '' },
          { id: 'collapsed', label: 'Collapsed', type: 'boolean', path: 'collapsed', defaultValue: false }
        ]
      }
    ],
    edges: ['linear', 'step', 'polyline', 'bezier', 'curve', 'custom'].map((type) => ({
      type,
      label: type.toUpperCase(),
      fields: edgeStyleFields
    }))
  }
}

function App() {
  const [doc, setDoc] = useState<Document>(() => ({
    id: 'demo',
    nodes: [
      { id: 'n1', type: 'rect', position: { x: 120, y: 120 } },
      { id: 'n2', type: 'rect', position: { x: 420, y: 220 } },
      { id: 'n4', type: 'rect', position: { x: 120, y: 260 } },
      { id: 'n5', type: 'rect', position: { x: 420, y: 340 } },
      { id: 'n6', type: 'rect', position: { x: 120, y: 380 } },
      { id: 'n7', type: 'rect', position: { x: 420, y: 460 } },
      {
        id: 't1',
        type: 'text',
        position: { x: 700, y: 140 },
        size: { width: 220, height: 120 },
        data: { text: 'Text 节点\\n双击编辑' }
      },
      {
        id: 's1',
        type: 'sticky',
        position: { x: 700, y: 300 },
        size: { width: 220, height: 140 },
        data: { text: 'Sticky 便签\\n双击编辑' }
      },
      { id: 'n8', type: 'rect', position: { x: 720, y: 520 } },
      { id: 'n9', type: 'rect', position: { x: 980, y: 620 } },
      { id: 'n10', type: 'rect', position: { x: 720, y: 700 } },
      { id: 'n11', type: 'rect', position: { x: 980, y: 780 } },
      {
        id: 'g1',
        type: 'group',
        position: { x: 120, y: 560 },
        size: { width: 360, height: 240 },
        data: { title: 'Group', collapsed: false, autoFit: 'expand-only', padding: 24 }
      },
      { id: 'n3', type: 'rect', position: { x: 180, y: 620 }, parentId: 'g1' },
      {
        id: 't2',
        type: 'text',
        position: { x: 300, y: 660 },
        size: { width: 160, height: 90 },
        parentId: 'g1',
        data: { text: 'Group 里的文本' }
      },
      {
        id: 'mm1',
        type: 'mindmap',
        position: { x: 980, y: 120 },
        data: {
          mindmap: {
            id: 'mm1',
            rootId: 'mroot',
            nodes: {
              mroot: { id: 'mroot', data: { kind: 'text', text: 'Root' } },
              m1: { id: 'm1', parentId: 'mroot', side: 'left', data: { kind: 'text', text: 'Left' } },
              m2: { id: 'm2', parentId: 'mroot', side: 'right', data: { kind: 'text', text: 'Right' } },
              m3: { id: 'm3', parentId: 'm2', data: { kind: 'text', text: 'Child' } }
            },
            children: {
              mroot: ['m1', 'm2'],
              m1: [],
              m2: ['m3'],
              m3: []
            }
          }
        }
      }
    ],
    edges: [
      {
        id: 'e1',
        source: { nodeId: 'n1' },
        target: { nodeId: 'n2' },
        type: 'linear',
        style: { stroke: '#2563eb', markerEnd: 'arrow' }
      },
      {
        id: 'e2',
        source: { nodeId: 'n4' },
        target: { nodeId: 'n5' },
        type: 'step',
        style: { stroke: '#16a34a', dash: [8, 6] }
      },
      {
        id: 'e3',
        source: { nodeId: 'n6' },
        target: { nodeId: 'n7' },
        type: 'polyline',
        routing: {
          mode: 'manual',
          points: [
            { x: 260, y: 420 },
            { x: 260, y: 520 }
          ]
        },
        style: { stroke: '#f97316', dash: [10, 6], animated: true, animationSpeed: 1.0 }
      },
      {
        id: 'e4',
        source: { nodeId: 't1' },
        target: { nodeId: 's1' },
        type: 'bezier',
        style: { stroke: '#0ea5e9', markerStart: 'arrow', markerEnd: 'arrow' }
      },
      {
        id: 'e5',
        source: { nodeId: 'n8' },
        target: { nodeId: 'n9' },
        type: 'curve',
        style: { stroke: '#a855f7', dash: [6, 4], animated: true, animationSpeed: 1.4 }
      },
      {
        id: 'e6',
        source: { nodeId: 'n10' },
        target: { nodeId: 'n11' },
        type: 'custom',
        routing: {
          mode: 'manual',
          points: [
            { x: 840, y: 700 },
            { x: 840, y: 820 }
          ]
        },
        style: { stroke: '#111827', markerEnd: 'arrow' }
      }
    ],
    order: {
      nodes: [
        'n1',
        'n2',
        'n4',
        'n5',
        'n6',
        'n7',
        't1',
        's1',
        'n8',
        'n9',
        'n10',
        'n11',
        'g1',
        'n3',
        't2',
        'mm1'
      ],
      edges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']
    }
  }))
  const [tool, setTool] = useState<'select' | 'edge'>('select')
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const docRef = useRef(doc)
  const applyRef = useRef<(recipe: (draft: Document) => void) => void>(() => {})
  const coreRef = useRef(createCore({ getState: () => docRef.current, apply: (recipe) => applyRef.current(recipe) }))

  const handleDocChange = (recipe: (draft: Document) => void) => {
    setDoc((prev) => produce(prev, recipe))
  }

  useEffect(() => {
    docRef.current = doc
  }, [doc])

  useEffect(() => {
    applyRef.current = handleDocChange
  }, [handleDocChange])

  useEffect(() => {
    coreRef.current.plugins.use(demoSchemaPlugin)
  }, [])

  const core = coreRef.current

  const runHistoryCommand = (name: 'history.undo' | 'history.redo') => {
    const command = core.registries.commands.get(name)
    if (!command) return
    command()
  }

  return (
    <div className="app-root">
      <div className="toolbar">
        <span>模式：</span>
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
        >
          选择
        </button>
        <button
          className={tool === 'edge' ? 'active' : ''}
          onClick={() => setTool('edge')}
        >
          连线
        </button>
        <button
          onClick={() => runHistoryCommand('history.undo')}
          disabled={!historyState.canUndo}
        >
          撤销
        </button>
        <button
          onClick={() => runHistoryCommand('history.redo')}
          disabled={!historyState.canRedo}
        >
          重做
        </button>
        <button
          onClick={() => {

          }}
        >
          打印
        </button>
        <span className="toolbar-hint">
          双击/Shift+点击线条插点，选中折点后 Delete 删除
        </span>
      </div>
      <Whiteboard
        doc={doc}
        onDocChange={handleDocChange}
        core={core}
        config={{
          tool,
          onHistoryChange: (state) => {
            setHistoryState({
              canUndo: state.canUndo,
              canRedo: state.canRedo
            })
          }
        }}
      />
    </div>
  )
}

export default App
