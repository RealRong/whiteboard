import { toolAtom } from '../state'
import { useInstanceAtomValue } from './useInstanceStore'

export const useActiveTool = () => {
  return (useInstanceAtomValue(toolAtom) as 'select' | 'edge') ?? 'select'
}
