/**
 * h 函数模块 - 创建虚拟节点的便捷方法
 * 
 * h 函数是 Vue 中用于创建 VNode 的 hyperscript 实现。
 * 它提供了比 createVNode 更灵活的参数处理方式，支持多种调用签名。
 * 
 * "h" 代表 "hyperscript"，这是一种用 JavaScript 创建 DOM 结构的模式。
 * 
 * 使用示例：
 * ```typescript
 * // 基本用法
 * h('div', { class: 'container' }, 'Hello')
 * 
 * // 嵌套结构
 * h('div', [
 *   h('h1', 'Title'),
 *   h('p', 'Content')
 * ])
 * 
 * // 组件
 * h(MyComponent, { prop: 'value' })
 * ```
 */
import { VNode, createVNode, isVNode } from './vnode'
import { isObject, isArray } from '@vue/shared'

/**
 * 创建虚拟节点
 * 
 * h 函数支持多种调用签名，自动识别参数类型并进行相应的处理：
 * 
 * 签名1: h(type, children)
 *   - 当第二个参数是 VNode 或字符串时，视为子节点
 * 
 * 签名2: h(type, props)
 *   - 当第二个参数是普通对象（非数组、非 VNode）时，视为属性
 * 
 * 签名3: h(type, props, children)
 *   - 标准的三参数形式
 * 
 * 签名4: h(type, ...children)
 *   - 支持多个子节点作为独立参数传入
 * 
 * @param type - 节点类型（HTML 标签名、组件定义等）
 * @param props - 节点属性（可选）
 * @param children - 子节点（可选）
 * @returns 创建的 VNode
 */
export function h(type: any, props?: any, children?: any): VNode {
  // 获取实际传入的参数个数
  const l = arguments.length
  
  if (l === 2) {
    // 两个参数的情况：需要判断第二个参数是 props 还是 children
    
    if (isObject(props) && !isArray(props)) {
      // 如果第二个参数是对象且不是数组
      
      if (isVNode(props)) {
        // 特殊情况：第二个参数是 VNode，视为单个子节点
        // 例如：h('div', h('span', 'text'))
        return createVNode(type, null, [props])
      }
      
      // 正常情况：第二个参数是 props 对象
      // 例如：h('div', { class: 'container' })
      return createVNode(type, props)
    } else {
      // 第二个参数不是对象，视为 children
      // 例如：h('div', 'text') 或 h('div', [h('span')])
      return createVNode(type, null, props)
    }
  } else {
    // 三个或更多参数的情况
    
    if (l > 3) {
      // 超过3个参数：将所有额外参数收集为数组
      // 例如：h('div', null, child1, child2, child3)
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      // 正好3个参数且第三个是 VNode：包装为数组
      // 例如：h('div', null, h('span'))
      children = [children]
    }
    
    // 标准的三参数调用
    // 例如：h('div', { class: 'container' }, 'text')
    return createVNode(type, props, children)
  }
}
