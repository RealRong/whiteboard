import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { IMenuLayoutItem } from '@/components/base/menu'
import { WhiteboardDefaultKeyboardShortcut } from '@/core/components/whiteboard/hooks/keyboard/DefaultWhiteboardShortcuts'
import BlockColorPicker from '@/core/components/editor/components/BlockColorPicker'
import { defaultBgColor } from '@/components/picker/colorPicker'
import { TFunction } from 'i18next'
import getContextMenu from '@/core/components/whiteboard/toolbars/contextMenus/getContextMenu'
import { MetaStore, NoteStore } from '@/api/stores'
import getVisibleNodeMenuItems from '@/core/components/whiteboard/toolbars/contextMenus/getVisibleNodeMenuItems'
import { WhiteboardNodeMenuItems } from '@/core/components/whiteboard/toolbars/contextMenus/items'
import trans from '@/consts/trans'
import { Icons } from '@/consts'
import WhiteboardCardFormatter from '@/core/components/whiteboard/toolbars/WhiteboardCardFormatter'
import { noRepeatArray } from '@/utils'

export default (
  instance: IWhiteboardInstance,
  t: TFunction<'translation', undefined, 'translation'>,
  ids?: number | number[],
  hasCopied?: boolean
): IMenuLayoutItem[] | null => {
  const selected = ((ids ? (Array.isArray(ids) ? ids : [ids]) : undefined) || instance.selectOps?.getSelectedNodes().map(i => i.id))
    ?.map(id => {
      try {
        return instance.getNode?.(id)
      } catch (e) {
        console.error(e)
      }
    })
    .filter(i => i) as IWhiteboardNode[] | undefined
  // some nodes can't be folded or expanded
  const canExpandOrFold = selected?.length && selected.some(i => instance.nodeOps?.canExpand(i))
  const showExpandIcon = selected?.length && selected.some(i => instance.nodeOps?.canExpand(i) && !i.expanded)
  if (!selected?.length) return null
  const menuItem = WhiteboardNodeMenuItems(instance, selected)
  const selectedIds = selected.map(i => i.id)
  // click on group head
  const ifContextMenuOnSingleGroup = selected.length === 1 && selected[0].type === 'group'
  const backgrounds = noRepeatArray(selected.map(i => i.background).filter(Boolean))
  const borders = noRepeatArray(selected.map(i => i.border).filter(Boolean))
  const menuItems = getVisibleNodeMenuItems(selected)
  const commonTools: (IMenuLayoutItem | undefined)[] = [
    ...(ifContextMenuOnSingleGroup
      ? [
          hasCopied
            ? {
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
              }
            : undefined,
          {
            type: 'item',
            key: 'create-on-group',
            text: t('whiteboard.Create new card'),
            icon: 'park-plus',
            subMenuStyle: {
              minWidth: 200
            },
            subMenu: [...getContextMenu(instance, t)]
          },
          {
            type: 'item',
            key: 'export-group-image',
            text: t('general.Export as image'),
            icon: 'park-download-four',
            onSelect: () => {
              instance.selectOps?.deselectAll()
              setTimeout(() => {
                instance.groupOps?.exportGroupImage(selected[0].id)
              }, 10)
            }
          },
          { type: 'separator' }
        ]
      : []),
    menuItems.isText
      ? {
          type: 'item',
          key: 'turn-into-document',
          icon: Global.utils.getIcon('note'),
          text: t('whiteboard.Turn into document card'),
          onSelect: async () => {
            instance.toolbarOps?.closeToolbar()
            instance.selectOps?.deselectAll()
            const currentText = selected[0] as IWhiteboardNode & { type: 'text' }
            const note = await NoteStore.initializeNoteWithValue(currentText.content)
            const noteMeta = await MetaStore.addMetaObject({ objectId: note.id, type: 'note' })
            // instance.deleteNode?.(selected[0].id)
            instance.updateNode?.(selected[0].id, s => ({
              ...s,
              x: selected[0].x,
              y: selected[0].y,
              type: 'metaObject',
              metaObjectId: noteMeta.id,
              expanded: true
            }))
          }
        }
      : undefined,
    selected.length === 1
      ? {
          type: 'item',
          key: 'draw-line',
          icon: 'park-arrow-right-up',
          text: t('whiteboard.Draw connection'),
          suffix: WhiteboardDefaultKeyboardShortcut.DrawLine.text,
          onSelect: () => {
            instance.setFocused?.(true)
            instance.edgeOps?.startDrawEdge(selected[0].id)
            instance.toolbarOps?.closeToolbar()
          }
        }
      : undefined,
    canExpandOrFold
      ? {
          key: 'expand',
          type: 'item',
          text: !showExpandIcon ? t('whiteboard.Fold') : t('whiteboard.Expand'),
          icon: !showExpandIcon ? 'park-click-to-fold' : 'park-full-screen-one',
          suffix: WhiteboardDefaultKeyboardShortcut.Expand.text,
          onSelect: () => {
            if (showExpandIcon) {
              instance.nodeOps?.expand(selectedIds)
            } else {
              instance.nodeOps?.fold(selectedIds)
            }
            setTimeout(() => {
              instance.selectOps?.resetSelectionBox()
            }, 100)
            instance.toolbarOps?.closeToolbar()
          }
        }
      : undefined,
    {
      type: 'item',
      key: 'background-color',
      icon: 'park-background-color',
      text: t('whiteboard.Card style'),
      align: 'center',
      popOver: {
        key: 'bg-color',
        node: (
          <WhiteboardCardFormatter
            onBorderChange={b => {
              instance.updateWhiteboard?.(w => {
                selected.forEach(n => {
                  const o = w.nodes?.get(n.id)
                  if (o) {
                    w.nodes?.set(o.id, {
                      ...o,
                      border: b
                    })
                  }
                })
              }, true)
            }}
            showBorder={menuItems.showBorderType}
            background={backgrounds.length === 1 ? backgrounds[0] : undefined}
            border={borders.length === 1 ? borders[0] : undefined}
            onBorderTypeChange={t => {
              instance.updateWhiteboard?.(w => {
                selected.forEach(n => {
                  const o = w.nodes?.get(n.id)
                  if (o) {
                    w.nodes?.set(o.id, {
                      ...o,
                      borderType: t
                    })
                  }
                })
              }, true)
            }}
            onBackgroundChange={b => {
              instance.updateWhiteboard?.(w => {
                selected.forEach(n => {
                  const o = w.nodes?.get(n.id)
                  if (o) {
                    w.nodes?.set(o.id, {
                      ...o,
                      background: b
                    })
                  }
                })
              }, true)
            }}
          />
        )
      }
    },
    {
      type: 'item',
      key: 'card-actions',
      icon: 'park-application-two',
      text: t('whiteboard.Card actions'),
      subMenuStyle: {
        width: 240
      },
      subMenu: [
        {
          type: 'item',
          key: 'fitIntoView',
          icon: 'park-focus-one',
          text: t('whiteboard.Fit into view'),
          suffix: WhiteboardDefaultKeyboardShortcut.FitIntoView.text,
          onSelect: () => {
            instance.containerOps?.fitToSelected()
            instance.toolbarOps?.closeToolbar()
          }
        },
        {
          type: 'item',
          key: 'fit-into-content',
          text: t('whiteboard.Fit to content'),
          icon: 'park-auto-height-one',
          suffix: WhiteboardDefaultKeyboardShortcut.FitToContent.text,
          onSelect: () => {
            if (selected?.length) {
              instance.nodeOps?.fitContent(selected?.map(i => i.id))
            }
            instance.toolbarOps?.closeToolbar()
          }
        },
        {
          type: 'item',
          key: 'copy',
          text: t('general.Copy'),
          suffix: WhiteboardDefaultKeyboardShortcut.Copy.text,
          icon: 'park-copy',
          onSelect: () => {
            if (selected?.length) {
              instance.nodeOps?.copy(instance.nodeOps?.extendNodes(selected).map(i => i.id))
            }
            instance.toolbarOps?.closeToolbar()
          }
        },
        {
          type: 'item',
          key: 'highlight-related',
          text: t('whiteboard.Highlight related cards'),
          suffix: WhiteboardDefaultKeyboardShortcut.HighlightRelated.text,
          icon: 'park-circular-connection',
          onSelect: () => {
            if (selected?.length) {
              instance.nodeOps?.highlightRelatedEdgesAndNodes(selected?.map(i => i.id))
            }
            instance.toolbarOps?.closeToolbar()
          }
        },
        ...(menuItems.showMetaOptions
          ? [
              {
                type: 'title',
                name: t('general.Open in'),
                style: {
                  margin: '8px 0px 4px'
                }
              },
              ...(instance.nodeOps?.canExpand(selected[0])
                ? [
                    {
                      type: 'item',
                      key: 'open-in-side-peek',
                      text: t('whiteboard.Open in side peek'),
                      icon: 'custom-right-bar',
                      onSelect: () => {
                        instance.nodeOps?.open(selected[0].id, 'sidePeek')
                        instance.toolbarOps?.closeToolbar()
                      }
                    },
                    {
                      type: 'item',
                      key: 'open-in-float',
                      icon: 'park-history-query',
                      text: t('whiteboard.Open in floating panel'),
                      onSelect: () => {
                        instance.nodeOps?.open(selected[0].id, 'float')
                        instance.toolbarOps?.closeToolbar()
                      }
                    }
                  ]
                : []),
              {
                type: 'item',
                key: 'open-in-new-tab',
                icon: 'park-efferent-three',
                text: t('whiteboard.Open in new tab'),
                onSelect: () => {
                  instance.nodeOps?.open(selected[0].id, 'newTab')
                  instance.toolbarOps?.closeToolbar()
                }
              }
            ]
          : [])
      ].filter(i => i)
    },
    menuItems.showMindmapConnection ? menuItem.MindmapLineOptions : undefined,
    ...(menuItems.showGroupOptions
      ? [
          {
            type: 'separator'
          },
          {
            type: 'item',
            key: 'create-group',
            text: t('whiteboard.Create group'),
            icon: 'custom-group',
            suffix: WhiteboardDefaultKeyboardShortcut.Group.text,
            onSelect: () => {
              if (selected?.length) {
                instance.groupOps?.groupNodes(selectedIds)
              }
              instance.toolbarOps?.closeToolbar()
            }
          },
          menuItems.showAlignPackOptions
            ? {
                type: 'item',
                key: 'align',
                text: t('whiteboard.Align cards'),
                icon: 'park-left-alignment',
                subMenu: [
                  {
                    icon: 'park-align-horizontally',
                    key: 'horizontallyCenter',
                    type: 'item',
                    text: t('whiteboard.Align horizontally center'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'horizontallyCenter')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-align-vertically',
                    key: 'verticallyCenter',
                    type: 'item',
                    text: t('whiteboard.Align vertically center'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'verticallyCenter')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-align-left',
                    key: 'left',
                    type: 'item',
                    text: t('whiteboard.Align left'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'left')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },

                  {
                    icon: 'park-align-right',
                    key: 'right',
                    type: 'item',
                    text: t('whiteboard.Align right'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'right')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-align-top',
                    key: 'top',
                    type: 'item',
                    text: t('whiteboard.Align top'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'top')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-align-bottom',
                    key: 'bottom',
                    type: 'item',
                    text: t('whiteboard.Align bottom'),
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.alignNodes(selected, 'bottom')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  }
                ]
              }
            : undefined,
          menuItems.showAlignPackOptions
            ? {
                type: 'item',
                key: 'arrange',
                text: t('whiteboard.Distribute cards'),
                icon: 'park-waterfalls-v',
                subMenu: [
                  {
                    icon: 'park-horizontal-tidy-up',
                    key: 'horizontallySpacing',
                    text: t('whiteboard.Distribute horizontally'),
                    type: 'item',
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.layoutNodes(selected, 'horizontallySpacing')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-vertical-tidy-up',
                    key: 'verticallySpacing',
                    text: t('whiteboard.Distribute vertically'),
                    type: 'item',
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.layoutNodes(selected, 'verticallySpacing')
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-waterfalls-h',
                    key: 'pack',
                    text: t('whiteboard.Pack layout'),
                    type: 'item',
                    onSelect: () => {
                      if (selected?.length) {
                        instance.layoutOps?.packNodes(selected)
                      }
                      instance.toolbarOps?.closeToolbar()
                    }
                  },
                  {
                    icon: 'park-grid-nine',
                    key: 'auto'
                  }
                ]
              }
            : undefined
        ].filter(i => i)
      : []),
    {
      type: 'separator'
    },
    ...(menuItems.showMetaOptions
      ? [
          {
            type: 'item',
            key: 'view-details',
            text: t('general.View details'),
            suffix: WhiteboardDefaultKeyboardShortcut.ViewDetails.text,
            icon: 'park-info',
            onSelect: () => {
              const item = selected[0].type === 'metaObject' && selected[0].metaObjectId
              item && Global.metaOps?.openDetails(item)
              instance.toolbarOps?.closeToolbar()
            }
          },
          {
            type: 'item',
            key: 'move-to',
            suffix: WhiteboardDefaultKeyboardShortcut.MoveTo.text,
            text: t(trans.Meta.MoveTo),
            icon: Icons.MoveTo,
            onSelect: () => {
              const item = selected[0].type === 'metaObject' && selected[0].metaObjectId
              item && Global.metaOps.quickAdd?.(item)
              instance.toolbarOps?.closeToolbar()
            }
          },
          {
            type: 'item',
            key: 'edit-meta',
            text: t(trans.Edit),
            icon: Icons.Edit,
            suffix: WhiteboardDefaultKeyboardShortcut.Edit.text,
            onSelect: () => {
              const item = selected[0].type === 'metaObject' && selected[0].metaObjectId
              item && Global.metaOps.edit?.(item)
              instance.toolbarOps?.closeToolbar()
            }
          },
          {
            type: 'item',
            key: 'copy-link',
            text: t(trans.CopyLink),
            icon: Icons.Link,
            onSelect: () => {
              const item = selected[0].type === 'metaObject' && selected[0].metaObjectId
              item && Global.metaOps?.copyLink(item)
              instance.toolbarOps?.closeToolbar()
            }
          }
        ]
      : []),
    selected.length > 1 && selected.some(i => i.type === 'metaObject')
      ? {
          type: 'item',
          key: 'move-to',
          text: t('general.Move to'),
          icon: 'park-corner-up-right',
          suffix: WhiteboardDefaultKeyboardShortcut.MoveTo.text,
          onSelect: () => {
            const items = selected.filter(i => i.type === 'metaObject')
            if (items.length) {
              Global.metaOps?.quickAdd(items.map(i => i.metaObjectId))
            }
            instance.toolbarOps?.closeToolbar()
          }
        }
      : undefined,
    {
      type: 'item',
      key: 'delete',
      text: t(trans.Delete),
      suffix: WhiteboardDefaultKeyboardShortcut.Delete.text,
      icon: 'park-delete-one',
      onSelect: () => {
        if (selected?.length) {
          instance.nodeOps?.deleteNode(selected?.map(i => i.id))
          setTimeout(() => {
            instance.selectOps?.resetSelectionBox()
          })
        }
        instance.toolbarOps?.closeToolbar()
      }
    }
  ].filter(i => i)
  return commonTools
}
