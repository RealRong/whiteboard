import {
  MenuItem,
  MenuList,
  MenuSection
} from './MenuPrimitives'
import {
  SelectionSummaryHeader,
  SelectionTypeFilterStrip
} from '../../features/node/components/SelectionSummaryHeader'
import type { NodeSummary, NodeTypeSummary } from '../../features/node/summary'

export type MoreMenuItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
}

export type MoreMenuSection = {
  key: string
  title: string
  items: readonly MoreMenuItem[]
}

export const MoreMenu = ({
  sections,
  summary,
  filter
}: {
  sections: readonly MoreMenuSection[]
  summary?: NodeSummary
  filter?: {
    types: readonly NodeTypeSummary[]
    onSelect: (type: string) => void
  }
}) => (
  <>
    {summary ? (
      <SelectionSummaryHeader summary={summary} />
    ) : null}
    {filter?.types.length ? (
      <MenuSection title="Filter">
        <SelectionTypeFilterStrip
          types={filter.types}
          onSelect={filter.onSelect}
        />
      </MenuSection>
    ) : null}
    {sections.map((section) => (
      <MenuSection key={section.key} title={section.title}>
        <MenuList>
          {section.items.map((item) => (
            <MenuItem
              key={item.key}
              disabled={item.disabled}
              tone={item.tone}
              onClick={item.onClick}
            >
              {item.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuSection>
    ))}
  </>
)
