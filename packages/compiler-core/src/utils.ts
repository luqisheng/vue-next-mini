/**
 * Vue Next Mini - 编译器工具函数
 * 
 * 本文件提供编译器各个阶段使用的辅助函数。
 */

import { NodeTypes } from './ast'
import { CREATE_ELEMENT_VNODE, CREATE_VNODE } from './runtimeHelpers'

/**
 * 判断节点是否为文本类节点
 * 
 * 文本类节点包括:
 * - TEXT: 纯文本节点
 * - INTERPOLATION: 插值节点 {{ }}
 * 
 * @param node - AST 节点
 * @returns 如果是文本类节点返回 true
 * 
 * @example
 * ```typescript
 * isText({ type: NodeTypes.TEXT })           // true
 * isText({ type: NodeTypes.INTERPOLATION })  // true
 * isText({ type: NodeTypes.ELEMENT })        // false
 * ```
 * 
 * 应用场景:
 * - transformText: 合并相邻的文本节点
 * - codegen: 决定如何生成代码
 */
export function isText(node: any) {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

/**
 * 获取创建虚拟节点的 helper 函数
 * 
 * 根据是否为 SSR 模式或组件类型,决定使用哪个 helper。
 * 
 * @param ssr - 是否为服务端渲染模式
 * @param isComponent - 是否为组件节点
 * @returns CREATE_ELEMENT_VNODE 或 CREATE_VNODE
 * 
 * 选择逻辑:
 * - SSR 模式 → CREATE_VNODE (SSR 需要特殊处理)
 * - 组件节点 → CREATE_VNODE (组件需要特殊处理)
 * - 普通元素 → CREATE_ELEMENT_VNODE (性能更好)
 * 
 * @example
 * ```typescript
 * // 普通元素
 * getVNodeHelper(false, false)
 * // 返回: CREATE_ELEMENT_VNODE
 * 
 * // 组件
 * getVNodeHelper(false, true)
 * // 返回: CREATE_VNODE
 * 
 * // SSR 模式
 * getVNodeHelper(true, false)
 * // 返回: CREATE_VNODE
 * ```
 * 
 * 为什么区分 CREATE_ELEMENT_VNODE 和 CREATE_VNODE?
 * - CREATE_ELEMENT_VNODE: 针对普通 HTML 元素优化
 * - CREATE_VNODE: 通用版本,支持组件、SSR 等场景
 * - 分离后可以 tree-shake,未使用的不会被打包
 */
export function getVNodeHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}

/**
 * 获取缓存的 VNode 调用节点
 * 
 * 当前简化版本直接返回节点本身。
 * 完整版中会处理静态提升、缓存等优化。
 * 
 * @param node - AST 节点
 * @returns VNODE_CALL 节点
 * 
 * @example
 * ```typescript
 * // 当前版本:直接返回
 * getMemoedVNodeCall(node)
 * // 返回: node
 * 
 * // 完整版可能:
 * // - 检查是否已缓存
 * // - 处理静态提升
 * // - 返回优化后的节点
 * ```
 * 
 * TODO: 实现完整的缓存和静态提升逻辑
 */
export function getMemoedVNodeCall(node: any) {
  // 简化版本:直接返回节点
  // 完整版应该检查缓存、处理静态提升等
  return node
}
