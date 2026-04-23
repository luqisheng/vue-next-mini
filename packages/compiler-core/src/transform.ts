/**
 * Vue Next Mini - AST 转换引擎
 * 
 * 本文件实现了编译器的第二阶段: Transform (转换)。
 * 
 * 核心功能:
 * 1. 遍历 AST 树 (深度优先)
 * 2. 对每个节点应用转换插件 (nodeTransforms)
 * 3. 生成代码生成所需的辅助信息 (codegenNode, helpers)
 * 
 * 转换流程:
 * ┌──────────────┐
 * │  Parse AST   │ (来自 parse 阶段)
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │ traverseNode │ (深度优先遍历)
 * │              │
 * │ 进入节点      │ → 应用 nodeTransforms (enter 阶段)
 * │   ↓          │
 * │ 递归子节点    │ → traverseChildren
 * │   ↓          │
 * │ 离开节点      │ → 执行 exitFns (exit 阶段)
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │createRootCode│ (生成根节点的 codegenNode)
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │ Transformed  │ (优化后的 AST)
 * │     AST      │
 * └──────────────┘
 * 
 * 设计模式:
 * - 访问者模式: traverseNode 访问每个节点
 * - 插件化架构: nodeTransforms 数组,可插拔的转换插件
 * - 钩子机制: enter/exit 双阶段处理
 */

import { isString, isArray } from '@vue/shared'
import { NodeTypes } from './ast'
import { isSingleElementRoot } from './hoistStatic'
import { TO_DISPLAY_STRING } from './runtimeHelpers'

/**
 * 转换上下文接口
 * 
 * 在转换过程中维护的状态信息,所有转换插件都可以访问和修改这个上下文。
 */
export interface TransformContext {
  root: any                    // 根节点
  parent: ParentNode | null    // 父节点
  childIndex: number           // 当前节点在父节点中的索引
  currentNode: any             // 当前正在处理的节点
  helpers: Map<symbol, number> // helper 函数计数 (用于去重)
  helper<T extends symbol>(name: T): T  // 注册 helper
  nodeTransforms: any[]        // 转换插件列表
  replaceNode(node: any): void // 替换当前节点
}

/**
 * 创建转换上下文
 * 
 * 初始化转换过程所需的所有状态。
 * 
 * @param root - AST 根节点
 * @param options - 配置选项
 * @param options.nodeTransforms - 转换插件数组
 * @returns TransformContext 实例
 * 
 * 关键方法说明:
 * 
 * 1. helper(name):
 *    - 注册一个 helper 函数
 *    - 使用 Map 计数,避免重复注册
 *    - 返回 name,供后续代码生成使用
 * 
 * 2. replaceNode(node):
 *    - 替换当前节点
 *    - 用于转换插件修改 AST 结构
 *    - 例如: 将 ELEMENT 节点转换为 VNODE_CALL 节点
 * 
 * @example
 * ```typescript
 * const context = createTransformContext(ast, {
 *   nodeTransforms: [transformElement, transformText]
 * })
 * 
 * // 注册 helper
 * context.helper(CREATE_ELEMENT_VNODE)
 * 
 * // 替换节点
 * context.replaceNode(newNode)
 * ```
 */
export function createTransformContext(root: any, { nodeTransforms = [] }) {
  const context: TransformContext = {
    root,                      // 根节点
    parent: null,              // 初始时没有父节点
    childIndex: 0,             // 初始索引为 0
    currentNode: root,         // 当前节点为根节点
    helpers: new Map(),        // helper 计数器
    
    /**
     * 注册 helper 函数
     * 
     * @param name - helper 函数的 symbol 标识
     * @returns 返回 name,供后续使用
     * 
     * 工作原理:
     * 1. 从 Map 中获取该 helper 的计数
     * 2. 计数 +1
     * 3. 存回 Map
     * 4. 返回 name
     * 
     * 为什么需要计数?
     * - 统计每个 helper 被使用的次数
     * - 在代码生成时,只导入使用过的 helper
     * - 避免导入未使用的函数,减小代码体积
     */
    helper(name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    },
    
    nodeTransforms,            // 转换插件列表
    
    /**
     * 替换当前节点
     * 
     * @param node - 新的节点
     * 
     * 用途:
     * - 转换插件可以修改 AST 结构
     * - 例如: transformElement 将 ELEMENT 节点增强,添加 codegenNode
     * 
     * 注意事项:
     * - 只能在 enter 阶段调用
     * - 替换后,traverseNode 会继续处理新节点
     */
    replaceNode(node) {
      // 在父节点的 children 数组中替换当前节点
      // 同时更新 context.currentNode
      context.parent!.children[context.childIndex] = context.currentNode = node
    }
  }
  return context
}

