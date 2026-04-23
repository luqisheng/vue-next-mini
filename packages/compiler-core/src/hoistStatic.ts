/**
 * Vue Next Mini - 静态提升相关工具函数
 * 
 * 本文件提供静态节点优化的辅助函数。
 * 
 * 什么是静态提升 (Static Hoisting)?
 * - 静态节点是指内容不会变化的节点
 * - 将它们提升到 render 函数外部
 * - 避免每次渲染时重复创建
 * - 提高性能
 * 
 * @example
 * ```typescript
 * // 优化前
 * function render() {
 *   return createElementVNode("div", null, [
 *     createElementVNode("span", null, "Static Text")  // 每次都创建
 *   ])
 * }
 * 
 * // 优化后 (静态提升)
 * const _hoisted_1 = createElementVNode("span", null, "Static Text")
 * 
 * function render() {
 *   return createElementVNode("div", null, [
 *     _hoisted_1  // 复用缓存的节点
 *   ])
 * }
 * ```
 */

import { NodeTypes } from "./ast"

/**
 * 判断根节点是否为单一元素根
 * 
 * 单一元素根是指根节点下只有一个子元素节点。
 * 这种情况不需要创建 Fragment,可以直接使用该元素的 codegenNode。
 * 
 * @param root - 根节点
 * @param child - 子节点
 * @returns 如果是单一元素根返回 true
 * 
 * 判断条件:
 * 1. 根节点只有一个子节点 (children.length === 1)
 * 2. 该子节点是元素类型 (child.type === NodeTypes.ELEMENT)
 * 
 * @example
 * ```typescript
 * // 单一元素根: <div>content</div>
 * root.children = [div元素]
 * isSingleElementRoot(root, div元素)  // true
 * 
 * // 多根节点: <div>1</div><div>2</div>
 * root.children = [div1, div2]
 * isSingleElementRoot(root, div1)  // false
 * 
 * // 包含文本: <div>text</div>more text
 * root.children = [div元素, text节点]
 * isSingleElementRoot(root, div元素)  // false
 * ```
 * 
 * 为什么需要这个判断?
 * - 单根组件更常见,可以优化
 * - 避免不必要的 Fragment 包裹
 * - 保持模板语义清晰
 * - Vue 3 支持多根,但单根性能更好
 * 
 * 在 createRootCodegen 中使用:
 * ```typescript
 * if (isSingleElementRoot(root, child) && child.codegenNode) {
 *   root.codegenNode = child.codegenNode
 * }
 * ```
 */
export function isSingleElementRoot(root: any, child: any) {
  const { children } = root
  
  // 条件1: 只有一个子节点
  // 条件2: 该子节点是元素类型
  return children.length === 1 && child.type === NodeTypes.ELEMENT
}
