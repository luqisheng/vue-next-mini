/**
 * Vue Next Mini - 运行时辅助函数符号定义
 * 
 * 本文件定义了编译器在代码生成阶段需要使用的运行时 helper 函数。
 * 
 * 什么是 Helper 函数?
 * - Helper 是 Vue 运行时提供的工具函数
 * - 编译器在生成 render 函数时会调用这些 helper
 * - 使用 Symbol 避免名称冲突,便于 tree-shaking
 * 
 * Helper 函数的作用:
 * 1. CREATE_ELEMENT_VNODE: 创建元素类型的虚拟节点
 * 2. CREATE_VNODE: 创建通用虚拟节点 (组件/SSR)
 * 3. TO_DISPLAY_STRING: 将值转换为显示字符串
 * 4. CREATE_COMMENT: 创建注释节点
 * 
 * 工作流程:
 * 1. 编译时: transform 阶段注册需要的 helper
 * 2. 代码生成: codegen 阶段生成 helper 的解构导入
 * 3. 运行时: 从 Vue 全局对象中获取这些函数
 * 
 * @example
 * ```typescript
 * // 编译时注册
 * context.helper(CREATE_ELEMENT_VNODE)
 * 
 * // 生成的代码
 * const { createElementVNode: _createElementVNode } = Vue
 * 
 * // 运行时调用
 * _createElementVNode("div", ...)
 * ```
 * 
 * 为什么使用 Symbol?
 * - 唯一标识,避免命名冲突
 * - 可以作为 Map 的 key
 * - 便于统计使用情况
 * - 支持 tree-shaking (未使用的 helper 不会被导入)
 */

/**
 * 创建元素虚拟节点的 helper 符号
 * 
 * 用于创建普通的 HTML 元素节点。
 * 
 * @example
 * ```typescript
 * // 模板: <div>Hello</div>
 * 
 * // 生成的代码
 * _createElementVNode("div", null, ["Hello"])
 * 
 * // 运行时等价于
 * {
 *   type: 'div',
 *   props: null,
 *   children: ["Hello"],
 *   // ...其他 vnode 属性
 * }
 * ```
 */
export const CREATE_ELEMENT_VNODE = Symbol('createElementVNode')

/**
 * 创建通用虚拟节点的 helper 符号
 * 
 * 用于创建组件节点或 SSR 场景。
 * 与 CREATE_ELEMENT_VNODE 的区别:
 * - CREATE_ELEMENT_VNODE: 只用于普通 HTML 元素
 * - CREATE_VNODE: 用于组件、SSR、或不确定类型的节点
 * 
 * @example
 * ```typescript
 * // 组件: <MyComponent />
 * _createVNode(MyComponent, ...)
 * 
 * // SSR 模式
 * _createVNode("div", ...)
 * ```
 */
export const CREATE_VNODE = Symbol('createVNode')

/**
 * 转换为显示字符串的 helper 符号
 * 
 * 用于处理插值表达式 {{ expression }}。
 * 
 * 功能:
 * - 将任意值转换为字符串
 * - 处理 null/undefined (返回空字符串)
 * - 处理对象 (调用 toString)
 * - 防止 XSS (转义 HTML 特殊字符)
 * 
 * @example
 * ```typescript
 * // 模板: {{ message }}
 * 
 * // 生成的代码
 * _toDisplayString(message)
 * 
 * // 运行时行为
 * _toDisplayString(null)      // ""
 * _toDisplayString(undefined) // ""
 * _toDisplayString(123)       // "123"
 * _toDisplayString({})        // "[object Object]"
 * _toDisplayString('<script>') // "&lt;script&gt;" (转义)
 * ```
 */
export const TO_DISPLAY_STRING = Symbol('toDisplayString')

/**
 * 创建注释虚拟节点的 helper 符号
 * 
 * 用于 v-if 条件渲染的占位符。
 * 
 * @example
 * ```typescript
 * // 模板: <div v-if="show">Content</div>
 * 
 * // 当 show 为 false 时,生成注释占位符
 * _createCommentVNode("v-if", true)
 * 
 * // 渲染结果: <!--v-if-->
 * ```
 * 
 * 为什么需要注释占位符?
 * - 保持 DOM 结构的稳定性
 * - v-if 切换时不需要插入/删除节点
 * - 只需显示/隐藏对应的分支
 */
export const CREATE_COMMENT = Symbol('createCommentVNode')

/**
 * Helper 函数名称映射表
 * 
 * 将 Symbol 映射到实际的函数名称字符串。
 * 用于代码生成阶段,将 Symbol 转换为可读的代码。
 * 
 * @type {Record<symbol, string>}
 * 
 * @example
 * ```typescript
 * helperNameMap[CREATE_ELEMENT_VNODE]
 * // 返回: "createElementVNode"
 * 
 * // 在 codegen 中使用
 * const alias = `_${helperNameMap[symbol]}`
 * // 生成: "_createElementVNode"
 * ```
 * 
 * 映射关系:
 * - CREATE_ELEMENT_VNODE → "createElementVNode"
 * - CREATE_VNODE → "createVNode"
 * - TO_DISPLAY_STRING → "toDisplayString"
 * - CREATE_COMMENT → "createCommentVNode"
 */
// 修复：明确指定 helperNameMap 的索引签名类型为 Record<symbol, string>
export const helperNameMap: Record<symbol, string> = {
  [CREATE_ELEMENT_VNODE]: 'createElementVNode',
  [CREATE_VNODE]: 'createVNode',
  [TO_DISPLAY_STRING]: 'toDisplayString',
  [CREATE_COMMENT]: 'createCommentVNode'
}
