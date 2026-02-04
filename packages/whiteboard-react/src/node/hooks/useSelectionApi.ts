import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import type { UseSelectionReturn } from './useSelection'
import { selectionApiAtom } from '../state/selectionApiAtom'

export const useSelectionApi = () => {
  const setSelectionApi = useSetAtom(selectionApiAtom)
  const setApi = useCallback(
    (api: UseSelectionReturn | null) => {
      setSelectionApi(api)
    },
    [setSelectionApi]
  )
  return { setSelectionApi: setApi }
}
