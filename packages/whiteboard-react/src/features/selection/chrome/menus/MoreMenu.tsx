import {
  MenuItem,
  MenuList,
  MenuSection
} from './MenuPrimitives'
import {
  SelectionSummaryHeader,
  SelectionTypeFilterStrip
} from '../../../node/components/SelectionSummaryHeader'
import type { NodeSummary, NodeTypeSummary } from '../../../node/summary'
import type { SelectionMoreMenuSection } from '../selectionMenu'

export const MoreMenu = ({
  sections,
  summary,
  filter
}: {
  sections: readonly SelectionMoreMenuSection[]
  summary?: NodeSummary
  filter?: {
    types: readonly NodeTypeSummary[]
    onSelect: (key: string) => void
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
