import type { Node, Operation } from '@whiteboard/core'
import { buildCanvasNodeDirtyHint } from './nodeHint'

type Scenario = {
  name: string
  operations: Operation[]
  loops: number
}

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const toNode = (
  id: string,
  type: string,
  options?: {
    parentId?: string
    x?: number
    y?: number
  }
): Node => ({
  id,
  type,
  parentId: options?.parentId,
  position: {
    x: options?.x ?? 0,
    y: options?.y ?? 0
  }
})

const createNodes = (groupCount: number, childrenPerGroup: number) => {
  const groups: Node[] = []
  const children: Node[] = []

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupId = `g_${groupIndex}`
    groups.push(toNode(groupId, 'group', { x: groupIndex * 40, y: groupIndex * 24 }))
    for (let childIndex = 0; childIndex < childrenPerGroup; childIndex += 1) {
      const childId = `n_${groupIndex}_${childIndex}`
      children.push(
        toNode(childId, 'card', {
          parentId: groupId,
          x: groupIndex * 40 + childIndex * 2,
          y: groupIndex * 24 + childIndex * 2
        })
      )
    }
  }

  return {
    groups,
    children,
    all: [...groups, ...children]
  }
}

const take = <T>(items: T[], count: number) => items.slice(0, Math.min(count, items.length))

const toDeleteOperation = (node: Node): Operation => ({
  type: 'node.delete',
  id: node.id,
  before: node
})

const runScenario = (scenario: Scenario, getNodes: () => Node[]) => {
  let checksum = 0
  const startedAt = now()
  for (let index = 0; index < scenario.loops; index += 1) {
    const hint = buildCanvasNodeDirtyHint(scenario.operations, getNodes)
    checksum += hint.forceFull ? 1 : 0
    checksum += hint.orderChanged ? 1 : 0
    checksum += hint.dirtyNodeIds?.length ?? 0
  }
  const elapsedMs = now() - startedAt
  const perLoopMs = elapsedMs / scenario.loops
  const opsPerSecond = scenario.loops > 0 ? (scenario.loops * 1000) / elapsedMs : 0

  console.log(
    [
      scenario.name,
      `loops=${scenario.loops}`,
      `ops=${scenario.operations.length}`,
      `total=${elapsedMs.toFixed(2)}ms`,
      `perLoop=${perLoopMs.toFixed(4)}ms`,
      `ops/s=${opsPerSecond.toFixed(2)}`,
      `checksum=${checksum}`
    ].join(' | ')
  )
}

const main = () => {
  const dataset = createNodes(120, 40)
  const groupSample = take(dataset.groups, 24)
  const childSample = take(dataset.children, 320)

  const moveOps: Operation[] = childSample.map((node, index) => ({
    type: 'node.update',
    id: node.id,
    before: node,
    patch: {
      position: {
        x: node.position.x + (index % 3),
        y: node.position.y + (index % 2)
      }
    }
  }))

  const collapsedOps: Operation[] = groupSample.map((group) => ({
    type: 'node.update',
    id: group.id,
    before: group,
    patch: {
      data: {
        collapsed: true
      }
    }
  }))

  const typeSwitchOps: Operation[] = take(dataset.children, 64).map((node) => ({
    type: 'node.update',
    id: node.id,
    before: node,
    patch: {
      type: 'group'
    }
  }))

  const createOps: Operation[] = take(dataset.groups, 64).map((group, index) => ({
    type: 'node.create',
    node: toNode(`new_${index}`, 'card', {
      parentId: group.id,
      x: index,
      y: index
    })
  }))

  const deleteOps: Operation[] = [
    ...take(dataset.children, 80).map(toDeleteOperation),
    ...take(dataset.groups, 8).map(toDeleteOperation)
  ]

  const scenarios: Scenario[] = [
    { name: 'move-bulk', operations: moveOps, loops: 800 },
    { name: 'collapsed-groups', operations: collapsedOps, loops: 600 },
    { name: 'type-switch-group', operations: typeSwitchOps, loops: 500 },
    { name: 'create-with-ancestors', operations: createOps, loops: 1000 },
    { name: 'delete-mixed', operations: deleteOps, loops: 700 },
    {
      name: 'order-with-ancestors',
      operations: [
        {
          type: 'node.order.bringForward',
          ids: take(dataset.children, 200).map((node) => node.id)
        }
      ],
      loops: 2000
    }
  ]

  console.log(
    `nodeHint bench | nodes=${dataset.all.length} | groups=${dataset.groups.length} | children=${dataset.children.length}`
  )
  scenarios.forEach((scenario) => runScenario(scenario, () => dataset.all))
}

main()
