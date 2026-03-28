import {
  useEditor,
  useStoreValue
} from '../../runtime/hooks'

export const Marquee = () => {
  const editor = useEditor()
  const marquee = editor.host.selection.marquee
  const rect = useStoreValue(marquee.rect)
  const match = useStoreValue(marquee.match)

  if (!rect || !match) return null

  return (
    <div
      className="wb-marquee-layer"
      data-match={match}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
