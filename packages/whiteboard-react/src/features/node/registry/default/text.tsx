import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { NodeDefinition, NodeRenderProps } from '../../../../types/node'
import {
  useEdit,
  useInternalInstance
} from '../../../../runtime/hooks'
import { useAutoFontSize } from '../../hooks/useAutoFontSize'
import {
  clearNodeSessionPatch,
  writeNodeSessionPatch
} from '../../session/node'
import {
  createSchema,
  createTextField,
  focusEditableEnd,
  getStyleNumber,
  getStyleString,
  measureTextSizeFromSource,
  readEditableText,
  styleField
} from './shared'

const textSchema = createSchema('text', 'Text', [
  createTextField('text'),
  styleField('color', 'Text color', 'color'),
  styleField('fontSize', 'Font size', 'number', { min: 8, step: 1 })
])

const stickySchema = createSchema('sticky', 'Sticky', [
  createTextField('text'),
  styleField('fill', 'Fill', 'color'),
  styleField('color', 'Text color', 'color'),
  styleField('fontSize', 'Font size', 'number', { min: 8, step: 1 }),
  styleField('stroke', 'Stroke', 'color'),
  styleField('strokeWidth', 'Stroke width', 'number', { min: 0, step: 1 })
])

const TEXT_MIN_WIDTH = 24
const TEXT_MAX_WIDTH = 640
type TextSize = {
  width: number
  height: number
}

const isSameSize = (
  left: TextSize | null | undefined,
  right: TextSize | null | undefined
) => (
  left?.width === right?.width
  && left?.height === right?.height
)

const measureTextSize = ({
  content,
  placeholder,
  source,
  maxWidth
}: {
  content: string
  placeholder: string
  source: HTMLDivElement
  maxWidth: number
}): TextSize | undefined => {
  return measureTextSizeFromSource({
    content,
    placeholder,
    source,
    minWidth: TEXT_MIN_WIDTH,
    maxWidth
  })
}

