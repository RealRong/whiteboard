import { useHydrateAtoms } from 'jotai/utils'
import type { Document } from '@whiteboard/core'
import type { WhiteboardInstance } from '../instance/whiteboardInstance'
import { docAtom, instanceAtom } from '../state'

export const useWhiteboardContextHydration = (doc: Document, instance: WhiteboardInstance) => {
  useHydrateAtoms([
    [docAtom, doc],
    [instanceAtom, instance]
  ])
}
