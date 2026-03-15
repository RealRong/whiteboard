import { useEffect, useState } from 'react'
import {
  COLORS,
  FONT_SIZES
} from './ui'
import {
  hasSchemaField,
  readTextFieldKey,
  readTextValue
} from '../model'
import type { NodeToolbarActionContext } from '../types'
import {
  ColorSwatch,
  ToolbarChip,
  ToolbarChipRow,
  ToolbarMenuSection,
  updateNodeStyle
} from './ui'

export const TextMenu = ({
  instance,
  primaryNode,
  primarySchema
}: NodeToolbarActionContext) => {
  const showText = !primarySchema
    || hasSchemaField(primarySchema, 'data', 'text')
    || hasSchemaField(primarySchema, 'data', 'title')
  const showColor = !primarySchema || hasSchemaField(primarySchema, 'style', 'color')
  const showFontSize = !primarySchema || hasSchemaField(primarySchema, 'style', 'fontSize')
  const fieldKey = readTextFieldKey(primaryNode, primarySchema)
  const value = readTextValue(primaryNode, primarySchema)
  const [draft, setDraft] = useState(value)
  const color = typeof primaryNode.style?.color === 'string' ? primaryNode.style.color : '#111827'
  const fontSize = typeof primaryNode.style?.fontSize === 'number' ? primaryNode.style.fontSize : 14

  useEffect(() => {
    setDraft(value)
  }, [value])

  if (!showText && !showColor && !showFontSize) return null

  const commit = () => {
    if (draft === value) return
    void instance.commands.node.updateData(primaryNode.id, { [fieldKey]: draft })
  }

  return (
    <>
      {showText ? (
        <ToolbarMenuSection title="Text">
          <textarea
            className="wb-node-toolbar-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(value)
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                commit()
              }
            }}
            data-selection-ignore
            data-input-ignore
          />
        </ToolbarMenuSection>
      ) : null}
      {showColor ? (
        <ToolbarMenuSection title="Color">
          <div className="wb-node-toolbar-swatch-grid">
            {COLORS.map((nextColor) => (
              <ColorSwatch
                key={nextColor}
                color={nextColor}
                active={color === nextColor}
                onClick={() => {
                  void updateNodeStyle(instance, primaryNode, { color: nextColor })
                }}
              />
            ))}
          </div>
        </ToolbarMenuSection>
      ) : null}
      {showFontSize ? (
        <ToolbarMenuSection title="Size">
          <ToolbarChipRow>
            {FONT_SIZES.map((size) => (
              <ToolbarChip
                key={size}
                active={fontSize === size}
                onClick={() => {
                  void updateNodeStyle(instance, primaryNode, { fontSize: size })
                }}
              >
                {size}
              </ToolbarChip>
            ))}
          </ToolbarChipRow>
        </ToolbarMenuSection>
      ) : null}
    </>
  )
}
