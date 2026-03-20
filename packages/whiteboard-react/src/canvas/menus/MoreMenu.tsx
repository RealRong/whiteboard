import {
  MenuItem,
  MenuList,
  MenuSection
} from './MenuPrimitives'
import type { NodeMenuSection } from '../../features/node/actions'

export const MoreMenu = ({
  sections
}: {
  sections: readonly NodeMenuSection[]
}) => (
  <>
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
