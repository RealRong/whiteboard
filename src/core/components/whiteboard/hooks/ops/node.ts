import { Box, IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { assignProperties, boxContain, boxesIntersect } from '@/utils'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'
import Id from '@/utils/id'
import { MetaStore } from '@/api/stores'
import { enlargeBox } from '@/core/components/whiteboard/hooks/ops/group'
import { getFlattenChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'
import { canCloneMindmap, cloneMindmap } from '@/core/components/whiteboard/node/mindmap/utils/cloneMindmap'
import pasteImage from '@/core/components/whiteboard/hooks/ops/paste/pasteImage'
import pasteNodes from '@/core/components/whiteboard/hooks/ops/paste/pasteNodes'
import pastePlainText from '@/core/components/whiteboard/hooks/ops/paste/pastePlainText'
import { useRef } from 'react'
import pasteObjects from '@/core/components/whiteboard/hooks/ops/paste/pasteObjects'

const assignNodeOps = (instance: IWhiteboardInstance) => {
  const metaMap = MetaStore.getMetaObjectsMap()
  const needUpdateEdges = useRef<Set<number>>(new Set())
  assignProperties(instance, {
    nodeOps: {
      ...instance.nodeOps,
      getMaxZindex: () => {
        const allNodes = instance.getAllNode?.()
        if (!allNodes) throw 'Failed to get nodes'
        const zs = allNodes.map(i => i.z).filter(i => i !== undefined) as number[]
        return Math.max(...zs, 0)
      },
      updateAfterZ: currentNodeId => {
        const n = instance.getNode?.(currentNodeId)
        if (n) {
          const allNodes = instance.getAllNode?.()
          if (allNodes) {
            const afterZNodes = allNodes.filter(no => no.z > n.z)
            if (afterZNodes.length) {
              const maxZ = Math.max(...afterZNodes.map(i => i.z), 0)
              instance.updateWhiteboard?.(w => {
                afterZNodes.forEach(n => {
                  w.nodes?.set(n.id, { ...n, z: n.z - 1 })
                })
                w.nodes?.set(n.id, { ...n, z: maxZ })
              })
            }
          }
        }
      },
      updateRelatedEdges: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        idArr.forEach(id => {
          const relatedEdges = instance.values.NODE_TO_EDGE_MAP.get(id)
          relatedEdges?.forEach(edgeId => {
            if (!needUpdateEdges.current.size) {
              Promise.resolve().then(() => {
                needUpdateEdges.current.forEach(id => {
                  instance.values.ID_TO_EDGE_MAP.get(id)?.drawPath()
                })
                needUpdateEdges.current.clear()
              })
            }
            needUpdateEdges.current.add(edgeId)
          })
        })
      },
      deleteNode: (nodeId, redo = true) => {
        const idArrSet = new Set(Array.isArray(nodeId) ? nodeId : [nodeId])
        idArrSet.forEach(id => {
          const n = instance.getNode?.(id)
          if (n) {
            if (n.type === 'mindmap') {
              getFlattenChildrenOfNode(n, instance, 'right')?.forEach(r => {
                idArrSet.add(r.root)
              })
              getFlattenChildrenOfNode(n, instance, 'left')?.forEach(r => {
                idArrSet.add(r.root)
              })
            } else if (n.rootId) {
              getFlattenChildrenOfNode(n, instance, n.side)?.forEach(r => {
                idArrSet.add(r.root)
              })
            }
          }
        })
        const idArr = Array.from(idArrSet.values())
        instance.emit({
          type: 'nodeDeleted',
          deleted: idArr
        })
        idArr.forEach(id => {
          const origin = instance.getNode?.(id)
          if (origin) {
            const whiteboardId = instance.values.id
            if (origin.type === 'metaObject' && whiteboardId) {
              const whiteboardMeta = MetaStore.getMetaObjectByObjectId(whiteboardId)
              if (whiteboardMeta) {
                const link = MetaStore.getMetaLinkBySourceAndTarget(origin.metaObjectId, whiteboardMeta.id)
                if (link) {
                  MetaStore.deleteMetaLink(link)
                }
              }
            }
          }
        })
        instance.updateWhiteboard(w => {
          idArr.forEach(i => {
            w.nodes?.delete(i)
            instance.values.NODE_TO_EDGE_MAP.get(i)?.forEach(l => {
              w.edges?.delete(l)
            })
          })
        }, redo)
      },
      getNodeDOM: nodeId => {
        const element = instance.nodeOps?.getNodeFuncs(nodeId)?.getNodeDOM()
        if (!element) {
          throw new Error("Failed to find node's DOM!")
        }
        return element
      },
      expand: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        instance.updateWhiteboard(w => {
          idArr.forEach(id => {
            const origin = w.nodes?.get(id)
            if (origin && origin.width) {
              w.nodes?.set(id, {
                ...origin,
                expanded: true,
                height: undefined,
                resized: false,
                fixedExpanded: true
              })
            }
          })
        }, true)
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        }, 50)
      },
      getDOMBoxOfNodes: ids => {
        const idArr = Array.isArray(ids) ? ids : [ids]
        const boxes = idArr.map(i => ({ id: i, box: instance.nodeOps?.getNodeFuncs(i)?.getRealtimeBox() })).filter(i => i.box) as {
          id: number
          box: Box
        }[]
        return Object.fromEntries(boxes.map(i => [i.id, i.box]))
      },
      fold: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        instance.updateWhiteboard(w => {
          idArr.forEach(id => {
            w.nodes?.has(id) && w.nodes?.set(id, { ...w.nodes!.get(id)!, expanded: false, height: undefined, resized: false })
          })
        }, true)
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        }, 50)
      },
      intersectWith: (nodeId, box) => {
        const node = instance.getNode?.(nodeId)
        if (!node) return false
        const nodeBox = instance.nodeOps?.getNodeFuncs(nodeId)?.getRealtimeBox()
        if (!nodeBox) return false
        if (node.type === 'group') {
          return boxContain(box, nodeBox)
        }
        return boxesIntersect(nodeBox, box)
      },
      canExpand: node => {
        if (node.type !== 'metaObject' || !node.metaObjectId) {
          return false
        }
        const metaObject = metaMap.get(node.metaObjectId)
        if (!metaObject) {
          return false
        }
        if (metaObject.type.includes('Label')) return false
        const registered = Global.layoutOps?.getRegisteredTabData(metaObject.type)
        if (registered) {
          return true
        }
        return false
      },
      copy: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        const nodes = idArr.map(id => instance.getNode?.(id)).filter(i => i) as IWhiteboardNode[]
        const box = getBoxOfNodes(nodes)
        if (box) {
          // reset nodes coord to outest box
          const elements: IWhiteboardNode[] = []
          const idSet = new Set(idArr)
          nodes.forEach(ele => {
            if (ele.rootId) {
              const root = instance.getNode?.(ele.rootId)
              if (root) {
                const nodes = getFlattenChildrenOfNode(root, instance, ele.side)
                // if ancestor is copied, do not process this node
                if (nodes?.some(i => i.root !== ele.id && idSet.has(i.root))) {
                  return
                }
              }
            }
            if (canCloneMindmap(ele, instance)) {
              const inserted = cloneMindmap(ele, instance)
              if (inserted) {
                inserted.insertNewNodes.forEach(n => elements.push({ ...n }))
                elements.push({ ...inserted.newMindmap, id: Id.getId() })
                return
              }
            } else {
              elements.push({ ...ele, id: Id.getId() })
            }
          })
          const newNodes = elements.map(n => ({ ...n, x: n.x - box.left, y: n.y - box.top }))
          Global.values.copiedWhiteboardData = newNodes
        }
      },
      paste: position => {
        instance.toolbarOps?.selectPasteOption?.(position).then(res => {
          if (res === 'text') {
            pastePlainText(instance, position)
          }
          if (res === 'image') {
            pasteImage(instance, position)
          }
          if (res === 'nodes') {
            pasteNodes(instance, position)
          }
          if (res === 'objects') {
            pasteObjects(instance, position)
          }
        })
      },
      getNodeFuncs: nodeId => {
        return instance.values.ID_TO_NODE_MAP.get(nodeId)
      },
      extendNodes: currentNodes => {
        const nodesArr = Array.isArray(currentNodes) ? currentNodes : [currentNodes]
        const normalized = (
          typeof nodesArr[0] === 'number' ? nodesArr.map(i => instance.getNode?.(i as number)).filter(i => i) : nodesArr
        ) as IWhiteboardNode[]
        const nodeSet = new Set<IWhiteboardNode>(normalized)
        const groupNodes = normalized.filter(i => i.type === 'group')
        groupNodes.forEach(g => {
          const insideNodes = instance.groupOps?.getNodesInGroup(g.id)
          insideNodes?.forEach(n => nodeSet.add(n))
        })
        return Array.from(nodeSet.values())
      },
      open: (nodeId, type) => {
        const node = instance.getNode?.(nodeId)
        if (!node || node.type !== 'metaObject' || !node.metaObjectId) return
        switch (type) {
          case 'newTab': {
            Global.layoutOps?.openObject(node.metaObjectId)
            return
          }
          case 'sidePeek': {
            instance.sidebarOps?.openNodeAtSidebar(nodeId)
            return
          }
          case 'float': {
            instance.floatOps?.openNode(nodeId)
            return
          }
        }
      },
      fitContent: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        instance.updateWhiteboard(w => {
          if (w.nodes) {
            idArr.forEach(id => {
              const origin = w.nodes?.get(id)
              if (origin) {
                if (origin.type === 'group') {
                  const insideNodes = instance.groupOps?.getNodesInGroup(origin.id)
                  if (insideNodes?.length) {
                    const box = getBoxOfNodes(
                      insideNodes.map(i => {
                        // if inside node also need fit content
                        if (idArr.includes(i.id)) {
                          const dom = instance.nodeOps?.getNodeDOM(i.id)
                          const scrollHeight = (
                            dom?.querySelector('[role="editor-container"]') || dom?.querySelector('[role="scroll-container"]')
                          )?.scrollHeight
                          if (scrollHeight) {
                            return { ...i, height: scrollHeight }
                          }
                          return i
                        }
                        return i
                      })
                    )
                    if (box) {
                      const enlarged = enlargeBox(box)
                      w.nodes?.set(id, { ...origin, x: enlarged.left, y: enlarged.top, width: enlarged.width, height: enlarged.height })
                    }
                  }
                } else {
                  w.nodes?.set(id, { ...origin, resized: false, fixedExpanded: false })
                }
              }
            })
          }
        }, true)
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        }, 20)
      }
    }
  })
}

export default assignNodeOps
