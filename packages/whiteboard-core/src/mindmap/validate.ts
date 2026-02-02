import type { MindmapNodeId, MindmapTree } from './types'

export type MindmapValidationResult = {
  ok: boolean
  errors: string[]
  repaired?: MindmapTree
}

type ValidateOptions = {
  repair?: boolean
}

const cloneTree = (tree: MindmapTree): MindmapTree => ({
  ...tree,
  nodes: { ...tree.nodes },
  children: Object.fromEntries(Object.entries(tree.children).map(([id, list]) => [id, [...list]])),
  meta: tree.meta ? { ...tree.meta } : undefined
})

export const validateMindmap = (tree: MindmapTree, options: ValidateOptions = {}): MindmapValidationResult => {
  const errors: string[] = []
  const root = tree.nodes[tree.rootId]
  if (!root) {
    errors.push(`Root node ${tree.rootId} not found.`)
    if (!options.repair) return { ok: false, errors }
  }

  const repaired = options.repair ? cloneTree(tree) : tree
  const nodes = repaired.nodes
  const children = repaired.children

  Object.keys(nodes).forEach((id) => {
    if (!children[id]) {
      children[id] = []
    }
  })

  const parentById = new Map<MindmapNodeId, MindmapNodeId>()
  Object.entries(children).forEach(([parentId, childList]) => {
    const nextChildren: MindmapNodeId[] = []
    childList.forEach((childId) => {
      if (!nodes[childId]) {
        errors.push(`Child ${childId} referenced by ${parentId} is missing.`)
        return
      }
      if (parentById.has(childId)) {
        errors.push(`Node ${childId} has multiple parents.`)
        return
      }
      parentById.set(childId, parentId)
      nextChildren.push(childId)
    })
    if (options.repair) {
      children[parentId] = nextChildren
    }
  })

  Object.values(nodes).forEach((node) => {
    if (node.id === repaired.rootId) return
    const expectedParent = parentById.get(node.id)
    if (!expectedParent) {
      errors.push(`Node ${node.id} is unreachable from root.`)
      if (options.repair) {
        children[repaired.rootId].push(node.id)
        node.parentId = repaired.rootId
      }
      return
    }
    if (node.parentId !== expectedParent) {
      errors.push(`Node ${node.id} parentId mismatch.`)
      if (options.repair) {
        node.parentId = expectedParent
      }
    }
  })

  const visited = new Set<MindmapNodeId>()
  const stack = new Set<MindmapNodeId>()

  const dfs = (nodeId: MindmapNodeId) => {
    if (stack.has(nodeId)) {
      errors.push(`Cycle detected at node ${nodeId}.`)
      return
    }
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    stack.add(nodeId)
    const childList = children[nodeId] ?? []
    const nextChildren: MindmapNodeId[] = []
    childList.forEach((childId) => {
      if (stack.has(childId)) {
        errors.push(`Cycle edge ${nodeId} -> ${childId}.`)
        if (!options.repair) {
          nextChildren.push(childId)
        }
        return
      }
      nextChildren.push(childId)
      dfs(childId)
    })
    if (options.repair) {
      children[nodeId] = nextChildren
    }
    stack.delete(nodeId)
  }

  if (nodes[repaired.rootId]) {
    dfs(repaired.rootId)
  }

  Object.values(nodes).forEach((node) => {
    if (node.parentId === repaired.rootId) {
      if (node.side !== 'left' && node.side !== 'right') {
        errors.push(`Root child ${node.id} missing side.`)
        if (options.repair) {
          node.side = 'right'
        }
      }
    } else if (node.side) {
      errors.push(`Non-root child ${node.id} should not have side.`)
      if (options.repair) {
        delete node.side
      }
    }
  })

  const ok = errors.length === 0
  if (ok) return { ok: true, errors: [] }
  if (options.repair) {
    return { ok: false, errors, repaired }
  }
  return { ok: false, errors }
}
