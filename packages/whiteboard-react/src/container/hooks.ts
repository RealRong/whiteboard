import type { NodeId } from '@whiteboard/core/types'
import { useUiAtomValue } from '../common/hooks/useUiAtom'
import { activeContainerIdAtom } from './domain'

export const useActiveContainerId = (): NodeId | undefined =>
  useUiAtomValue(activeContainerIdAtom)
