/**
 * Watch API 模块
 * 
 * 提供响应式数据侦听功能，允许用户在数据变化时执行副作用。
 * 
 * watch 的核心特性：
 * 1. 惰性执行：默认情况下，watch 不会立即执行，只在数据变化时触发
 * 2. 深度侦听：可以侦听嵌套对象的变化（通过 traverse）
 * 3. 调度优化：使用调度器批量处理更新，避免频繁触发
 * 4. 清理机制：返回取消函数，可以手动停止侦听
 */
import { EMPTY_OBJ, hasChanged, isObject } from '@vue/shared'
import { isReactive, ReactiveEffect } from '@vue/reactivity'
import { queuePreFlushCb } from './scheduler'

/**
 * Watch 配置选项接口
 */
export interface WatchOptions<Immediate = boolean> {
  /** 是否立即执行回调（首次创建时就执行一次） */
  immediate?: Immediate
  
  /** 是否深度侦听嵌套对象的变化 */
  deep?: boolean
}

/**
 * 侦听响应式数据的变化
 * 
 * 这是对外暴露的 watch API，用户可以传入响应式对象和回调函数，
 * 当数据变化时，回调会被自动调用。
 * 
 * 使用示例：
 * ```typescript
 * const state = reactive({ count: 0 })
 * 
 * // 基本用法
 * watch(state, (newValue, oldValue) => {
 *   console.log('state changed:', newValue, oldValue)
 * })
 * 
 * // 立即执行 + 深度侦听
 * watch(state, (newValue) => {
 *   console.log('state changed:', newValue)
 * }, { immediate: true, deep: true })
 * ```
 * 
 * @param source - 要侦听的响应式数据源
 * @param cb - 数据变化时的回调函数
 * @param options - 配置选项
 * @returns 取消侦听的函数
 */
export function watch(source: any, cb: Function, options?: WatchOptions) {
  return doWatch(source, cb, options)
}

/**
 * Watch 的核心实现
 * 
 * 这个函数负责：
 * 1. 根据数据源类型创建合适的 getter 函数
 * 2. 处理深度侦听（通过 traverse 递归遍历对象）
 * 3. 创建 ReactiveEffect 并设置调度器
 * 4. 处理 immediate 选项（是否立即执行）
 * 
 * @param source - 数据源
 * @param cb - 回调函数
 * @param options - 配置选项
 * @returns 取消侦听的函数
 */
function doWatch(
  source: any,
  cb: Function,
  { immediate, deep }: WatchOptions = EMPTY_OBJ
) {
  let getter: () => any
  
  // 根据数据源类型创建 getter
  if (isReactive(source)) {
    // 如果数据源是响应式对象，直接返回该对象
    // ReactiveEffect 会自动追踪对象的所有属性
    getter = () => source
    // 响应式对象默认开启深度侦听
    deep = true
  } else {
    // 其他情况（简化版本，实际 Vue 支持更多类型）
    getter = () => {}
  }
  
  // 如果开启了深度侦听，包装 getter 以递归追踪所有嵌套属性
  if (cb && deep) {
    // TODO: 完整的深度侦听实现
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }
  
  // 保存旧值，用于比较变化
  let oldValue: any
  
  /**
   * 任务执行函数
   * 
   * 当数据变化时，这个函数会被调度器调用，负责：
   * 1. 运行 effect 获取新值
   * 2. 比较新旧值
   * 3. 如果值发生变化，调用回调函数
   */
  const job = () => {
    if (cb) {
      // 运行 effect，这会重新收集依赖并返回当前值
      const newValue = effect.run()
      
      // 如果开启了深度侦听，或者值确实发生了变化
      if (deep || hasChanged(newValue, oldValue)) {
        // 调用回调函数，传入新值和旧值
        cb(newValue, oldValue)
        
        // 更新旧值
        oldValue = newValue
      }
    }
  }
  
  // 创建调度器：将任务推入 pre-flush 队列
  // 这样可以批量处理多个变化，避免频繁触发回调
  let scheduler = () => queuePreFlushCb(job)
  
  // 创建响应式副作用
  // ReactiveEffect 会在 getter 执行时自动追踪依赖
  const effect = new ReactiveEffect(getter, scheduler)
  
  if (cb) {
    // 如果有回调函数
    if (immediate) {
      // 立即执行：在创建时就调用一次 job
      job()
    } else {
      // 非立即执行：先运行一次 effect 收集依赖，但不触发回调
      oldValue = effect.run()
    }
  } else {
    // 没有回调函数（这种情况较少见），直接运行 effect
    effect.run()
  }
  
  // 返回取消函数，用户可以通过调用它来停止侦听
  return () => {
    effect.stop()
  }
}

/**
 * 深度遍历对象
 * 
 * 递归访问对象的所有属性，使得 ReactiveEffect 能够追踪到所有嵌套的响应式属性。
 * 
 * 工作原理：
 * 1. 遍历对象的所有属性
 * 2. 对每个属性值递归调用 traverse
 * 3. 使用 seen Set 避免循环引用导致的无限递归
 * 
 * @param value - 要遍历的值
 * @param seen - 已访问对象的集合（用于防止循环引用）
 * @returns 原始值
 */
function traverse(value: unknown, seen: Set<any> = new Set()) {
  // 如果不是对象，或已经访问过，直接返回
  if (!isObject(value) || seen.has(value)) {
    return value
  }
  
  // 标记为已访问
  seen.add(value)
  
  // 递归遍历所有属性
  for (const key in value as object) {
    traverse((value as any)[key], seen)
  }
  
  return value
}
