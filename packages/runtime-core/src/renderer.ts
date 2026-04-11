import { EMPTY_OBJ, ShapeFlags } from '@vue/shared'
import type { VNode } from './vnode'
import { Fragment, Text, ELEMENT } from './vnode'

export interface RendererOptions {
  //   设置element的属性props打补丁
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  //   设置element的text
  setElementText(node: Element, text: string): void
  //   插入element到parent，achor为null时，表示插入到末尾
  insert(el: any, parent: Element, anchor?: any): void
  //   移除element
  remove(el: any): void
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
    patchProp: hostPatchProp,
    remove: hostRemove
  } = options
  const processElement = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    // debugger
    if (oldVNode == null) {
      mountElement(newVNode, container, anchor)
    } else {
      // 更新
      patchElement(oldVNode, newVNode)
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
  const patchElement = (oldVNode: VNode, newVNode: VNode) => {
    const el = (newVNode.el = oldVNode.el)
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ
    patchProps(el, newVNode, oldProps, newProps)
    patchChildren(oldVNode, newVNode, el, null)
  }
  const patchChildren = (
    oldVNode: any,
    newVNode: any,
    container: any,
    anchor: any = null
  ) => {
    const c1 = oldVNode?.children
    const prevShapeFlag = oldVNode?.shapeFlag
    const c2 = newVNode?.children
    const newShapeFlag = newVNode?.shapeFlag
    if (newShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 删除老的children
        unmountChildren(c1)
      }
      if (c1 !== c2) {
        // 设置element的text
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // todo diff
        } else {
          // 删除老的children
          unmountChildren(c1)
          // 挂载新的children
          mountChildren(c2, container)
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除老的children
          hostSetElementText(container, '')
        }
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 挂载新的children
          mountChildren(c2, container)
        }
      }
    }
  }
  const patchProps = (
    el: Element,
    vnode: VNode,
    oldProps: any,
    newProps: any
  ) => {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const prev = oldProps[key]
        const next = newProps[key]
        if (prev !== next) {
          hostPatchProp(el, key, prev, next)
        }
      }
      if (oldProps !==EMPTY_OBJ) {
        for (const key in oldProps) {
        if (!(key in newProps)) {
          hostPatchProp(el, key, oldProps[key], null)
        }
        }   
      }
    }
  }
  const unmountChildren = (children: any) => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      // 只有当子节点有 el 属性（已挂载到 DOM）时才移除
      if (child && child.el) {
        hostRemove(child.el)
      }
    }
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
      if (container._vnode) {
        // unmount
        container._vnode = null
      }
    } else {
      patch(container._vnode || null, vnode, container)
      container._vnode = vnode
    }
  }
  return { render }
}
