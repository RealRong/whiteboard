type MindmapAddButtonProps = {
  placement: 'up' | 'down' | 'left' | 'right'
  onClick: () => void
}

export const MindmapAddButton = ({ placement, onClick }: MindmapAddButtonProps) => {
  return (
    <div
      className="wb-mindmap-add-button"
      data-placement={placement}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      +
    </div>
  )
}
