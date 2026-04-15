import { EMPTY_OBJ, isString } from '@vue/shared'
import type { VNode } from './vnode'
import { Fragment, Text, Comment, isSameVNodeType } from './vnode'
import { normalizeVNode, renderComponentRoot } from './componentRenderUtils'
import { createComponentInstance, setupComponent } from './component'
import { ReactiveEffect } from '@vue/reactivity'
import { queuePreFlushCb } from './scheduler'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { createAppAPI } from './apiCreateApp'
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
  createText(text: string): any
  setText(node: Element, text: string): void
  createComment(text: string): any
}
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}
function baseCreateRenderer(options: RendererOptions): any {
  const {
    insert: hostInsert,
    setElementText: hostSetElementText,
    createElement: hostCreateElement,
    createText: hostCreateText,
    patchProp: hostPatchProp,
    remove: hostRemove,
    setText: hostSetText,
    createComment: hostCreateComment
  } = options
  const processText = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      newVNode.el = hostCreateText(newVNode.children)
      hostInsert(newVNode.el, container, anchor)
    } else {
      const el = (newVNode.el = oldVNode.el!)
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children)
      }
    }
  }
  const processCommentNode = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      newVNode.el = hostCreateComment(newVNode.children)
      hostInsert(newVNode.el, container, anchor)
    } else {
      newVNode.el = oldVNode.el
    }
  }
  const processFragment = (
    oldVNode: VNode | null,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      mountChildren(newVNode.children, container, anchor)
    } else {
      patchChildren(oldVNode, newVNode, container, anchor)
    }
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
    initialVNode.component = createComponentInstance(initialVNode)
    const instance = initialVNode.component
    setupComponent(instance)
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  // 设置渲染effect
  const setupRenderEffect = (
    instance: any,
    initialVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const { bm, m } = instance
        bm?.()
        const subTree = (instance.subTree = renderComponentRoot(instance))
        patch(null, subTree as any, container, anchor)
        m?.()
        initialVNode.el = (subTree as any).el
        instance.isMounted = true
      } else {
        let { next, vnode } = instance
        if (!next) {
          next = vnode
        }
        const nextTree = renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree
        patch(prevTree, nextTree, container, anchor)
        next.el = nextTree.el
      }
    }
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)
    ))
    const update = (instance.update = () => {
      effect.run()
    })
    update()
  }

  // 更新组件
  const updateComponent = (oldVNode: VNode, newVNode: VNode) => {
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

  const mountChildren = (children: any, container: any, anchor: any = null) => {
    if (isString(children)) {
      children = children.split('')
    }
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor)
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
          // TODO: diff
          patchKeyedChildren(c1, c2, container, anchor)
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
  // 最长递增子序列算法（LIS）
  const getSequence = (arr: number[]): number[] => {
    const result = [0]
    const predecessors = arr.slice()

    for (let i = 0; i < arr.length; i++) {
      const arrI = arr[i]
      if (arrI === 0) continue

      const resultLastIndex = result[result.length - 1]
      if (arr[resultLastIndex] < arrI) {
        predecessors[i] = resultLastIndex
        result.push(i)
        continue
      }

      let start = 0
      let end = result.length - 1
      while (start < end) {
        const mid = (start + end) >> 1
        if (arr[result[mid]] < arrI) {
          start = mid + 1
        } else {
          end = mid
        }
      }

      if (arrI < arr[result[start]]) {
        if (start > 0) {
          predecessors[i] = result[start - 1]
        }
        result[start] = i
      }
    }

    let len = result.length
    let last = result[len - 1]
    while (len-- > 0) {
      result[len] = last
      last = predecessors[last]
    }

    return result
  }

  const patchKeyedChildren = (
    oldChildren: any,
    newChildren: any,
    container: any,
    parentAnchor: any = null
  ) => {
    let i = 0
    let oldChildrenEnd = oldChildren.length - 1
    let newChildrenEnd = newChildren.length - 1

    // 1. 从前向后同步
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      i++
    }

    // 2. 从后向前同步
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = newChildren[newChildrenEnd]
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // 3. 新节点多于旧节点，需要挂载
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        // 锚点：下一个节点的 el，如果是最后一个则为 parentAnchor
        const nextPos = newChildrenEnd + 1
        const anchor =
          nextPos < newChildren.length ? newChildren[nextPos].el : parentAnchor
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }
    // 4. 旧节点多于新节点，需要卸载
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
      }
    }
    // 5. 未知序列（中间乱序）- 使用 LIS 优化
    else {
      console.log(
        '处理未知序列，i:',
        i,
        'oldChildrenEnd:',
        oldChildrenEnd,
        'newChildrenEnd:',
        newChildrenEnd
      )

      // s1: 旧子节点列表中待处理节点的起始索引
      const s1 = i
      // s2: 新子节点列表中待处理节点的起始索引
      const s2 = i

      // 步骤1: 创建新节点的 key -> index 映射表，用于快速查找
      const keyToNewIndexMap = new Map()
      for (let j = s2; j <= newChildrenEnd; j++) {
        const newVNode = normalizeVNode(newChildren[j])
        if (newVNode.key != null) {
          keyToNewIndexMap.set(newVNode.key, j)
        }
      }

      // 需要处理的节点总数（新节点数量）
      const toBePatched = newChildrenEnd - s2 + 1
      let patched = 0 // 已处理的节点计数

      // newIndexToOldIndexMap: 记录每个新节点对应的旧节点索引
      // 值为 0 表示该新节点在旧节点中不存在（需要挂载）
      // 值为 j+1 表示对应旧节点数组中的索引 j（+1 是为了区分 0）
      const newIndexToOldIndexMap = new Array(toBePatched).fill(0)

      // moved: 标记节点顺序是否发生变化
      let moved = false
      // maxNewIndexSoFar: 记录遍历过程中遇到的最大新索引，用于判断是否需要移动
      let maxNewIndexSoFar = 0

      // 步骤2: 遍历旧节点，进行卸载或更新操作
      for (let j = s1; j <= oldChildrenEnd; j++) {
        const oldVNode = oldChildren[j]

        // 如果所有新节点都已处理完，剩余的旧节点都需要卸载
        if (patched >= toBePatched) {
          unmount(oldVNode)
          continue
        }

        let newIndex: number | undefined

        // 尝试通过 key 查找对应的新节点
        if (oldVNode.key != null) {
          newIndex = keyToNewIndexMap.get(oldVNode.key)
        } else {
          // 没有 key 的节点，通过类型匹配在剩余未处理的新节点中查找
          for (let k = s2; k <= newChildrenEnd; k++) {
            // 只查找还未被匹配的节点（newIndexToOldIndexMap[k - s2] === 0）
            if (newIndexToOldIndexMap[k - s2] === 0) {
              const newVNode = normalizeVNode(newChildren[k])
              if (isSameVNodeType(oldVNode, newVNode)) {
                newIndex = k
                break
              }
            }
          }
        }

        if (newIndex === undefined) {
          // 旧节点在新节点中找不到对应项，需要卸载
          console.log('卸载不在新节点中的旧节点:', oldVNode.key)
          unmount(oldVNode)
        } else {
          // 找到对应的新节点，记录映射关系（索引+1，避免与 0 混淆）
          newIndexToOldIndexMap[newIndex - s2] = j + 1

          // 判断节点顺序是否变化：如果当前新索引小于之前记录的最大索引，说明顺序乱了
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true // 标记需要移动
          }

          // 递归 patch 更新节点
          const newVNode = normalizeVNode(newChildren[newIndex])
          console.log(
            '更新已存在的节点:',
            oldVNode.key,
            '从索引',
            j,
            '到',
            newIndex
          )
          patch(oldVNode, newVNode, container, null)
          patched++
        }
      }

      // 步骤3: 计算最长递增子序列（LIS），优化 DOM 移动操作
      // LIS 中的节点保持相对顺序不变，不需要移动
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : []

      // 步骤4: 从后向前遍历新节点，执行挂载或移动操作
      let j = increasingNewIndexSequence.length - 1 // LIS 指针，从末尾开始

      for (let k = toBePatched - 1; k >= 0; k--) {
        const nextIndex = s2 + k // 新节点在完整列表中的实际索引
        // 确定插入位置的锚点：下一个兄弟节点的 el，或者父节点的锚点
        const anchor =
          nextIndex + 1 < newChildren.length
            ? normalizeVNode(newChildren[nextIndex + 1]).el
            : parentAnchor

        const newVNode = normalizeVNode(newChildren[nextIndex])

        if (newIndexToOldIndexMap[k] === 0) {
          // 情况1: 新节点（在旧节点中不存在），需要挂载
          console.log('挂载新的有key节点:', newVNode.key)
          patch(null, newVNode, container, anchor)
        } else if (moved) {
          // 情况2: 已存在但可能需要移动的节点
          // 如果当前索引不在 LIS 中，则需要移动到正确位置
          if (j < 0 || k !== increasingNewIndexSequence[j]) {
            console.log('移动节点:', newVNode.key, 'anchor:', anchor)
            move(newVNode, container, anchor)
          } else {
            // 在 LIS 中，顺序正确，无需移动，移动 LIS 指针
            j--
          }
        }
        // 情况3: moved=false 且节点已存在，无需任何操作（已在步骤2中更新）
      }
    }
  }
  const move = (vnode: VNode, container: any, anchor: any) => {
    const { el } = vnode
    hostInsert(el, container, anchor)
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
    // 防御性检查：确保 vnode.el 存在且已挂载到 DOM
    if (!vnode || !vnode.el) {
      console.warn('Attempting to unmount a vnode without el property:', vnode)
      return
    }
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
    console.log('patchElement', type)
    switch (type) {
      case Text:
        processText(oldVNode, newVNode, container, anchor)
        break
      case Comment:
        console.log('patchCommentNode', newVNode)
        processCommentNode(oldVNode, newVNode, container, anchor)
        break
      case Fragment:
        processFragment(oldVNode, newVNode, container, anchor)
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
  return { render, createApp: createAppAPI(render) }
}
