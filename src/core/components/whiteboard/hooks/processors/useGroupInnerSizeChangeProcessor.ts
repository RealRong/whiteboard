import { IWhiteboardEvent, IWhiteboardInstance, IWhiteboardNode, WhiteboardEvents } from '~/typings'
import { useEffect, useRef } from 'react'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'
import { enlargeBox } from '@/core/components/whiteboard/hooks/ops/group'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useAtomValue } from 'jotai'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { assignProperties } from '@/utils'
import { useDebounceFn } from '@/hooks'
import { WhiteboardEvent } from 'rendevoz'

export default () => {
  // keep track of groups initial size
  const instance = useWhiteboardInstance()
  const initialSizeRef = useRef<Map<number, IWhiteboardNode>>(new Map())
  const triggeredByAdapt = useRef<Record<number, boolean>>({})
  const debouceSet = useDebounceFn(
    (id: number) => {
      triggeredByAdapt.current[id] = false
    },
    { wait: 50 }
  )
  useEffect(() => {
    const l = (e: WhiteboardEvents['nodeSizeChange']) => {
      const changedNodes = e.changed
      const nonGroup = changedNodes.filter(i => i.type !== 'group')
      nonGroup.forEach(n => {
        if (n.rootId && n.x === 0 && n.y === 0) return
        const parentGroups = instance.groupOps?.getParentGroupsOfNode(n.id, true)
        if (parentGroups?.length) {
          parentGroups.forEach(g => {
            triggeredByAdapt.current[g.id] = true
            debouceSet.run(g.id)
            if (!initialSizeRef.current.has(g.id)) {
              initialSizeRef.current.set(g.id, g)
            }
            const initial = initialSizeRef.current.get(g.id)
            if (initial) {
              adaptGroupSize(initial, instance)
            }
          })
        }
      })
      changedNodes.forEach(n => {
        if (n.type === 'group') {
          if (triggeredByAdapt.current[n.id]) return
          initialSizeRef.current.set(n.id, n)
        }
      })
    }
    instance.addEventListener('nodeSizeChange', l)
    return () => {
      instance.removeEventListener('nodeSizeChange', l)
    }
  }, [])
}

const adaptGroupSize = (originalGroup: IWhiteboardNode, instance: IWhiteboardInstance) => {
  const insideNodes = instance.groupOps?.getNodesInGroup(originalGroup.id, false, true) || []
  console.log(insideNodes)
  const realTimeBox = instance.nodeOps?.getDOMBoxOfNodes(insideNodes.map(i => i.id))
  if (realTimeBox) {
    const box = getBoxOfBoxes(Object.values(realTimeBox))
    if (!box) return
    const enlarged = enlargeBox(box)
    const right = enlarged.left + enlarged.width
    const bottom = enlarged.top + enlarged.height
    const originRight = originalGroup.x + originalGroup.width!
    const originBottom = originalGroup.y + originalGroup.height!
    const finalBottom = Math.max(bottom, originBottom)
    const finalRight = Math.max(right, originRight)
    const finalY = Math.min(originalGroup.y, enlarged.top)
    const finalX = Math.min(originalGroup.x, enlarged.left)
    const finalBox = {
      x: finalX,
      y: finalY,
      width: finalRight - finalX,
      height: finalBottom - finalY
    }
    instance.nodeOps?.getNodeFuncs(originalGroup.id)?.setStyle({
      width: finalBox.width,
      height: finalBox.height
    })
    instance.updateNode?.(originalGroup.id, n => ({ ...n, ...finalBox }), false)
  }
}
