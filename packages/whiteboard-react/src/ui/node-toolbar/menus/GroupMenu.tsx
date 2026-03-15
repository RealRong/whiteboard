import {
  hasSchemaField
} from '../model'
import type { NodeToolbarActionContext } from '../types'
import {
  ToolbarChip,
  ToolbarChipRow,
  ToolbarMenuSection
} from './ui'

export const GroupMenu = ({
  instance,
  primaryNode,
  primarySchema
}: NodeToolbarActionContext) => {
  const showCollapsed = !primarySchema || hasSchemaField(primarySchema, 'data', 'collapsed')
  const showAutoFit = !primarySchema || hasSchemaField(primarySchema, 'data', 'autoFit')
  const collapsed = Boolean(primaryNode.data?.collapsed)
  const autoFit = primaryNode.data?.autoFit === 'manual' ? 'manual' : 'expand-only'

  if (!showCollapsed && !showAutoFit) return null

  return (
    <>
      {showCollapsed ? (
        <ToolbarMenuSection title="Group">
          <ToolbarChipRow>
            <ToolbarChip
              active={collapsed}
              onClick={() => {
                void instance.commands.node.updateData(primaryNode.id, { collapsed: !collapsed })
              }}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </ToolbarChip>
          </ToolbarChipRow>
        </ToolbarMenuSection>
      ) : null}
      {showAutoFit ? (
        <ToolbarMenuSection title="Auto fit">
          <ToolbarChipRow>
            {(['expand-only', 'manual'] as const).map((mode) => (
              <ToolbarChip
                key={mode}
                active={autoFit === mode}
                onClick={() => {
                  void instance.commands.node.updateData(primaryNode.id, { autoFit: mode })
                }}
              >
                {mode}
              </ToolbarChip>
            ))}
          </ToolbarChipRow>
        </ToolbarMenuSection>
      ) : null}
    </>
  )
}
