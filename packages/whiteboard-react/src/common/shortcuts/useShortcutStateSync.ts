import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import type { Viewport } from '@whiteboard/core'
import { setSelectionAtom, updateViewportAtom } from '../state/whiteboardAtoms'

type Options = {
  tool: string
  viewport: Viewport
}

export const useShortcutStateSync = ({ tool, viewport }: Options) => {
  const setSelection = useSetAtom(setSelectionAtom)
  const updateViewport = useSetAtom(updateViewportAtom)

  useEffect(() => {
    setSelection((prev) => {
      if (prev.tool === tool) return prev
      return { ...prev, tool }
    })
  }, [setSelection, tool])

  useEffect(() => {
    updateViewport({ zoom: viewport.zoom })
  }, [updateViewport, viewport.zoom])
}
