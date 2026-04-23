/**
 * 组件渲染工具模块
 * 
 * 提供组件渲染过程中的辅助函数，包括：
 * - 执行组件的渲染函数并规范化返回值
 * - 规范化子节点为标准的 VNode 格式
 */
import { createVNode, Text } from './vnode'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'

/**
 * 渲染组件根节点
 * 
 * 这是组件渲染的核心函数，负责：
 * 1. 调用组件的 render 函数生成虚拟 DOM
 * 2. 处理 render 函数的各种返回值情况
 * 3. 确保返回值是有效的 VNode
 * 
 * 这个函数在每次组件更新时都会被调用（通过 ReactiveEffect）。
 * 
 * @param instance - 组件实例
 * @returns 规范化后的 VNode
 */
export function renderComponentRoot(instance: any) {
  const { vnode, render, data = {} } = instance
  
  // 防御性检查：确保 render 函数存在
  if (!render) {
    console.warn(`Component is missing render function.`, instance.type)
    // 返回空的文本节点作为降级方案
    return createVNode(Text, null, '')
  }
  
  let result
  
  try {
    // 如果是有状态组件，执行 render 函数
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 将 data 作为上下文和参数调用 render 函数
      // render.call(data, data) 使得 render 函数内部可以通过 this 访问 data
      result = normalizeVNode(render.call(data, data))
    }
  } catch (error) {
    // 捕获渲染错误，避免整个应用崩溃
    console.error('Error in render function:', error)
    // 返回空的文本节点作为降级方案
    return createVNode(Text, null, '')
  }
  
  // 确保返回值有效
  if (result == null) {
    console.warn('Render function returned null or undefined')
    return createVNode(Text, null, '')
  }
  
  return result
}

/**
 * 规范化 VNode
 * 
 * 将任意类型的子节点转换为标准的 VNode 格式：
 * - 如果已经是对象（VNode），直接返回
 * - 如果是原始值（字符串、数字等），转换为文本节点
 * 
 * 这个函数确保了组件渲染函数的返回值始终是合法的 VNode。
 * 
 * @param child - 要规范化的子节点
 * @returns 规范化后的 VNode
 */
export function normalizeVNode(child: any) {
  if (typeof child === 'object') {
    // 如果已经是对象，检查是否需要克隆（如果已挂载）
    return cloneIfMounted(child)
  } else {
    // 如果是原始值，创建文本节点
    return createVNode(Text, null, String(child))
  }
}

/**
 * 克隆已挂载的 VNode
 * 
 * 在某些情况下（如插槽复用），需要克隆已经挂载到 DOM 的 VNode，
 * 以避免多个地方引用同一个 DOM 元素。
 * 
 * 当前实现是直接返回原节点（简化版本），完整实现应该检测 el 属性
 * 并在必要时进行深克隆。
 * 
 * @param child - 要检查的 VNode
 * @returns 克隆后的 VNode 或原 VNode
 */
export function cloneIfMounted(child: any) {
  // TODO: 完整实现应该检查 child.el 是否存在
  // 如果存在，需要克隆 VNode 并创建新的 DOM 元素
  return child
}
