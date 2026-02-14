import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import type { Document } from '@whiteboard/core'
import { docAtom, instanceAtom, type WhiteboardInstance } from '@whiteboard/engine'

export const useWhiteboardContextHydration = (doc: Document, instance: WhiteboardInstance) => {
  useHydrateAtoms([
    [docAtom, doc],
    [instanceAtom, instance]
  ])

  const setDoc = useSetAtom(docAtom)
  const setInstance = useSetAtom(instanceAtom)

  useEffect(() => {
    setDoc(doc)
  }, [doc, setDoc])

  useEffect(() => {
    setInstance(instance)
  }, [instance, setInstance])
}
