import { useEffect } from 'react'
import type { Viewport } from '@whiteboard/core'
import { useSetAtom } from 'jotai'
import { setSelectionAtom, updateViewportAtom } from '../../state/whiteboardAtoms'

type Options = {
  tool: string
  viewport: Viewport
}

export const useShortcutStateSync = ({ tool, viewport }: Options) => {
  const setSelection = useSetAtom(setSelectionAtom)
  const updateViewport = useSetAtom(updateViewportAtom)

  useEffect(() => {
    setSelection((prev) => ({ ...prev, tool }))
  }, [setSelection, tool])

  useEffect(() => {
    updateViewport({ zoom: viewport.zoom })
  }, [updateViewport, viewport.zoom])
}
