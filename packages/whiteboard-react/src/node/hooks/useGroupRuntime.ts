import { useMemo } from 'react'
import { groupRuntimeAtom } from '../state/groupRuntimeAtom'
import { useInstance, useInstanceAtomValue } from '../../common/hooks'
import type { GroupRuntimeStore } from 'types/node'


export const useGroupRuntime = (): GroupRuntimeStore => {
  const instance = useInstance()
  const runtime = useInstanceAtomValue(groupRuntimeAtom)

  return useMemo<GroupRuntimeStore>(
    () => ({
      ...runtime,
      setHoveredGroupId: instance.commands.groupRuntime.setHoveredGroupId
    }),
    [instance, runtime]
  )
}
