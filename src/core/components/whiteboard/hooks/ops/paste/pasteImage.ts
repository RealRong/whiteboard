import { t } from 'i18next'
import { ObjectStore } from '@/api/stores'
import toast from 'react-hot-toast'
import fileSystem from '@/api/fileSystem'
import { IWhiteboardInstance, XYPosition } from '~/typings'
import trans from '@/consts/trans'

export default async (instance: IWhiteboardInstance, pos: XYPosition) => {
  const clipboardItems = await navigator.clipboard.read()
  for (const i of clipboardItems) {
    const imageType = i.types.find(i => i.startsWith('image/'))
    if (imageType) {
      const blob = await i.getType(imageType)
      const img = await fileSystem.saveImage(blob)
      try {
        const result = await ObjectStore('image')
          .addOneWithMeta(
            {
              url: img
            },
            {
              currentMeta: {
                coverImgSrc: img
              }
            }
          )
          .then(i => i.meta)
        instance.insertMetasAtPointer?.({ clientY: pos.y, clientX: pos.x }, [result.id])
        return
      } catch (e) {
        toast.error(t(trans.Errors.NotSupportedFile))
        console.error(e)
      }
    }
  }
}
