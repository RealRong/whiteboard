import type { ReactNode } from 'react'
import { MenuSection } from '../../menus/MenuPrimitives'

export type ShapeMenuValue =
  | string

type ShapeItem = {
  key: ShapeMenuValue
  label: string
  section: 'basic' | 'annotation'
}

const SHAPE_ITEMS: readonly ShapeItem[] = [
  { key: 'shape.rect', label: 'Rectangle', section: 'basic' },
  { key: 'shape.ellipse', label: 'Ellipse', section: 'basic' },
  { key: 'shape.diamond', label: 'Diamond', section: 'basic' },
  { key: 'shape.triangle', label: 'Triangle', section: 'basic' },
  { key: 'shape.arrow-sticker', label: 'Arrow', section: 'annotation' },
  { key: 'shape.callout', label: 'Callout', section: 'annotation' },
  { key: 'shape.highlight', label: 'Highlight', section: 'annotation' }
] as const

const SHAPE_SECTIONS = [
  { key: 'basic', title: 'Basic' },
  { key: 'annotation', title: 'Annotation' }
] as const

const SvgGlyph = ({
  children
}: {
  children: ReactNode
}) => (
  <svg
    viewBox="0 0 32 24"
    aria-hidden="true"
    className="wb-left-toolbar-shape-glyph-svg"
    fill="none"
    stroke="currentColor"
    strokeWidth={1}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const ShapeGlyph = ({
  value
}: {
  value: ShapeMenuValue
}) => {
  switch (value) {
    case 'shape.rect':
      return (
        <SvgGlyph>
          <rect x="5" y="5.5" width="22" height="13" rx="3" fill="var(--wb-toolbar-preview-fill)" />
        </SvgGlyph>
      )
    case 'shape.ellipse':
      return (
        <SvgGlyph>
          <ellipse cx="16" cy="12" rx="11" ry="6.5" fill="var(--wb-toolbar-preview-fill-blue)" />
        </SvgGlyph>
      )
    case 'shape.diamond':
      return (
        <SvgGlyph>
          <path d="M16 4.5 26 12 16 19.5 6 12 16 4.5Z" fill="var(--wb-toolbar-preview-fill-yellow)" />
        </SvgGlyph>
      )
    case 'shape.triangle':
      return (
        <SvgGlyph>
          <path d="M16 4.5 26 19.5H6L16 4.5Z" fill="var(--wb-toolbar-preview-fill-red)" />
        </SvgGlyph>
      )
    case 'shape.arrow-sticker':
      return (
        <SvgGlyph>
          <path d="M6 12h12" />
          <path d="M14 7.5 20 12l-6 4.5" />
          <path d="M6 7.5h7.5v9H6z" fill="var(--wb-toolbar-preview-fill-blue)" />
        </SvgGlyph>
      )
    case 'shape.callout':
      return (
        <SvgGlyph>
          <path d="M6 5.5h20a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H16l-5 3v-3H6A2.5 2.5 0 0 1 3.5 14V8A2.5 2.5 0 0 1 6 5.5Z" fill="var(--wb-toolbar-preview-fill)" />
        </SvgGlyph>
      )
    case 'shape.highlight':
      return (
        <SvgGlyph>
          <rect x="4.5" y="6.5" width="23" height="11" rx="5.5" fill="var(--wb-toolbar-preview-fill-yellow-soft)" stroke="none" />
          <path d="M7 12h18" />
        </SvgGlyph>
      )
    default:
      return null
  }
}

export const ShapeMenu = ({
  value,
  onChange
}: {
  value?: ShapeMenuValue
  onChange: (value: ShapeMenuValue) => void
}) => (
  <>
    {SHAPE_SECTIONS.map((section) => (
      <MenuSection key={section.key} title={section.title}>
        <div className="wb-left-toolbar-shape-grid">
          {SHAPE_ITEMS
            .filter((item) => item.section === section.key)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                className="wb-left-toolbar-shape-option"
                data-active={value === item.key ? 'true' : undefined}
                onClick={() => onChange(item.key)}
                data-selection-ignore
                data-input-ignore
                aria-label={item.label}
                title={item.label}
              >
                <span className="wb-left-toolbar-shape-glyph">
                  <ShapeGlyph value={item.key} />
                </span>
              </button>
            ))}
        </div>
      </MenuSection>
    ))}
  </>
)
