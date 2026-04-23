/**
 * 生命周期钩子 API 模块
 * 
 * 提供 Composition API 风格的生命周期钩子注册函数，如：
 * - onBeforeMount: 组件挂载前执行
 * - onMounted: 组件挂载后执行
 * 
 * 这些钩子允许用户在组件的特定生命周期阶段执行自定义逻辑。
 */
import { LifecycleHooks } from './lifecycle'

/**
 * 创建生命周期钩子工厂函数
 * 
 * 这是一个高阶函数，接收生命周期类型，返回一个用于注册钩子的函数。
 * 这种设计避免了为每个生命周期钩子重复编写相同的逻辑。
 * 
 * @param lifecycle - 生命周期类型枚举值
 * @returns 钩子注册函数
 */
export const createHook = (lifecycle: LifecycleHooks) => {
  /**
   * 钩子注册函数
   * 
   * 将用户提供的回调函数注入到目标对象（通常是组件实例）的对应生命周期位置。
   * 
   * @param hook - 用户提供的回调函数
   * @param target - 目标对象（组件实例）
   */
  return (hook: any, target: any) => {
    injectHook(lifecycle, hook, target)
  }
}

/**
 * 注入生命周期钩子
 * 
 * 这是生命周期钩子注册的核心实现，负责：
 * 1. 检查目标对象是否存在
 * 2. 将钩子函数保存到目标对象的对应属性上
 * 3. 返回钩子函数（支持链式调用或进一步处理）
 * 
 * @param type - 生命周期类型
 * @param hook - 钩子函数
 * @param target - 目标对象（组件实例）
 * @returns 注入的钩子函数
 */
export const injectHook = (type: LifecycleHooks, hook: Function, target: any) => {
  if (target) {
    // 将钩子函数保存到目标对象的对应属性
    // 例如：onBeforeMount 会将钩子保存到 target.bm
    target[type] = hook
    
    return hook
  }
}

/**
 * 注册 beforeMount 钩子
 * 
 * 在组件挂载到 DOM 之前执行。
 * 此时组件的 DOM 尚未创建，无法访问真实 DOM 元素。
 * 
 * 使用示例：
 * ```typescript
 * onBeforeMount(() => {
 *   console.log('组件即将挂载')
 * })
 * ```
 */
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)

/**
 * 注册 mounted 钩子
 * 
 * 在组件挂载到 DOM 之后执行。
 * 此时可以安全地访问和操作组件的真实 DOM 元素。
 * 
 * 使用示例：
 * ```typescript
 * onMounted(() => {
 *   console.log('组件已挂载')
 *   // 可以访问 this.$el 或其他 DOM 引用
 * })
 * ```
 */
export const onMounted = createHook(LifecycleHooks.MOUNTED)
