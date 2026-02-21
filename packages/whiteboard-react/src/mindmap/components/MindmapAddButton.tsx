type MindmapAddButtonProps = {
  placement: 'up' | 'down' | 'left' | 'right'
  onClick: () => void
}

export const MindmapAddButton = ({ placement, onClick }: MindmapAddButtonProps) => {
  return (
    <button
      type="button"
      className="wb-mindmap-add-button"
      data-placement={placement}
      data-input-ignore
      data-selection-ignore
      onClick={onClick}
    >
      +
    </button>
  )
}
