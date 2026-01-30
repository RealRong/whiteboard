import { IWhiteboardInstance, MetaObject, XYPosition } from '~/typings'
import { TFunction } from 'i18next'
import { IMenuLayoutItem } from '@/components/base/menu'
import { WhiteboardDefaultKeyboardShortcut } from '@/core/components/whiteboard/hooks/keyboard/DefaultWhiteboardShortcuts'
import Id from '@/utils/id'
import { MetaStore } from '@/api/stores'
import { Icons } from '@/consts'
import { waitFor } from '@/utils'

export default (instance: IWhiteboardInstance, t: TFunction<'translation', undefined, 'translation'>, hasCopied?: boolean) => {
  const handleAddMetaObjectAtToolbarPoint = async (
    metaType: MetaObject['type'],
    opts?: {
      expand?: boolean
    }
  ) => {
    const toolbarState = instance.toolbarOps?.getToolbarState()
    if (toolbarState && toolbarState.originX !== undefined && toolbarState.originY !== undefined) {
      instance.toolbarOps?.closeToolbar()
      const id = Id.getId()
      Global.metaOps.createObjects?.(metaType, meta => {
        instance.insertNode?.({
          x: toolbarState.originX,
          y: toolbarState.originY,
          type: 'metaObject',
          metaObjectId: meta.id,
          expanded: opts?.expand ?? false,
          id
        })
      })
    }
  }
  const addMetaAtToolbarPoint = async (point: XYPosition, m: MetaObject | MetaObject[]) => {
    const arr = Array.isArray(m) ? m : [m]
    const whiteboardObjId = instance.values.id
    if (whiteboardObjId) {
      const whiteboardMeta = MetaStore.getMetaObjectByObjectId(whiteboardObjId)
      if (whiteboardMeta) {
        arr.forEach(i => {
          MetaStore.addMetaLink({ sourceId: i.id, targetId: whiteboardMeta.id })
        })
      }
    }
    arr.forEach(i => {
      const id = Id.getId()
      instance.insertNode?.({
        x: point.x,
        y: point.y,
        type: 'metaObject',
        metaObjectId: i.id,
        expanded: false,
        id
      })
    })
  }
  const items: IMenuLayoutItem[] = [
    ...(hasCopied
      ? [
          {
            type: 'item',
            key: 'paste',
            icon: 'park-clipboard',
            text: t('general.Paste'),
            suffix: WhiteboardDefaultKeyboardShortcut.Paste.text,
            onSelect: () => {
              const toolbarState = instance.toolbarOps?.getToolbarState()
              if (toolbarState && toolbarState.originX !== undefined && toolbarState.originY !== undefined) {
                const transformed = instance.coordOps?.transformWhiteboardPositionToWindowPosition({
                  x: toolbarState.originX,
                  y: toolbarState.originY
                })
                if (!transformed) return
                instance.nodeOps?.paste({
                  x: transformed.x,
                  y: transformed.y
                })
                instance.toolbarOps?.closeToolbar()
              }
            }
          },
          {
            type: 'separator'
          }
        ]
      : []),
    {
      type: 'title',
      name: t('whiteboard.Create new card')
    },
    {
      type: 'item',
      key: 'text',
      icon: 'park-text',
      text: t('whiteboard.Create text card'),
      onSelect: () => {
        const toolbarState = instance.toolbarOps?.getToolbarState()
        if (toolbarState && toolbarState.originX !== undefined && toolbarState.originY !== undefined) {
          const nodeId = Id.getId()
          instance.insertNode?.({
            x: toolbarState.originX,
            y: toolbarState.originY,
            type: 'text',
            width: 350,
            id: nodeId,
            content: [
              {
                type: 'paragraph',
                children: [{ text: '' }],
                id: Id.getId()
              }
            ]
          })
          instance.containerOps?.fitTo({
            left: toolbarState.originX,
            top: toolbarState.originY,
            width: 200,
            height: 30
          })
          setTimeout(() => {
            const nodeFuncs = instance.nodeOps?.getNodeFuncs(nodeId)
            if (nodeFuncs) {
              nodeFuncs.setNodeState(s => ({ ...s, selected: true, focused: true }))
              nodeFuncs.focusText?.()
            }
          }, 200)
          instance.toolbarOps?.closeToolbar()
        }
      }
    },
    {
      type: 'item',
      key: 'card',
      icon: Global.utils.getIcon('note'),
      text: t('whiteboard.Create document card'),
      onSelect: async () => {
        await handleAddMetaObjectAtToolbarPoint('note')
      }
    },
    {
      type: 'item',
      key: 'mindmap',
      icon: 'park-mindmap-map',
      text: t('whiteboard.Create mindmap'),
      onSelect: async () => {
        const toolbarState = instance.toolbarOps?.getToolbarState()
        if (!toolbarState) return
        const nodeId = Id.getId()
        const defaultColor = '#67C6E3'
        instance.insertNode?.({
          x: toolbarState.originX,
          y: toolbarState.originY,
          type: 'mindmap',
          width: 350,
          id: nodeId,
          rightChildren: [],
          leftChildren: [],
          edgeType: 'curve',
          edgeColor: defaultColor,
          borderType: 'round',
          border: defaultColor,
          nodeType: 'text',
          content: [{ type: 'paragraph', children: [{ text: '' }], id: Id.getId() }]
        })
        waitFor(
          () => !!instance.nodeOps?.getNodeFuncs(nodeId)?.focusText,
          () => {
            instance.nodeOps?.getNodeFuncs(nodeId)?.focusText?.()
          }
        )
        instance.toolbarOps?.closeToolbar()
      }
    },
    {
      type: 'item',
      key: 'object',
      icon: Icons.ApplicationAll,
      text: t('general.New file'),
      onSelect: async () => {
        const toolbarState = instance.toolbarOps?.getToolbarState()
        instance.toolbarOps?.closeToolbar()
        if (toolbarState && toolbarState.originX !== undefined && toolbarState.originY !== undefined) {
          Global.metaOps.createObjects?.(undefined, m => {
            addMetaAtToolbarPoint(
              {
                x: toolbarState.originX!,
                y: toolbarState.originY!
              },
              m
            )
          })
        }
      }
    },
    {
      type: 'item',
      key: 'library',
      icon: 'custom-card-library',
      text: t('general.Import from library'),
      onSelect: async () => {
        const toolbarState = instance.toolbarOps?.getToolbarState()
        instance.toolbarOps?.closeToolbar()
        if (toolbarState && toolbarState.originX !== undefined && toolbarState.originY !== undefined) {
          Global.commonOps?.importFromLibrary?.().then(res => {
            addMetaAtToolbarPoint(
              {
                x: toolbarState.originX!,
                y: toolbarState.originY!
              },
              res
            )
          })
        }
      }
    }
  ].filter(i => i) as IMenuLayoutItem[]
  return items
}
