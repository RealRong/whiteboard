import { useCallback, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { NodeId } from '@whiteboard/core'
import type { GroupRuntime } from '../state/groupRuntimeAtom'
import { groupHoveredAtom, groupRuntimeAtom } from '../state/groupRuntimeAtom'

export type GroupRuntimeStore = GroupRuntime & {
  setHoveredGroupId: (groupId?: NodeId) => void
}

export const useGroupRuntime = (): GroupRuntimeStore => {
  const runtime = useAtomValue(groupRuntimeAtom)
  const setHoveredGroupIdAtom = useSetAtom(groupHoveredAtom)

  const setHoveredGroupId = useCallback(
    (groupId?: NodeId) => {
      setHoveredGroupIdAtom(groupId)
    },
    [setHoveredGroupIdAtom]
  )

  return useMemo<GroupRuntimeStore>(
    () => ({
      ...runtime,
      setHoveredGroupId
    }),
    [runtime, setHoveredGroupId]
  )
}
