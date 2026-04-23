/**
 * Runtime Core 模块导出
 * 
 * 这是 runtime-core 包的公共 API 入口，对外暴露核心功能：
 * - 调度器相关：queuePreFlushCb
 * - 响应式侦听：watch
 * - 虚拟节点创建：h, Text, Fragment, Comment 等
 * - VNode 工具：isSameVNodeType, createElementVNode 等
 * 
 * 其他内部实现（如 renderer、component 等）不直接导出，
 * 而是通过 createRenderer 等工厂函数间接使用。
 */

// 调度器：用于批量处理异步更新任务
export { queuePreFlushCb } from './scheduler'

// Watch API：侦听响应式数据变化
export { watch } from './apiWatch'

// h 函数：创建虚拟节点的便捷方法
export { h } from './h'

// VNode 类型和创建函数
export { 
  Text,           // 文本节点类型
  Fragment,       // 片段节点类型
  Comment,        // 注释节点类型
  createElementVNode,  // 创建元素节点
  createCommentVNode   // 创建注释节点
} from './vnode'

// VNode 工具函数
export { isSameVNodeType } from './vnode'
