import { useCallback, useEffect, useRef } from 'react'
import type { Pick } from '@whiteboard/editor'
import { useEditorRuntime } from './useEditor'

const toPickKey = (
  pick: Pick
) => {
  switch (pick.kind) {
    case 'background':
      return 'background'
    case 'selection-box':
      return [
        'selection-box',
        pick.part,
        pick.handle?.id ?? '',
        pick.handle?.direction ?? ''
      ].join(':')
    case 'node':
      return [
        'node',
        pick.id,
        pick.part,
        pick.handle?.id ?? '',
        pick.side ?? ''
      ].join(':')
    case 'edge':
      return [
        'edge',
        pick.id,
        pick.part,
        pick.end ?? '',
        pick.index ?? '',
        pick.insert ?? ''
      ].join(':')
    case 'mindmap':
      return [
        'mindmap',
        pick.treeId,
        pick.nodeId
      ].join(':')
  }
}

export const usePickRef = (
  pick: Pick
) => {
  const editor = useEditorRuntime()
  const elementRef = useRef<Element | null>(null)
  const releaseRef = useRef<(() => void) | null>(null)
  const key = toPickKey(pick)

  const bind = useCallback((element: Element | null) => {
    if (elementRef.current === element) {
      return
    }

    releaseRef.current?.()
    releaseRef.current = null
    elementRef.current = element

    if (element) {
      releaseRef.current = editor.pick.bind(element, pick)
    }
  }, [editor, key])

  useEffect(() => {
    const element = elementRef.current
    if (!element) {
      return
    }

    releaseRef.current?.()
    releaseRef.current = editor.pick.bind(element, pick)

    return () => {
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [editor, key])

  return bind
}
