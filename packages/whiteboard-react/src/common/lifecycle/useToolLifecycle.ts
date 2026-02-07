import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { toolAtom } from '../state/whiteboardAtoms'

export const useToolLifecycle = (tool: string) => {
  const setTool = useSetAtom(toolAtom)

  useEffect(() => {
    setTool(tool)
  }, [setTool, tool])
}
