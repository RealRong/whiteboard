import { useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import type { NodeId } from '@whiteboard/core'
import type { GroupRuntime } from '../state/groupRuntimeAtom'
import { groupRuntimeAtom } from '../state/groupRuntimeAtom'

export type GroupRuntimeStore = GroupRuntime & {
  setRuntime: (runtime: Pick<GroupRuntime, 'nodes' | 'nodeSize' | 'padding'>) => void
  setHoveredGroupId: (groupId?: NodeId) => void
}

export const useGroupRuntime = (): GroupRuntimeStore => {
  const [runtime, setRuntimeAtom] = useAtom(groupRuntimeAtom)

  const setRuntime = useCallback(
    (next: Pick<GroupRuntime, 'nodes' | 'nodeSize' | 'padding'>) => {
      setRuntimeAtom((prev) => ({ ...prev, ...next }))
    },
    [setRuntimeAtom]
  )

  const setHoveredGroupId = useCallback(
    (groupId?: NodeId) => {
      setRuntimeAtom((prev) => ({ ...prev, hoveredGroupId: groupId }))
    },
    [setRuntimeAtom]
  )

  return useMemo<GroupRuntimeStore>(
    () => ({
      ...runtime,
      setRuntime,
      setHoveredGroupId
    }),
    [runtime, setRuntime, setHoveredGroupId]
  )
}
