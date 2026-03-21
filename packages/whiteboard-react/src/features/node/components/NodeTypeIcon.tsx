import {
  ArrowRight,
  Circle,
  Diamond,
  Folder,
  Highlighter,
  MessageSquare,
  PencilLine,
  Shapes,
  Square,
  StickyNote,
  Triangle,
  Type,
  type LucideIcon
} from 'lucide-react'

const IconByName: Record<string, LucideIcon> = {
  text: Type,
  sticky: StickyNote,
  group: Folder,
  rect: Square,
  ellipse: Circle,
  diamond: Diamond,
  triangle: Triangle,
  'arrow-sticker': ArrowRight,
  callout: MessageSquare,
  highlight: Highlighter,
  draw: PencilLine
}

export const NodeTypeIcon = ({
  icon,
  size = 14,
  strokeWidth = 1.5,
  className
}: {
  icon: string
  size?: number
  strokeWidth?: number
  className?: string
}) => {
  const Icon = IconByName[icon] ?? Shapes

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      className={className}
      aria-hidden="true"
    />
  )
}
