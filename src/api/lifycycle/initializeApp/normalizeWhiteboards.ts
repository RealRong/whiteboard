import { useDb } from '@/hooks'
import { IWhiteboard } from '~/typings'

export default async () => {
  const db = useDb('objects')
  const whiteboards = (await db.where('specType').equals('whiteboard').toArray()) as IWhiteboard[]
  const newWhiteboards = whiteboards
    .filter(i => !Array.isArray(i.nodes) || !Array.isArray(i.edges))
    .map(i => {
      return {
        ...i,
        nodes: i.nodes instanceof Map ? Array.from(i.nodes.values()) : Array.isArray(i.nodes) ? i.nodes : [],
        edges: i.edges instanceof Map ? Array.from(i.edges.values()) : Array.isArray(i.edges) ? i.edges : []
      }
    })
  await db.bulkPut(newWhiteboards)
}
