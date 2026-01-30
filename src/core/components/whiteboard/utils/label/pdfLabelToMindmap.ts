import { MetaStore, ObjectStore } from '@/api/stores'
import { IPDFLabel, IWhiteboard, IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import usePdfjs from '@/hooks/utils/usePdfjs'
import Id from '@/utils/id'

export default async (pdfId: number, prevMindmap?: IWhiteboard) => {
  const pdf = await ObjectStore('pdf').getOneById(pdfId)
  if (pdf) {
    const labels = (await Promise.all(pdf.labels?.map(async i => await ObjectStore('pdfLabel').getOneById(i)) || [])).filter(
      i => i
    ) as IPDFLabel[]
    const document = await usePdfjs().getDocument(pdf.url).promise
    const prevPageIdxToId: Record<number, number> = {}
    const prevMetaIdToId: Record<number, number> = {}
    let prevMindmapId: number | undefined = undefined
    if (prevMindmap) {
      Array.from(prevMindmap.nodes?.values() || []).forEach(n => {
        if (n.type === 'text' && 'idxStr' in n) {
          prevPageIdxToId[n.idxStr] = n.id
        }
        if (n.type === 'metaObject') {
          prevMetaIdToId[n.metaObjectId] = n.id
        }
        if (n.type === 'mindmap') {
          prevMindmapId = n.id
        }
      })
    }
    if (document) {
      const outline = await document.getOutline()
      if (!outline.length) {
        throw ''
      }
      const allPageIdx = new Set<number>()
      const parseOutline = async (root: typeof outline, parentIdx?: string) => {
        return await Promise.all(
          root.map(async (o, idx) => {
            const dest = o.dest
            const pageIdx =
              typeof dest === 'string'
                ? await document.getDestination(dest).then(o => document.getPageIndex(o[0]))
                : await document.getPageIndex(dest[0])
            allPageIdx.add(pageIdx)
            const idxStr = (parentIdx ?? '') + idx + '-'
            return {
              pageIdx,
              idxStr,
              title: o.title,
              children: await parseOutline(o.items, idxStr)
            }
          })
        )
      }
      const parsed = await parseOutline(outline)
      const pageIdxToLabels: Record<number, typeof labels> = {}
      const sortedPageIdx = Array.from(allPageIdx.values()).sort((a, b) => a - b)
      labels.forEach(l => {
        if (l.page === undefined) return
        const targetPageIdx = sortedPageIdx.findLast(i => l.page >= i)
        if (targetPageIdx >= 0) {
          const arr = pageIdxToLabels[targetPageIdx] || []
          arr.push(l)
          pageIdxToLabels[targetPageIdx] = arr
        }
      })
      const loopCheckChildrenHaveSamePageIndex = (p: (typeof parsed)[0]) => {
        return p.children.some(i => {
          if (i.pageIdx === p.pageIdx) {
            return true
          }
          return loopCheckChildrenHaveSamePageIndex(i)
        })
      }
      const attachLabelsToOutlineTree = (p: typeof parsed) => {
        p.forEach(i => {
          if (!loopCheckChildrenHaveSamePageIndex(i)) {
            i.labels = pageIdxToLabels[i.pageIdx]
            delete pageIdxToLabels[i.pageIdx]
          }
          attachLabelsToOutlineTree(i.children)
        })
      }
      attachLabelsToOutlineTree(parsed)
      let needAddNodes: IWhiteboardNode[] = []
      const parseOutlineTreeToMindmap = async (p: typeof parsed): Promise<IWhiteboardMindmap[]> => {
        return await Promise.all(
          p.map(async i => {
            const prevNodeId = prevPageIdxToId[i.idxStr]
            const node: IWhiteboardNode = prevNodeId
              ? prevMindmap?.nodes?.get(prevNodeId)
              : {
                  id: Id.getId(),
                  type: 'text',
                  x: 0,
                  y: 0,
                  pageIndex: i.pageIdx,
                  idxStr: i.idxStr,
                  fontSize: 'super large',
                  content: [{ type: 'paragraph', id: Id.getId(), children: [{ text: i.title }] }]
                }
            const labels = i.labels as IPDFLabel[] | undefined
            const labelNodes = (
              await Promise.all(
                labels?.map(async l => {
                  const lMeta = (
                    await Global.metaOps.addDraggableAsMeta({
                      type: 'label',
                      labelId: l.id
                    })
                  )[0]
                  if (lMeta) {
                    const prevNodeId = prevMetaIdToId[lMeta.id]
                    return prevNodeId
                      ? prevMindmap?.nodes?.get(prevNodeId)
                      : ({
                          type: 'metaObject',
                          id: Id.getId(),
                          metaObjectId: lMeta.id,
                          x: 0,
                          y: 0
                        } as IWhiteboardNode)
                  }
                }) || []
              )
            ).filter(i => i) as IWhiteboardNode[]
            const m: IWhiteboardMindmap = {
              root: node.id,
              children: [
                ...((await parseOutlineTreeToMindmap(i.children)) || []),
                ...labelNodes.map(i => ({
                  root: i.id,
                  children: []
                }))
              ]
            }
            labelNodes.forEach(n => needAddNodes.push(n))
            needAddNodes.push(node)
            return m
          })
        )
      }
      const m = await parseOutlineTreeToMindmap(parsed)
      const mId = prevMindmapId ?? Id.getId()
      needAddNodes = needAddNodes.map(i => ({
        ...i,
        rootId: mId,
        side: 'right'
      }))
      const pdfMeta = MetaStore.getMetaObjectByObjectId(pdfId)
      needAddNodes.push({
        id: mId,
        type: 'mindmap',
        nodeType: 'text',
        x: 0,
        y: 0,
        leftChildren: [],
        edgeType: 'curve',
        edgeColor: '#67C6E3',
        content: [{ type: 'paragraph', id: Id.getId(), children: [{ text: pdfMeta?.name || 'Unnamed PDF' }] }],
        ...(prevMindmapId ? prevMindmap?.nodes?.get(prevMindmapId) : {}),
        rightChildren: m
      })
      console.log(needAddNodes)
      return needAddNodes
    }
  }
}
