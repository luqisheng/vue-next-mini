/**
 * 渲染器模块 - Vue 虚拟 DOM 的核心引擎
 * 
 * 这是 Vue 运行时最核心的部分，负责：
 * 1. 将虚拟节点（VNode）转换为真实 DOM
 * 2. 通过 diff 算法高效更新 DOM
 * 3. 管理组件的挂载、更新和卸载
 * 4. 处理各种节点类型（元素、文本、注释、片段、组件等）
 * 
 * 渲染器采用平台无关的设计，通过 RendererOptions 接口抽象平台特定的操作，
 * 使得同一套渲染逻辑可以同时用于浏览器 DOM、服务端渲染、原生移动端等场景。
 */
import { EMPTY_OBJ, isString } from '@vue/shared'
import type { VNode } from './vnode'
import { Fragment, Text, Comment, isSameVNodeType } from './vnode'
import { normalizeVNode, renderComponentRoot } from './componentRenderUtils'
import { createComponentInstance, setupComponent } from './component'
import { ReactiveEffect } from '@vue/reactivity'
import { queuePreFlushCb } from './scheduler'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { createAppAPI } from './apiCreateApp'

/**
 * 渲染器配置接口
 * 
 * 定义了平台特定的 DOM 操作方法，渲染器通过这些方法与具体平台交互。
 * 这种设计使得渲染器本身不依赖任何平台实现，保持了高度的可移植性。
 */
export interface RendererOptions {
  /** 设置元素的属性（props） */
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  
  /** 设置元素的文本内容 */
  setElementText(node: Element, text: string): void
  
  /** 插入元素到父容器中，anchor 为 null 时插入到末尾 */
  insert(el: any, parent: Element, anchor?: any): void
  
  /** 移除元素 */
  remove(el: any): void
  
  /** 创建元素 */
  createElement(type: string): any
  
  /** 创建文本节点 */
  createText(text: string): any
  
  /** 设置文本节点的内容 */
  setText(node: Element, text: string): void
  
  /** 创建注释节点 */
  createComment(text: string): any
}

/**
 * 创建渲染器
 * 
 * 对外暴露的 API，根据传入的平台特定选项创建渲染器实例。
 * 
 * @param options - 平台特定的操作选项
 * @returns 包含 render 和 createApp 方法的渲染器对象
 */
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

/**
 * 基础渲染器实现
 * 
 * 这是渲染器的核心实现，包含了所有的渲染逻辑。
 * 使用闭包捕获 platform-specific 的操作方法，形成一个完整的渲染环境。
 * 
 * @param options - 平台特定的操作选项
 * @returns 渲染器对象
 */