const TextNodeRenderer = ({
  update,
  updateData,
  node,
  rect,
  selected,
  variant
}: NodeRenderProps & { variant: 'text' | 'sticky' }) => {
  const instance = useInternalInstance()
  const edit = useEdit()
  const editing = edit?.nodeId === node.id && edit.field === 'text'
  const text = typeof node.data?.text === 'string' ? node.data.text : ''
  const [draft, setDraft] = useState(text)
  const isSticky = variant === 'sticky'
  const sourceRef = useRef<HTMLDivElement | null>(null)
  const previewSizeRef = useRef<TextSize | null>(null)
  const setSourceRef = (element: HTMLDivElement | null) => {
    sourceRef.current = element
  }
  const manualFontSize = getStyleNumber(node, 'fontSize')
  const placeholder = isSticky ? 'Sticky' : 'Text'
  const displayFontSize = useAutoFontSize({
    text,
    placeholder,
    rect,
    variant,
    manualFontSize,
    sourceRef
  })
  const [editingFontSize, setEditingFontSize] = useState<number | null>(null)
  const fontSize = isSticky && editing
    ? (editingFontSize ?? displayFontSize)
    : displayFontSize
  const color = getStyleString(node, 'color') ?? 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const committedRect = instance.engine.read.node.item.get(node.id)?.rect ?? rect

  const writeTextPreview = useCallback((nextSize: TextSize | null) => {
    if (isSticky || isSameSize(previewSizeRef.current, nextSize)) {
      return
    }

    previewSizeRef.current = nextSize
    writeNodeSessionPatch(
      instance.internals.node.session,
      node.id,
      nextSize ? { size: nextSize } : undefined
    )
    instance.internals.node.session.flush()
  }, [instance, isSticky, node.id])

  const clearTextPreview = useCallback(() => {
    if (isSticky || previewSizeRef.current === null) {
      return
    }

    previewSizeRef.current = null
    clearNodeSessionPatch(instance.internals.node.session, node.id)
    instance.internals.node.session.flush()
  }, [instance, isSticky, node.id])

  const resolveTextSize = (content: string) => {
    if (isSticky) {
      return undefined
    }

    const source = sourceRef.current
    if (!source) {
      return previewSizeRef.current ?? {
        width: rect.width,
        height: rect.height
      }
    }

    return measureTextSize({
      content,
      placeholder,
      source,
      maxWidth: Math.max(TEXT_MAX_WIDTH, rect.width)
    }) ?? previewSizeRef.current ?? {
      width: rect.width,
      height: rect.height
    }
  }

  useEffect(() => {
    setDraft(text)
  }, [text])

  useEffect(() => {
    if (!isSticky || !editing) {
      setEditingFontSize(null)
      return
    }

    setEditingFontSize((current) => current ?? displayFontSize)
  }, [displayFontSize, editing, isSticky])

  useEffect(() => {
    if (!editing) {
      return
    }

    const element = sourceRef.current
    if (!element) {
      return
    }

    if (readEditableText(element) !== draft) {
      element.textContent = draft
    }
  }, [draft, editing])

  useEffect(() => {
    if (!editing) {
      return
    }

    const element = sourceRef.current
    if (!element) {
      return
    }

    if (readEditableText(element) !== draft) {
      element.textContent = draft
    }

    const frame = requestAnimationFrame(() => {
      focusEditableEnd(element)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [editing])

  useLayoutEffect(() => {
    if (!editing || isSticky) {
      clearTextPreview()
      return
    }

    const source = sourceRef.current
    if (!source) {
      return
    }

    const nextSize = measureTextSize({
      content: draft,
      placeholder,
      source,
      maxWidth: Math.max(TEXT_MAX_WIDTH, rect.width)
    })

    if (nextSize) {
      writeTextPreview(nextSize)
    }
  }, [clearTextPreview, draft, editing, isSticky, placeholder, rect.width, writeTextPreview])

  useEffect(() => () => {
    if (previewSizeRef.current === null || isSticky) {
      return
    }

    previewSizeRef.current = null
    clearNodeSessionPatch(instance.internals.node.session, node.id)
    instance.internals.node.session.flush()
  }, [instance, isSticky, node.id])

  const commit = (nextDraft = draft) => {
    if (isSticky) {
      if (nextDraft !== text) {
        updateData({ text: nextDraft })
      }
      instance.commands.edit.clear()
      return
    }

    const nextSize = resolveTextSize(nextDraft)
    const patch: Record<string, unknown> = {}

    if (nextDraft !== text) {
      patch.data = {
        ...(node.data ?? {}),
        text: nextDraft
      }
    }

    if (!isSameSize(nextSize, committedRect)) {
      patch.size = nextSize
    }

    if (Object.keys(patch).length) {
      update(patch)
    }

    clearTextPreview()
    instance.commands.edit.clear()
  }

  const cancel = () => {
    setDraft(text)
    clearTextPreview()
    instance.commands.edit.clear()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit(readEditableText(event.currentTarget))
    }
  }

  if (editing) {
    return (
      <div
        data-selection-ignore
        data-input-ignore
        className={`wb-default-text-display wb-default-text-editor${isSticky ? ' wb-default-text-sticky' : ''}`}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        spellCheck={false}
        ref={setSourceRef}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onInput={(event) => {
          setDraft(readEditableText(event.currentTarget))
        }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          commit(readEditableText(event.currentTarget))
        }}
        style={{
          fontSize,
          color,
          '--wb-sticky-fill': isSticky
            ? (typeof node.style?.fill === 'string'
                ? node.style.fill
                : (
                    node.data && typeof node.data.background === 'string'
                      ? node.data.background
                      : 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))'
                  ))
            : undefined
        } as CSSProperties}
      />
    )
  }

  return (
    <div
      className={`wb-default-text-display${isSticky ? ' wb-default-text-sticky' : ''}`}
      data-node-editable-field="text"
      ref={setSourceRef}
      style={{
        fontSize,
        color,
        opacity: selected ? 1 : 0.9,
        '--wb-sticky-fill': isSticky
          ? (typeof node.style?.fill === 'string'
              ? node.style.fill
              : (
                  node.data && typeof node.data.background === 'string'
                    ? node.data.background
                    : 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))'
                ))
          : undefined
      }}
    >
      {text || placeholder}
    </div>
  )
}

const createTextStyle = (variant: 'text' | 'sticky') => (props: NodeRenderProps): CSSProperties => {
  const isSticky = variant === 'sticky'
  if (!isSticky) {
    return {
      background: 'transparent',
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      boxSizing: 'border-box',
      display: 'block',
      overflow: 'visible',
      padding: 0,
      textAlign: 'left'
    }
  }

  return {
    background: 'transparent',
    border: 'none',
    boxSizing: 'border-box',
    borderRadius: 0,
    boxShadow: props.selected
      ? '0 0 0 2px hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.2)'
      : 'none',
    display: 'block',
    overflow: 'visible',
    padding: 0,
    textAlign: 'left'
  }
}

export const TextNodeDefinition: NodeDefinition = {
  type: 'text',
  label: 'Text',
  schema: textSchema,
  defaultData: { text: '' },
  render: (props) => <TextNodeRenderer {...props} variant="text" />,
  style: createTextStyle('text')
}

export const StickyNodeDefinition: NodeDefinition = {
  type: 'sticky',
  label: 'Sticky',
  schema: stickySchema,
  defaultData: { text: '' },
  render: (props) => <TextNodeRenderer {...props} variant="sticky" />,
  style: createTextStyle('sticky')
}
