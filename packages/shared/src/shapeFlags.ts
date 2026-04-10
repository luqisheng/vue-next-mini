/**
 * ShapeFlags - 节点形状标志位
 * 
 * 使用位运算来标识 VNode（虚拟节点）的类型和子节点类型
 * 每个标志位占用一个二进制位，可以通过位运算快速判断和组合多个特征
 * 
 * 例如: 一个有状态组件且有数组子节点的元素，其 shapeFlag 为:
 * STATEFUL_COMPONENT | ARRAY_CHILDREN = (1 << 2) | (1 << 4) = 4 | 16 = 20
 */
export enum ShapeFlags {
  /** 普通 HTML/SVG 元素节点 */
  ELEMENT = 1,
  
  /** 函数式组件 */
  FUNCTIONAL_COMPONENT = 1 << 1,
  
  /** 有状态组件（包含状态的普通组件） */
  STATEFUL_COMPONENT = 1 << 2,
  
  /** 子节点是文本节点 */
  TEXT_CHILDREN = 1 << 3,
  
  /** 子节点是数组（多个子节点） */
  ARRAY_CHILDREN = 1 << 4,
  
  /** 子节点是 slots（作用域插槽） */
  SLOTS_CHILDREN = 1 << 5,
  
  /** Teleport 组件（传送门） */
  TELEPORT = 1 << 6,
  
  /** Suspense 组件（异步依赖处理） */
  SUSPENSE = 1 << 7,
  
  /** 组件应该被 KeepAlive 缓存 */
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  
  /** 组件已被 KeepAlive 缓存 */
  COMPONENT_KEPT_ALIVE = 1 << 9,
  
  /** 组件类型（函数式组件或有状态组件的组合） */
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}