/**
 * 转换 AST 树的主入口函数
 * 
 * 这是编译第二阶段的起点,负责:
 * 1. 创建转换上下文
 * 2. 遍历并转换整个 AST 树
 * 3. 生成根节点的 codegenNode
 * 4. 初始化其他编译元数据
 * 
 * @param root - AST 根节点 (来自 parse 阶段)
 * @param options - 配置选项
 * @param options.nodeTransforms - 转换插件数组
 * 
 * 工作流程:
 * 1. 创建 TransformContext
 * 2. 调用 traverseNode 深度优先遍历
 * 3. 调用 createRootCodegen 生成根节点的 codegenNode
 * 4. 初始化 components, directives, imports 等元数据
 * 
 * @example
 * ```typescript
 * const ast = baseParse('<div>{{ message }}</div>')
 * 
 * transform(ast, {
 *   nodeTransforms: [transformElement, transformText]
 * })
 * 
 * // ast 现在包含:
 * // - codegenNode: 代码生成节点
 * // - helpers: ['CREATE_ELEMENT_VNODE', 'TO_DISPLAY_STRING']
 * // - components: []
 * // - directives: []
 * ```
 */
export function transform(root: any, options: any) {
  // 创建转换上下文
  const context = createTransformContext(root, options)
  
  // 深度优先遍历并转换 AST
  traverseNode(root, context)
  
  // 生成根节点的 codegenNode
  createRootCodegen(root)
  
  // 提取 helpers 列表 (从 Map 的 keys)
  root.helpers = [...context.helpers.keys()]
  
  // 初始化其他元数据 (当前简化版本为空数组)
  root.components = []     // 使用的组件列表
  root.directives = []     // 使用的指令列表
  root.imports = []        // 需要导入的内容
  root.hoists = []         // 静态提升的节点
  root.temps = []          // 临时变量
  root.cached = []         // 缓存的节点
}

/**
 * 深度优先遍历 AST 节点
 * 
 * 这是转换引擎的核心算法,采用深度优先策略遍历整个 AST 树。
 * 
 * 遍历顺序 (Enter-Exit 双阶段):
 * 
 * ```
 *       ROOT
 *      /    \
 *   DIV      SPAN
 *   /
 * TEXT
 * 
 * 遍历顺序:
 * 1. ROOT (enter)
 * 2.   DIV (enter)
 * 3.     TEXT (enter)
 * 4.     TEXT (exit)
 * 5.   DIV (exit)
 * 6.   SPAN (enter)
 * 7.   SPAN (exit)
 * 8. ROOT (exit)
 * ```
 * 
 * @param node - 当前要遍历的节点
 * @param context - 转换上下文
 * 
 * 工作流程:
 * 
 * 1. Enter 阶段 (进入节点):
 *    - 设置 context.currentNode
 *    - 依次调用所有 nodeTransforms
 *    - 每个 transform 可以返回 exit 回调函数
 *    - 如果 transform 替换了节点,更新 node 引用
 * 
 * 2. 递归子节点:
 *    - 根据节点类型,决定如何遍历子节点
 *    - ELEMENT, ROOT, IF_BRANCH: 调用 traverseChildren
 *    - IF: 遍历 branches
 *    - INTERPOLATION: 注册 TO_DISPLAY_STRING helper
 * 
 * 3. Exit 阶段 (离开节点):
 *    - 逆序执行所有 exitFns
 *    - 恢复 context.currentNode
 * 
 * 为什么需要 Enter-Exit 双阶段?
 * - Enter: 可以在处理子节点前修改节点
 * - Exit: 可以在处理完子节点后做最终处理
 * - 例如: transformElement 在 enter 时分析 props,在 exit 时生成 codegenNode
 */
