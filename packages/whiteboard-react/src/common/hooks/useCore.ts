import { useRef } from 'react'
import { createCore, type Core, type Document } from '@whiteboard/core'

type UseCoreOptions = {
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  core?: Core
}

export const useCore = ({ doc, onDocChange, core }: UseCoreOptions) => {
  const docRef = useRef(doc)
  const onDocChangeRef = useRef(onDocChange)
  const coreRef = useRef<Core | null>(null)

  docRef.current = doc
  onDocChangeRef.current = onDocChange

  if (!coreRef.current) {
    coreRef.current =
      core ??
      createCore({
        getState: () => docRef.current,
        apply: (recipe) => onDocChangeRef.current(recipe)
      })
  }

  if (core && coreRef.current !== core) {
    coreRef.current = core
  }

  const instance = coreRef.current as Core
  return {
    core: instance,
    docRef
  }
}
