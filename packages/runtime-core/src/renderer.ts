import { ShapeFlags } from '@vue/shared'
import type { VNode } from './vnode'
import { Fragment, Text, ELEMENT } from './vnode'

export interface RendererOptions {
  //   设置element的属性props打补丁
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  //   设置element的text
  setElementText(node: Element, text: string): void
  //   插入element到parent，achor为null时，表示插入到末尾
  insert(el: any, parent: Element, anchor?: any): void
  //   创建element
  createElement(type: string): any
}
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}
function baseCreateRenderer(options: RendererOptions): any {
  const {
    insert: hostInsert,
    setElementText: hostSetElementText,
    createElement: hostCreateElement,
    patchProp: hostPatchProp
  } = options
  const processElement = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      mountElement(newVNode, container, anchor)
    } else {
      // todo:更新
    }
  }
  const mountChildren = (children: any, container: any) => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      patch(null, child, container)
    }
  }
  const mountElement = (vnode: VNode, container: any, anchor: any = null) => {
    // 创建element
    const el = (vnode.el = hostCreateElement(vnode.type))
    const { children, props, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置element的text
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 递归调用patch
      mountChildren(children, el)
    }
    // 设置element的props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    // 插入element
    hostInsert(el, container, anchor)
  }
  const patch = (
    oldVNode: any,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode === newVNode) {
      return
    }
    const { type, shapeFlag } = newVNode
    switch (type) {
      case Text:
        break
      case Fragment:
        break
      case ELEMENT:
        break

      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
        }
        break
    }
  }

  const render = (vnode: VNode | null, container: any) => {
    if (vnode === null) {
    } else {
      patch(container._vnode || null, vnode, container)
    }
  }
  return { render }
}
