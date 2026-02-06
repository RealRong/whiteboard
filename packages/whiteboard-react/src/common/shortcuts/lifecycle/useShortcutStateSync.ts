import { useEffect } from 'react'
import type { Viewport } from '@whiteboard/core'
import { useSetAtom } from 'jotai'
import { selectionAtom, viewportAtom } from '../../state/whiteboardAtoms'

type Options = {
  tool: string
  viewport: Viewport
}

export const useShortcutStateSync = ({ tool, viewport }: Options) => {
  const setSelection = useSetAtom(selectionAtom)
  const setViewport = useSetAtom(viewportAtom)

  useEffect(() => {
    setSelection((prev) => ({ ...prev, tool }))
  }, [setSelection, tool])

  useEffect(() => {
    setViewport((prev) => ({ ...prev, zoom: viewport.zoom }))
  }, [setViewport, viewport.zoom])
}
