import type { NodeId } from '@whiteboard/core/types'
import { useUiAtomValue } from '../hooks/useUiAtom'
import { activeContainerIdAtom } from './container'

export const useActiveContainerId = (): NodeId | undefined =>
  useUiAtomValue(activeContainerIdAtom)
