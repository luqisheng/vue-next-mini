import { EMPTY_OBJ, ShapeFlags } from '@vue/shared'
import type { VNode } from './vnode'
import { Fragment, Text, ELEMENT, isSameVNodeType } from './vnode'

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
  
  // 组件实例接口
  interface ComponentInstance {
    vnode: VNode
    subTree: VNode | null
    render: Function
    update: Function | null
    container: any  // 保存容器引用
    anchor: any     // 保存锚点引用
  }
  
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
  
  // 处理组件
  const processComponent = (
    oldVNode: VNode | null,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      mountComponent(newVNode, container, anchor)
    } else {
      updateComponent(oldVNode, newVNode)
    }
  }
  
  // 挂载组件
  const mountComponent = (
    initialVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    // 创建组件实例
    const instance: ComponentInstance = {
      vnode: initialVNode,
      subTree: null,
      render: initialVNode.type.render,
      update: null,
      container,
      anchor
    }
    
    // 将实例保存到vnode上
    initialVNode.component = instance
    
    // 渲染组件
    setupRenderEffect(instance)
  }
  
  // 设置渲染effect
  const setupRenderEffect = (
    instance: ComponentInstance
  ) => {
    const { container, anchor } = instance
    
    // 渲染组件的子树
    const subTree = instance.render.call(instance)
    
    // 递归patch子树
    patch(null, subTree, container, anchor)
    
    // 保存子树引用
    instance.subTree = subTree
    
    // 将组件的DOM元素引用保存到vnode.el
    instance.vnode.el = subTree.el
  }
  
  // 更新组件
  const updateComponent = (
    oldVNode: VNode,
    newVNode: VNode
  ) => {
    // 获取组件实例
    const instance = (newVNode.component = oldVNode.component)!
    
    // 更新vnode引用
    instance.vnode = newVNode
    
    // 重新渲染
    const nextSubTree = instance.render.call(instance)
    
    // patch旧的子树和新的子树，使用保存的container和anchor
    patch(instance.subTree, nextSubTree, instance.container, instance.anchor)
    
    // 更新子树引用
    instance.subTree = nextSubTree
    newVNode.el = nextSubTree.el
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
    patchChildren(oldVNode, newVNode, el, null)
    patchProps(el, newVNode, oldProps, newProps)
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
      if (c2 !== c1) {
        // 设置element的text
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // array to array - 简单的全量更新实现
          // TODO: 后续可以实现完整的 diff 算法
          const commonLength = Math.min(c1.length, c2.length)
          
          // 1. patch 共同长度的子节点
          for (let i = 0; i < commonLength; i++) {
            patch(c1[i], c2[i], container, anchor)
          }
          
          // 2. 如果新数组更长，挂载新增的子节点
          if (c2.length > c1.length) {
            for (let i = commonLength; i < c2.length; i++) {
              patch(null, c2[i], container, anchor)
            }
          }
          
          // 3. 如果旧数组更长，卸载多余的子节点
          if (c1.length > c2.length) {
            for (let i = commonLength; i < c1.length; i++) {
              unmount(c1[i])
            }
          }
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
      if (oldProps !== EMPTY_OBJ) {
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
  const unmount = (vnode: any) => {
    const parent = vnode.el.parentNode
    if (parent) {
      hostRemove(vnode.el)
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
    console.log('patch', oldVNode, newVNode)
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
      unmount(oldVNode)
      oldVNode = null
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
          processComponent(oldVNode, newVNode, container, anchor)
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
