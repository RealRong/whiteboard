import type { ReactNode } from 'react'
import { setNodesLocked } from '../../features/node/commands'
import { ArrangeMenu } from './menus/ArrangeMenu'
import { FillMenu } from './menus/FillMenu'
import { GroupMenu } from './menus/GroupMenu'
import { MoreMenu } from './menus/MoreMenu'
import { StrokeMenu } from './menus/StrokeMenu'
import { TextMenu } from './menus/TextMenu'
import type {
  NodeToolbarActionContext,
  NodeToolbarItemKey,
} from './types'

type ToolbarItemDefinition = {
  icon: ReactNode
  run?: (props: NodeToolbarActionContext, active: boolean) => void
  renderMenu?: (props: NodeToolbarActionContext) => ReactNode
}

const SvgIcon = ({
  children,
  viewBox = '0 0 24 24'
}: {
  children: ReactNode
  viewBox?: string
}) => (
  <svg viewBox={viewBox} aria-hidden="true" className="wb-node-toolbar-icon">
    {children}
  </svg>
)

export const toolbarItemDefinitions: Record<NodeToolbarItemKey, ToolbarItemDefinition> = {
  fill: {
    icon: (
      <SvgIcon>
        <path d="M6 4h8l4 4v1l-7 7-6-6 7-6Z" fill="currentColor" opacity="0.9" />
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <FillMenu {...props} />
  },
  stroke: {
    icon: (
      <SvgIcon>
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <StrokeMenu {...props} />
  },
  text: {
    icon: (
      <SvgIcon>
        <path d="M6 6h12M12 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </SvgIcon>
    ),
    renderMenu: (props) => <TextMenu {...props} />
  },
  group: {
    icon: (
      <SvgIcon>
        <rect x="4" y="6" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="11" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </SvgIcon>
    ),
    renderMenu: (props) => <GroupMenu {...props} />
  },
  arrange: {
    icon: (
      <SvgIcon>
        <rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="10" y="10" width="9" height="9" rx="1.5" fill="currentColor" opacity="0.25" />
      </SvgIcon>
    ),
    renderMenu: (props) => <ArrangeMenu {...props} />
  },
  lock: {
    icon: (
      <SvgIcon>
        <path d="M8 11V8.5a4 4 0 1 1 8 0V11" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="6" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </SvgIcon>
    ),
    run: ({ instance, nodes, close }, active) => {
      void setNodesLocked(instance, nodes, !active).finally(close)
    }
  },
  more: {
    icon: (
      <SvgIcon>
        <circle cx="6.5" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="17.5" cy="12" r="1.6" fill="currentColor" />
      </SvgIcon>
    ),
    renderMenu: (props) => <MoreMenu {...props} />
  }
}
