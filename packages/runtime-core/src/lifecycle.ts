/**
 * 生命周期钩子枚举模块
 * 
 * 定义 Vue 组件的所有生命周期阶段。
 * 使用 TypeScript 的 const enum 可以在编译时内联这些值，提高运行时性能。
 * 
 * Vue 的生命周期流程：
 * 1. beforeCreate (bc): 实例初始化之后，数据观测之前
 * 2. created (c): 实例创建完成，数据观测已设置
 * 3. beforeMount (bm): 挂载开始之前，render 函数即将被调用
 * 4. mounted (m): 实例挂载到 DOM 之后
 */

// 生命周期钩子枚举
export const enum LifecycleHooks {
  /** beforeCreate: 实例初始化之后，data/props 等尚未设置 */
  BEFORE_CREATE = 'bc',
  
  /** created: 实例创建完成，data/props 已设置，但 DOM 尚未生成 */
  CREATED = 'c',
  
  /** beforeMount: 挂载开始之前，render 函数即将首次被调用 */
  BEFORE_MOUNT = 'bm',
  
  /** mounted: 实例已挂载到 DOM，可以访问真实 DOM 元素 */
  MOUNTED = 'm'
}
