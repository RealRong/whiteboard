import { useSetAtom } from 'jotai'
import { viewNodesAtom } from '../state/viewNodesAtom'

export const useViewNodesStore = () => {
  const setViewNodes = useSetAtom(viewNodesAtom)
  return { setViewNodes }
}