function baseCreateRenderer(options: RendererOptions): any {
  // 解构平台操作方法，简化后续调用
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

  // ==================== 特殊节点类型的处理函数 ====================

  /**
   * 处理文本节点
   * 
   * 文本节点是最简单的节点类型，只需要创建或更新文本内容。
   * 
   * @param oldVNode - 旧的虚拟节点（首次渲染时为 null）
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点（插入位置的参考）
   */
  const processText = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      // 首次渲染：创建文本节点并插入到容器
      newVNode.el = hostCreateText(newVNode.children)
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 更新：复用已有的 DOM 元素，只更新文本内容
      const el = (newVNode.el = oldVNode.el!)
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children)
      }
    }
  }

  /**
   * 处理注释节点
   * 
   * 注释节点通常用于调试或占位，不参与实际的渲染。
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const processCommentNode = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      // 首次渲染：创建注释节点
      newVNode.el = hostCreateComment(newVNode.children)
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 更新：直接复用旧节点
      newVNode.el = oldVNode.el
    }
  }

  /**
   * 处理片段节点
   * 
   * Fragment 是一个虚拟容器，不会渲染为真实 DOM，
   * 它的所有子节点会直接渲染到父容器中。
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const processFragment = (
    oldVNode: VNode | null,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      // 首次渲染：挂载所有子节点
      mountChildren(newVNode.children, container, anchor)
    } else {
      // 更新：对比新旧子节点
      patchChildren(oldVNode, newVNode, container, anchor)
    }
  }

  // ==================== 元素节点的处理函数 ====================

  /**
   * 处理元素节点
   * 
   * 元素节点是 HTML 标签，需要创建真实的 DOM 元素并设置属性和子节点。
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const processElement = (
    oldVNode: VNode,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      // 首次渲染：挂载元素
      mountElement(newVNode, container, anchor)
    } else {
      // 更新：对比新旧元素
      patchElement(oldVNode, newVNode)
    }
  }

  // ==================== 组件节点的处理函数 ====================

  /**
   * 处理组件节点
   * 
   * 组件是有状态的复杂节点，需要创建组件实例、执行生命周期、
   * 建立响应式连接等。
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const processComponent = (
    oldVNode: VNode | null,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    if (oldVNode == null) {
      // 首次渲染：挂载组件
      mountComponent(newVNode, container, anchor)
    } else {
      // 更新：更新组件
      updateComponent(oldVNode, newVNode)
    }
  }

  /**
   * 挂载组件
   * 
   * 组件挂载的完整流程：
   * 1. 创建组件实例
   * 2. 初始化组件（执行 setup、处理 Options API）
   * 3. 设置渲染 effect（建立响应式连接）
   * 
   * @param initialVNode - 初始虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const mountComponent = (
    initialVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    // 步骤1：创建组件实例
    initialVNode.component = createComponentInstance(initialVNode)
    const instance = initialVNode.component
    
    // 步骤2：初始化组件（执行 setup、注册生命周期等）
    setupComponent(instance)
    
    // 步骤3：设置渲染 effect，建立响应式更新机制
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  /**
   * 设置渲染 effect
   * 
   * 这是 Vue 响应式系统与渲染系统的桥梁，负责：
   * 1. 创建响应式副作用（ReactiveEffect）
   * 2. 在组件首次渲染时执行 beforeMount/mounted 钩子
   * 3. 在数据变化时触发组件重新渲染
   * 4. 使用调度器批量处理更新，提高性能
   * 
   * @param instance - 组件实例
   * @param initialVNode - 初始虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const setupRenderEffect = (
    instance: any,
    initialVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    /**
     * 组件更新函数
     * 
     * 这个函数会被包装成 ReactiveEffect，当依赖的响应式数据变化时自动执行。
     * 它区分首次挂载和后续更新两种情况。
     */
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // ========== 首次挂载 ==========
        const { bm, m } = instance
        
        // 执行 beforeMount 钩子
        bm?.()
        
        // 执行组件的渲染函数，生成子树（subTree）
        const subTree = (instance.subTree = renderComponentRoot(instance))
        
        // 递归 patch 子树到容器
        patch(null, subTree as any, container, anchor)
        
        // 执行 mounted 钩子
        m?.()
        
        // 将组件的 DOM 引用指向子树的 DOM
        initialVNode.el = (subTree as any).el
        
        // 标记为已挂载
        instance.isMounted = true
      } else {
        // ========== 后续更新 ==========
        let { next, vnode } = instance
        
        // 如果有待处理的更新，使用新的 vnode
        if (!next) {
          next = vnode
        }
        
        // 重新执行渲染函数，生成新的子树
        const nextTree = renderComponentRoot(instance)
        
        // 获取旧的子树
        const prevTree = instance.subTree
        
        // 更新子树引用
        instance.subTree = nextTree
        
        // 对比新旧子树，进行增量更新
        patch(prevTree, nextTree, container, anchor)
        
        // 更新 DOM 引用
        next.el = nextTree.el
      }
    }
    
    // 创建响应式副作用，传入调度器实现批量更新
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)  // 调度器：将更新推入队列
    ))
    
    // 创建更新函数
    const update = (instance.update = () => {
      effect.run()  // 执行 effect，触发组件更新
    })
    
    // 立即执行一次，完成首次渲染
    update()
  }

  /**
   * 更新组件
   * 
   * 当父组件重新渲染导致子组件的 props 变化时，需要更新子组件。
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   */
  const updateComponent = (oldVNode: VNode, newVNode: VNode) => {
    // 获取组件实例（新旧组件共享同一个实例）
    const instance = (newVNode.component = oldVNode.component)!

    // 更新 vnode 引用
    instance.vnode = newVNode

    // 重新执行渲染函数，生成新的子树
    const nextSubTree = instance.render.call(instance)

    // 对比新旧子树，进行增量更新
    patch(instance.subTree, nextSubTree, instance.container, instance.anchor)

    // 更新子树引用
    instance.subTree = nextSubTree
    
    // 更新 DOM 引用
    newVNode.el = nextSubTree.el
  }

  // ==================== 辅助函数 ====================

  /**
   * 挂载子节点列表
   * 
   * 遍历子节点数组，对每个子节点调用 patch 进行挂载。
   * 
   * @param children - 子节点数组
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const mountChildren = (children: any, container: any, anchor: any = null) => {
    // 如果 children 是字符串，拆分为字符数组
    if (isString(children)) {
      children = children.split('')
    }
    
    // 遍历并挂载每个子节点
    for (let i = 0; i < children.length; i++) {
      // 规范化子节点（确保是 VNode）
      const child = (children[i] = normalizeVNode(children[i]))
      patch(null, child, container, anchor)
    }
  }

  /**
   * 挂载元素节点
   * 
   * 完整的元素挂载流程：
   * 1. 创建真实 DOM 元素
   * 2. 设置子节点（文本或数组）
   * 3. 设置属性（props）
   * 4. 插入到容器中
   * 
   * @param vnode - 虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const mountElement = (vnode: VNode, container: any, anchor: any = null) => {
    // 步骤1：创建真实 DOM 元素
    const el = (vnode.el = hostCreateElement(vnode.type))
    
    const { children, props, shapeFlag } = vnode
    
    // 步骤2：设置子节点
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 文本子节点：直接设置文本内容
      hostSetElementText(el, children)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 数组子节点：递归挂载所有子节点
      mountChildren(children, el)
    }
    
    // 步骤3：设置属性（class、style、事件等）
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }
    
    // 步骤4：插入到容器中
    hostInsert(el, container, anchor)
  }

  /**
   * 更新元素节点
   * 
   * 对比新旧元素，增量更新：
   * 1. 更新子节点
   * 2. 更新属性
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   */
  const patchElement = (oldVNode: VNode, newVNode: VNode) => {
    // 复用旧的 DOM 元素
    const el = (newVNode.el = oldVNode.el)
    
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ
    
    // 更新子节点
    patchChildren(oldVNode, newVNode, el, null)
    
    // 更新属性
    patchProps(el, newVNode, oldProps, newProps)
  }

  /**
   * 对比和更新子节点
   * 
   * 这是 diff 算法的核心部分，处理各种子节点变化情况：
   * - 文本 -> 文本：直接替换
   * - 文本 -> 数组：清空文本，挂载数组
   * - 数组 -> 文本：卸载数组，设置文本
   * - 数组 -> 数组：进行 diff 对比（简单全量更新或 keyed diff）
   * 
   * @param oldVNode - 旧的虚拟节点
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
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
      // 新子节点是文本
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 旧子节点是数组：卸载所有旧子节点
        unmountChildren(c1)
      }
      
      // 如果文本内容不同，更新文本
      if (c2 !== c1) {
        hostSetElementText(container, c2)
      }
    } else {
      // 新子节点不是文本（可能是数组或空）
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 旧子节点是数组
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 数组 -> 数组：进行 diff 对比
          patchKeyedChildren(c1, c2, container, anchor)
        } else {
          // 数组 -> 非数组：卸载所有旧子节点
          unmountChildren(c1)
          // 挂载新子节点
          mountChildren(c2, container)
        }
      } else {
        // 旧子节点不是数组
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 旧子节点是文本：清空文本
          hostSetElementText(container, '')
        }
        
        if (newShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 新子节点是数组：挂载所有新子节点
          mountChildren(c2, container)
        }
      }
    }
  }

  // ==================== Keyed Diff 算法 ====================

  /**
   * 最长递增子序列算法（LIS）
   * 
   * 这是一个经典的动态规划算法，用于在 O(n log n) 时间复杂度内
   * 找到数组中最长的递增子序列。
   * 
   * 在 Vue 的 diff 算法中，LIS 用于优化节点移动操作：
   * - LIS 中的节点保持相对顺序不变，不需要移动
   * - 只有不在 LIS 中的节点才需要移动到正确位置
   * - 这样可以最小化 DOM 操作次数
   * 
   * @param arr - 输入数组
   * @returns 最长递增子序列的索引数组
   */
  const getSequence = (arr: number[]): number[] => {
    const result = [0]  // 存储 LIS 的索引
    const predecessors = arr.slice()  // 存储前驱节点索引

    for (let i = 0; i < arr.length; i++) {
      const arrI = arr[i]
      if (arrI === 0) continue  // 跳过无效值

      const resultLastIndex = result[result.length - 1]
      
      // 如果当前值大于 LIS 最后一个值，直接添加到末尾
      if (arr[resultLastIndex] < arrI) {
        predecessors[i] = resultLastIndex
        result.push(i)
        continue
      }

      // 二分查找：找到第一个大于等于 arrI 的位置
      let start = 0
      let end = result.length - 1
      while (start < end) {
        const mid = (start + end) >> 1  // 位运算除法
        if (arr[result[mid]] < arrI) {
          start = mid + 1
        } else {
          end = mid
        }
      }

      // 替换该位置的值
      if (arrI < arr[result[start]]) {
        if (start > 0) {
          predecessors[i] = result[start - 1]
        }
        result[start] = i
      }
    }

    // 回溯构建最终的 LIS 索引数组
    let len = result.length
    let last = result[len - 1]
    while (len-- > 0) {
      result[len] = last
      last = predecessors[last]
    }

    return result
  }

  /**
   * 带 key 的子节点 diff 算法
   * 
   * 这是 Vue diff 算法的核心实现，采用了多阶段优化策略：
   * 
   * 阶段1：从前向后同步（处理头部相同的节点）
   * 阶段2：从后向前同步（处理尾部相同的节点）
   * 阶段3：处理新增节点（新节点多于旧节点）
   * 阶段4：处理删除节点（旧节点多于新节点）
   * 阶段5：处理乱序节点（使用 LIS 优化移动操作）
   * 
   * 这种分阶段的策略可以大幅减少需要 diff 的节点数量，
   * 提高常见场景（如列表头尾不变、中间变化）的性能。
   * 
   * @param oldChildren - 旧的子节点数组
   * @param newChildren - 新的子节点数组
   * @param container - 容器元素
   * @param parentAnchor - 父级锚点
   */
  const patchKeyedChildren = (
    oldChildren: any,
    newChildren: any,
    container: any,
    parentAnchor: any = null
  ) => {
    let i = 0
    let oldChildrenEnd = oldChildren.length - 1
    let newChildrenEnd = newChildren.length - 1

    // ===== 阶段1：从前向后同步 =====
    // 对比头部相同的节点，直到遇到不同的节点为止
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      
      if (isSameVNodeType(oldVNode, newVNode)) {
        // 节点相同，递归 patch 更新
        patch(oldVNode, newVNode, container, null)
      } else {
        // 遇到不同的节点，跳出循环
        break
      }
      i++
    }

    // ===== 阶段2：从后向前同步 =====
    // 对比尾部相同的节点，直到遇到不同的节点为止
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = newChildren[newChildrenEnd]
      
      if (isSameVNodeType(oldVNode, newVNode)) {
        // 节点相同，递归 patch 更新
        patch(oldVNode, newVNode, container, null)
      } else {
        // 遇到不同的节点，跳出循环
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // ===== 阶段3：新节点多于旧节点，需要挂载 =====
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        // 确定插入位置的锚点
        const nextPos = newChildrenEnd + 1
        const anchor =
          nextPos < newChildren.length ? newChildren[nextPos].el : parentAnchor
        
        // 挂载剩余的新节点
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }
    
    // ===== 阶段4：旧节点多于新节点，需要卸载 =====
    else if (i > newChildrenEnd) {
      // 卸载剩余的旧节点
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
      }
    }
    
    // ===== 阶段5：未知序列（中间乱序）- 使用 LIS 优化 =====
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

  /**
   * 移动节点
   * 
   * 将节点移动到容器中的指定位置（由 anchor 决定）。
   * 
   * @param vnode - 要移动的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点（插入位置的参考）
   */
  const move = (vnode: VNode, container: any, anchor: any) => {
    const { el } = vnode
    hostInsert(el, container, anchor)
  }

  /**
   * 更新属性
   * 
   * 对比新旧属性，增量更新：
   * 1. 遍历新属性，更新变化的属性
   * 2. 遍历旧属性，删除不再存在的属性
   * 
   * @param el - DOM 元素
   * @param vnode - 虚拟节点
   * @param oldProps - 旧属性
   * @param newProps - 新属性
   */
  const patchProps = (
    el: Element,
    vnode: VNode,
    oldProps: any,
    newProps: any
  ) => {
    if (oldProps !== newProps) {
      // 遍历新属性，更新变化的属性
      for (const key in newProps) {
        const prev = oldProps[key]
        const next = newProps[key]
        if (prev !== next) {
          hostPatchProp(el, key, prev, next)
        }
      }
      
      // 遍历旧属性，删除不再存在的属性
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  /**
   * 卸载子节点列表
   * 
   * 遍历子节点数组，移除每个已挂载到 DOM 的节点。
   * 
   * @param children - 子节点数组
   */
  const unmountChildren = (children: any) => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      // 只有当子节点有 el 属性（已挂载到 DOM）时才移除
      if (child && child.el) {
        hostRemove(child.el)
      }
    }
  }

  /**
   * 卸载单个节点
   * 
   * 从 DOM 中移除节点及其所有子节点。
   * 
   * @param vnode - 要卸载的虚拟节点
   */
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

  /**
   * Patch 函数 - 虚拟 DOM 的核心入口
   * 
   * 这是整个渲染系统的最核心函数，负责：
   * 1. 对比新旧虚拟节点
   * 2. 根据节点类型分发到不同的处理函数
   * 3. 执行挂载、更新或卸载操作
   * 
   * Patch 采用递归策略，从根节点开始，逐层向下处理整棵树。
   * 
   * @param oldVNode - 旧的虚拟节点（首次渲染时为 null）
   * @param newVNode - 新的虚拟节点
   * @param container - 容器元素
   * @param anchor - 锚点
   */
  const patch = (
    oldVNode: any,
    newVNode: VNode,
    container: any,
    anchor: any = null
  ) => {
    // 如果新旧节点完全相同（引用相等），无需处理
    if (oldVNode === newVNode) {
      return
    }
    
    console.log('patch', oldVNode, newVNode)
    
    // 如果节点类型不同，卸载旧节点，将 oldVNode 置为 null
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
      unmount(oldVNode)
      oldVNode = null
    }
    
    const { type, shapeFlag } = newVNode
    console.log('patchElement', type)
    
    // 根据节点类型分发到不同的处理函数
    switch (type) {
      case Text:
        // 文本节点
        processText(oldVNode, newVNode, container, anchor)
        break
      case Comment:
        // 注释节点
        console.log('patchCommentNode', newVNode)
        processCommentNode(oldVNode, newVNode, container, anchor)
        break
      case Fragment:
        // 片段节点
        processFragment(oldVNode, newVNode, container, anchor)
        break
      default:
        // 元素节点或组件节点
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 普通 HTML 元素
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件
          processComponent(oldVNode, newVNode, container, anchor)
        }
        break
    }
  }

  /**
   * 渲染函数
   * 
   * 对外暴露的渲染 API，将虚拟节点渲染到容器中。
   * 
   * @param vnode - 要渲染的虚拟节点（null 表示卸载）
   * @param container - 容器元素
   */
  const render = (vnode: VNode | null, container: any) => {
    if (vnode === null) {
      // 卸载：如果容器已有 vnode，清除它
      if (container._vnode) {
        container._vnode = null
      }
    } else {
      // 渲染：对比新旧 vnode，进行 patch
      patch(container._vnode || null, vnode, container)
      // 保存当前 vnode 引用，供下次更新使用
      container._vnode = vnode
    }
  }
  
  // 返回渲染器对象，包含 render 和 createApp 方法
  return { render, createApp: createAppAPI(render) }
}
