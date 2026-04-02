import { useBoardRuntime } from '../../board'
import { useStoreValue } from '../../shared/hooks/useStoreValue'

export const Marquee = () => {
  const editor = useBoardRuntime()
  const marquee = useStoreValue(editor.read.selection.marquee)

  if (!marquee) return null

  return (
    <div
      className="wb-marquee-layer"
      data-match={marquee.match}
      style={{
        transform: `translate(${marquee.rect.x}px, ${marquee.rect.y}px)`,
        width: marquee.rect.width,
        height: marquee.rect.height
      }}
    />
  )
}
