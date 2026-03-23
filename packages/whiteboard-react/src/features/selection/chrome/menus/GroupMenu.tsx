import type { GroupAutoFitMode } from '../../features/node/commands'
import {
  Chip,
  ChipRow,
  MenuSection
} from './MenuPrimitives'

export const GroupMenu = ({
  collapsed,
  autoFit,
  showCollapsed = false,
  showAutoFit = false,
  onToggleCollapsed,
  onAutoFitChange
}: {
  collapsed: boolean
  autoFit: GroupAutoFitMode
  showCollapsed?: boolean
  showAutoFit?: boolean
  onToggleCollapsed?: () => void
  onAutoFitChange?: (value: GroupAutoFitMode) => void
}) => {
  if (!showCollapsed && !showAutoFit) {
    return null
  }

  return (
    <>
      {showCollapsed && onToggleCollapsed ? (
        <MenuSection title="Group">
          <ChipRow>
            <Chip
              active={collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </Chip>
          </ChipRow>
        </MenuSection>
      ) : null}
      {showAutoFit && onAutoFitChange ? (
        <MenuSection title="Auto fit">
          <ChipRow>
            {(['expand-only', 'manual'] as const).map((mode) => (
              <Chip
                key={mode}
                active={autoFit === mode}
                onClick={() => {
                  onAutoFitChange(mode)
                }}
              >
                {mode}
              </Chip>
            ))}
          </ChipRow>
        </MenuSection>
      ) : null}
    </>
  )
}
