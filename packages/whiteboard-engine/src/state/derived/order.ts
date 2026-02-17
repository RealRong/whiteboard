import { atom } from 'jotai'
import type { EdgeId, NodeId } from '@whiteboard/core'
import { docAtom } from '../contextAtoms'

export const orderByIds = <T extends { id: string }>(
  items: T[],
  ids: string[]
) => {
  if (!ids.length) return items

  const map = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const idSet = new Set(ids)

  ids.forEach((id) => {
    const item = map.get(id)
    if (item) ordered.push(item)
  })

  if (ordered.length === items.length) return ordered

  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })

  return ordered
}

export const nodeOrderAtom = atom<NodeId[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  return doc.order?.nodes ?? doc.nodes.map((node) => node.id)
})

export const edgeOrderAtom = atom<EdgeId[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  return doc.order?.edges ?? doc.edges.map((edge) => edge.id)
})