// 深度优先
export function traverseNode(node: any, context: TransformContext) {
  const { nodeTransforms } = context
  
  // 设置当前节点
  context.currentNode = node
  
  // 存储 exit 回调函数
  const exitFns: any = []
  
  // ========== Enter 阶段 ==========
  // 依次调用所有转换插件
  for (let i = 0; i < nodeTransforms.length; i++) {
    const transform = nodeTransforms[i]
    
    // 调用转换插件,可能返回 exit 回调
    const onExit = transform(node, context)
    
    if (onExit) {
      // 如果返回了 exit 回调,存入数组
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    
    // 如果节点被替换或移除,提前退出
    if (!context.currentNode) {
      return
    } else {
      // 如果节点被替换,更新 node 引用
      node = context.currentNode
    }
  }

  // ========== 递归子节点 ==========
  // 根据节点类型,决定如何遍历子节点
  switch (node.type) {
    case NodeTypes.IF_BRANCH:
      // v-if 分支:遍历子节点
      traverseChildren(node, context)
      break
      
    case NodeTypes.ELEMENT:
      // 元素节点:遍历子节点
      traverseChildren(node, context)
      break
      
    case NodeTypes.ROOT:
      // 根节点:遍历子节点
      traverseChildren(node, context)
      break
      
    case NodeTypes.INTERPOLATION:
      // 插值节点:注册 TO_DISPLAY_STRING helper
      // {{ message }} 需要转换为 toDisplayString(_ctx.message)
      context.helper(TO_DISPLAY_STRING)
      break
      
    case NodeTypes.IF:
      // v-if 条件:遍历所有分支
      for (let index = 0; index < node.branches.length; index++) {
        traverseNode(node.branches[index], context)
      }
      break
      
    default:
      // 其他节点类型:不做特殊处理
      break
  }
  
  // ========== Exit 阶段 ==========
  // 恢复当前节点
  context.currentNode = node
  
  // 逆序执行所有 exit 回调
  // 逆序的原因:后进先出 (LIFO),保证正确的嵌套关系
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

/**
 * 遍历节点的所有子节点
 * 
 * 这是一个辅助函数,用于递归处理子节点。
 * 
 * @param parent - 父节点
 * @param context - 转换上下文
 * 
 * 工作流程:
 * 1. 遍历 parent.children 数组
 * 2. 对每个子节点:
 *    - 设置 context.parent = parent
 *    - 设置 context.childIndex = index
 *    - 递归调用 traverseNode
 * 
 * @example
 * ```typescript
 * // 对于 <div><span>text</span></div>
 * // parent = div 节点
 * // parent.children = [span 节点]
 * 
 * traverseChildren(div, context)
 * // → 遍历 span 节点
 * //   → 设置 context.parent = div
 * //   → 设置 context.childIndex = 0
 * //   → traverseNode(span, context)
 * ```
 */
export function traverseChildren(parent: any, context: TransformContext) {
  parent.children.forEach((node: any, index: number) => {
    // 设置父节点和索引
    context.parent = parent
    context.childIndex = index
    
    // 递归遍历子节点
    traverseNode(node, context)
  })
}

/**
 * 创建根节点的 codegenNode
 * 
 * 这个函数负责生成根节点的代码生成节点,是连接 AST 和代码生成的桥梁。
 * 
 * @param root - AST 根节点
 * 
 * 处理逻辑:
 * 
 * 1. 单根节点情况:
 *    - 如果只有一个子节点
 *    - 且是单一元素根 (不是 Fragment)
 *    - 且子节点已有 codegenNode
 *    - 则直接将子节点的 codegenNode 赋值给 root
 * 
 * 2. 多根节点情况 (TODO):
 *    - 应该创建 Fragment 节点
 *    - 当前简化版本未实现
 * 
 * @example
 * ```typescript
 * // 单根: <div>content</div>
 * root.codegenNode = div.codegenNode
 * // 生成: createElementVNode("div", ...)
 * 
 * // 多根: <div>1</div><div>2</div>
 * // TODO: 应该生成 Fragment
 * // createElementVNode(Fragment, null, [...])
 * ```
 * 
 * 为什么需要特殊处理单根?
 * - 性能优化:避免不必要的 Fragment 包裹
 * - 保持模板语义:单根组件更清晰
 * - Vue 3 支持多根,但单根更常见
 */
function createRootCodegen(root: any) {
  const { children } = root
  
  // 根节点只有一个子节点
  if (children.length === 1) {
    const child = children[0]
    
    // 检查是否是单一元素根,且已有 codegenNode
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      // 将子节点的 codegenNode 赋值给根节点
      root.codegenNode = child.codegenNode
      return child.codegenNode
    }
  }
  
  // todo:根节点有多个子节点
  // 完整版应该创建 Fragment:
  // return root.codegenNode = context.helper(CREATE_VNODE)(
  //     undefined,
  //     root.children
  // )
}

/**
 * 创建结构性指令转换器
 * 
 * 这是一个高阶函数,用于创建处理结构性指令 (v-if, v-for) 的转换插件。
 * 
 * @param name - 指令名称 (字符串或正则表达式)
 * @param fn - 处理函数,接收 (node, prop, context) 参数
 * @returns 转换插件函数
 * 
 * 工作原理:
 * 1. 创建 matches 函数,判断指令名称是否匹配
 * 2. 返回转换插件函数
 * 3. 插件函数遍历元素的 props
 * 4. 找到匹配的指令,从 props 中移除
 * 5. 调用 fn 处理指令
 * 6. 收集并返回 exit 回调
 * 
 * @example
 * ```typescript
 * // 创建 v-if 转换器
 * const transformIf = createStructuralDirectiveTransform(
 *   'if',
 *   (node, dir, context) => {
 *     // 处理 v-if 指令
 *     // ...
 *     return () => {
 *       // exit 回调
 *     }
 *   }
 * )
 * ```
 * 
 * 为什么要从 props 中移除指令?
 * - 结构性指令不应该出现在最终的 props 中
 * - 它们会被转换为特殊的代码结构 (条件表达式、循环)
 * - 普通指令 (如 v-bind) 会保留在 props 中
 */
export function createStructuralDirectiveTransform(
  name: string | RegExp,
  fn: any
) {
  // 创建匹配函数
  const matches = isString(name)
    ? (n: string) => n === name           // 字符串精确匹配
    : (n: string) => name.test(n)         // 正则表达式匹配
  
  // 返回转换插件
  return (node: any, context: any) => {
    // 只处理元素节点
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      const exitFns = []
      
      // 遍历所有 props
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        
        // 检查是否为匹配的指令
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // 从 props 中移除该指令
          props.splice(i, 1)
          i-- // 调整索引,避免跳过下一个元素
          
          // 调用处理函数,可能返回 exit 回调
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      
      // 返回所有 exit 回调
      return exitFns
    }
  }
}
