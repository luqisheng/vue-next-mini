/**
 * 虚拟节点（VNode）模块
 * 
 * VNode 是 Vue 虚拟 DOM 的核心数据结构，用于描述真实 DOM 树的结构。
 * 通过 VNode，Vue 可以在内存中构建一棵轻量级的树结构，并通过 diff 算法
 * 高效地更新真实 DOM，避免频繁的直接 DOM 操作。
 */
import { isString, isObject, isArray } from '@vue/shared'
import { normalizeClass, normalizeStyle } from './normalizeProp'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'

// ==================== VNode 类型定义 ====================

/**
 * 文本节点类型标识
 * 用于表示纯文本内容的 VNode
 */
export const Text = Symbol('Text')

/**
 * 片段节点类型标识
 * 用于表示一组子节点的容器，本身不渲染为真实 DOM 元素
 */
export const Fragment = Symbol('Fragment')

/**
 * 注释节点类型标识
 * 用于表示 HTML 注释的 VNode
 */
export const Comment = Symbol('Comment')

/**
 * 元素节点类型标识
 * 用于表示普通 HTML 元素的 VNode
 */
export const ELEMENT = Symbol('Element')

/**
 * VNode 接口定义
 * 
 * VNode 对象包含了描述一个虚拟节点所需的所有信息：
 * - type: 节点类型（元素标签名、组件定义、或特殊类型如 Text/Fragment）
 * - props: 节点的属性（如 class、style、事件监听器等）
 * - children: 子节点（可以是字符串、数组或其他 VNode）
 * - shapeFlag: 形状标志位，用于快速判断节点类型和子节点类型
 * - el: 指向对应的真实 DOM 元素（在渲染后赋值）
 * - component: 如果是组件节点，指向组件实例
 * - key: 用于 diff 算法中的节点标识，帮助追踪节点身份
 */
export interface VNode {
  __v_isVNode: true      // 标记这是一个 VNode 对象
  el: any                // 关联的真实 DOM 元素引用
  type: any              // 节点类型
  props: any             // 节点属性
  children: any          // 子节点
  shapeFlag: number      // 形状标志位（位运算优化）
  key?: any              // 唯一标识符，用于 diff 优化
  component?: any        // 组件实例引用
}

/**
 * 创建虚拟节点
 * 
 * 这是创建 VNode 的核心函数，负责：
 * 1. 规范化 props（处理 class 和 style 的特殊格式）
 * 2. 根据 type 确定节点类型并设置 shapeFlag
 * 3. 调用 createBaseVNode 创建基础 VNode 对象
 * 
 * @param type - 节点类型（字符串表示 HTML 标签，对象表示组件定义）
 * @param props - 节点属性对象
 * @param children - 子节点（可以是字符串、数组、对象等）
 * @returns 创建的 VNode 对象
 */
export function createVNode(type: any, props?: any, children?: any): VNode {
  console.log('createVNode', type, props, children)
  
  // 规范化 props：处理 class 和 style 的特殊格式
  if (props) {
    let { class: klass, style } = props
    
    // 如果 class 不是字符串，需要规范化（支持数组、对象等格式）
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    
    // 如果 style 不是字符串，需要规范化（支持对象格式）
    if (style && !isString(style)) {
      props.style = normalizeStyle(style)
    }
  }
  
  // 根据 type 确定节点的类型标志位
  // 使用位运算优化，后续可以通过 & 运算快速判断节点类型
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT              // 字符串类型 -> 普通 HTML 元素
    : isObject(type)
      ? ShapeFlags.STATEFUL_COMPONENT // 对象类型 -> 有状态组件
      : 0                             // 其他类型

  // 创建基础 VNode 对象
  return createBaseVNode(type, props, children, shapeFlag)
}

// 导出别名，兼容 Vue 内部命名
export { createVNode as createElementVNode }

/**
 * 创建注释节点
 * 
 * @param text - 注释文本内容
 * @returns 注释类型的 VNode
 */
export function createCommentVNode(text: string = ''): VNode {
  return createVNode(Comment, null, text)
}

/**
 * 创建基础 VNode 对象
 * 
 * 这是 VNode 创建的底层函数，负责：
 * 1. 构建 VNode 基础结构
 * 2. 规范化子节点格式
 * 3. 返回完整的 VNode 对象
 * 
 * @param type - 节点类型
 * @param props - 节点属性
 * @param children - 子节点
 * @param shapeFlag - 形状标志位
 * @returns 基础 VNode 对象
 */
function createBaseVNode(
  type: any,
  props?: any,
  children?: any,
  shapeFlag: number = 0
): VNode {
  const vnode: VNode = {
    __v_isVNode: true,  // 标记为 VNode 对象，用于类型检查
    el: null,           // 初始时没有关联的 DOM 元素
    type,               // 节点类型
    props,              // 节点属性
    children,           // 子节点
    shapeFlag,          // 形状标志位
    key: props?.key || null  // 从 props 中提取 key，用于 diff 优化
  }
  
  // 规范化子节点格式，并根据子节点类型更新 shapeFlag
  normalizeChildren(vnode, children)
  
  return vnode
}

/**
 * 规范化子节点
 * 
 * 根据 children 的类型，设置对应的子节点类型标志位：
 * - null/undefined: 无子节点
 * - Array: 数组子节点（多个 VNode）
 * - Object: 插槽子节点（作用域插槽）
 * - String: 文本子节点
 * 
 * 使用位运算 |= 将子节点类型标志位合并到 shapeFlag 中
 * 
 * @param vnode - 要处理的 VNode
 * @param children - 子节点
 */
function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  
  if (children == null) {
    // 无子节点
    children = null
  } else if (isArray(children)) {
    // 数组子节点：多个 VNode 组成的列表
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    // 插槽子节点：作用域插槽对象
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (isString(children)) {
    // 文本子节点：转换为字符串
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }
  
  // 设置子节点
  vnode.children = children
  
  // 使用位运算合并子节点类型标志位
  // 这样后续可以通过 shapeFlag & ShapeFlags.TEXT_CHILDREN 等方式快速判断
  vnode.shapeFlag |= type
}

/**
 * 判断是否为 VNode 对象
 * 
 * 使用类型守卫（Type Guard），如果返回 true，
 * TypeScript 会将参数类型收窄为 VNode
 * 
 * @param value - 要检查的值
 * @returns 是否为 VNode 对象
 */
export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

/**
 * 判断两个 VNode 是否为相同类型
 * 
 * 在 diff 算法中，只有 type 和 key 都相同的节点才被认为是"相同"的，
 * 才可以进行复用和更新，否则需要卸载旧节点并挂载新节点。
 * 
 * @param n1 - 第一个 VNode
 * @param n2 - 第二个 VNode
 * @returns 是否为相同类型的节点
 */
export function isSameVNodeType(n1: VNode, n2: VNode) {
  return n1?.type === n2?.type && n1?.key === n2?.key
}
