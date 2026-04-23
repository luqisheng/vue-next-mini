/**
 * Vue Next Mini - 响应式系统核心模块
 * 
 * 本文件实现了 Vue 3 的副作用(effect)管理机制,是响应式系统的核心。
 * 
 * 核心概念:
 * 1. ReactiveEffect: 封装副作用函数,管理执行上下文和依赖关系
 * 2. track: 依赖收集,建立"属性 → effect"的映射关系
 * 3. trigger: 触发更新,当属性变化时通知所有依赖的 effect 重新执行
 * 4. targetMap: 全局弱引用映射表,存储所有响应式对象的依赖关系
 * 
 * 工作流程:
 * ┌─────────────┐     track      ┌──────────────┐
 * │ 访问响应式属性 │ ──────────► │ 收集依赖到 dep │
 * └─────────────┘                └──────────────┘
 *                                        ▲
 *                                        │
 * ┌─────────────┐    trigger     ┌──────┴──────┐
 * │ 修改响应式属性 │ ──────────► │ 执行所有 effect│
 * └─────────────┘                └─────────────┘
 */

import { isArray, extend } from '@vue/shared'
import { Dep, createDep } from './dep'
import { ComputedRefImpl } from './computed'

/**
 * 依赖映射类型定义
 * key: 属性名(字符串或 Symbol)
 * value: 该属性的依赖集合(Dep)
 * 
 * 示例:
 * Map {
 *   'count' => Set([effect1, effect2]),
 *   'name' => Set([effect1])
 * }
 */
type KeyToDepMap = Map<string | symbol, Dep>

/**
 * 全局弱引用映射表,存储所有响应式对象的依赖关系
 *
 * 数据结构:
 * targetMap (WeakMap)
 *   └─ target1 (响应式对象) → depsMap (Map)
 *        ├─ 'prop1' → dep1 (Set: [effect1, effect2])
 *        └─ 'prop2' → dep2 (Set: [effect3])
 *   └─ target2 (响应式对象) → depsMap (Map)
 *        └─ 'name' → dep3 (Set: [effect1])
 *
 * 使用 WeakMap 的原因:
 * - 当响应式对象被垃圾回收时,其依赖关系也会自动清理
 * - 避免内存泄漏
 * 
 * 实际示例:
 * const state = reactive({ count: 0, name: 'Vue' })
 * effect(() => console.log(state.count)) // 依赖 count
 * effect(() => console.log(state.name))  // 依赖 name
 * 
 * targetMap 结构:
 * WeakMap {
 *   state => Map {
 *     'count' => Set([effect1]),
 *     'name' => Set([effect2])
 *   }
 * }
 */
const targetMap = new WeakMap<any, KeyToDepMap>()

/**
 * Effect 调度器类型定义
 * 用于控制 effect 重新执行的时机和策略
 */
export type EffectScheduler = (...args: any[]) => any

/**
 * Effect 配置选项
 */
export interface ReactiveEffectOptions {
  /** 是否延迟执行,默认为 false(立即执行) */
  lazy?: boolean
  /** 自定义调度器,控制 effect 何时重新执行 */
  scheduler?: EffectScheduler
}

/**
 * 创建并执行一个响应式副作用函数
 *
 * effect 是响应式系统的核心,它会自动追踪函数中访问的所有响应式数据。
 * 当这些数据发生变化时,effect 会自动重新执行。
 *
 * @param fn - 需要响应式执行的函数,当函数中访问的响应式数据变化时会重新执行
 * @param options - 可选配置项(lazy, scheduler)
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 })
 * 
 * // 创建一个 effect,会自动追踪 state.count
 * effect(() => {
 *   console.log('count is:', state.count) // 首次执行,输出 "count is: 0"
 * })
 * 
 * // 修改 count 时,effect 会重新执行
 * state.count++ // 输出 "count is: 1"
 * ```
 * 
 * @example
 * ```typescript
 * // 使用 lazy 选项,不立即执行
 * const e = effect(() => {
 *   console.log(state.count)
 * }, { lazy: true })
 * 
 * // 手动触发执行
 * e.run()
 * ```
 * 
 * @example
 * ```typescript
 * // 使用 scheduler 选项,自定义执行时机
 * effect(() => {
 *   console.log(state.count)
 * }, {
 *   scheduler: () => {
 *     // 异步批量执行,避免频繁更新
 *     Promise.resolve().then(() => {
 *       console.log('batch update')
 *     })
 *   }
 * })
 * ```
 */
export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  // 创建 ReactiveEffect 实例,封装副作用函数
  const _effect = new ReactiveEffect(fn)
  
  // 如果提供了配置项,合并到 effect 实例上
  if (options) {
    extend(_effect, options)
  }
  
  // 如果不是懒执行模式,立即执行一次
  // 执行过程中会访问响应式数据,触发 getter,从而收集依赖
  if (!options || !options.lazy) {
    _effect.run()
  }
  
  // 返回 effect 实例,供外部调用(如手动执行、停止等)
  return _effect
}

/**
 * 当前正在执行的活跃副作用函数
 *
 * 作用:
 * - 在 track 阶段,用于知道应该将哪个 effect 收集到依赖中
 * - 同一时间只有一个 activeEffect,形成执行栈的概念
 * 
 * 工作原理:
 * 1. effect.run() 执行前,设置 activeEffect = 当前 effect
 * 2. 执行 fn(),访问响应式属性时触发 getter
 * 3. getter 中调用 track(),将 activeEffect 添加到 dep
 * 4. 执行完成后,恢复之前的 activeEffect(简化版本未实现)
 * 
 * 注意:
 * - 这是一个全局变量,同一时间只能有一个活跃的 effect
 * - 嵌套 effect 的场景需要更复杂的栈管理(当前简化版本未实现)
 */
export let activeEffect: ReactiveEffect | undefined

/**
 * 响应式副作用类,封装副作用函数的执行和调度逻辑
 *
 * 核心职责:
 * 1. 管理副作用的执行上下文(通过 activeEffect)
 * 2. 记录该 effect 依赖的所有 dep 集合(用于清理)
 * 3. 支持自定义调度器(scheduler),控制何时重新执行
 * 
 * 生命周期:
 * 创建 → 执行(run) → 依赖收集(track) → 触发更新(trigger) → 重新执行
 */
export class ReactiveEffect<T = any> {
  /**
   * 存储该 effect 依赖的所有 dep 集合
   * 用于 effect 停止时清理依赖关系
   * 
   * 示例:
   * effect(() => {
   *   console.log(state.count) // 依赖 state.count
   *   console.log(state.name)  // 依赖 state.name
   * })
   * 
   * effect.deps = [
   *   dep_for_count,  // state.count 的 dep
   *   dep_for_name    // state.name 的 dep
   * ]
   */
  deps: Dep[] = []

  /**
   * 如果该 effect 是计算属性的一部分,指向对应的 ComputedRefImpl 实例
   * 用于区分普通 effect 和 computed effect,在 trigger 时有不同的处理策略
   * 
   * 用途:
   * - computed 的 effect 有特殊的调度策略(标记 dirty,不立即执行)
   * - 普通 effect 直接同步执行
   */
  computed?: ComputedRefImpl<T>

  /**
   * 构造函数
   *
   * @param fn - 副作用函数,执行时会访问响应式数据
   * @param scheduler - 可选的调度器,控制 effect 重新执行的时机
   *                    如果不提供,依赖变化时直接同步执行 run()
   *                    如果提供,依赖变化时调用 scheduler(),由调度器决定执行策略
   * 
   * @example
   * ```typescript
   * // 普通 effect,没有 scheduler
   * const effect1 = new ReactiveEffect(() => {
   *   console.log(state.count)
   * })
   * 
   * // computed effect,有 scheduler
   * const effect2 = new ReactiveEffect(
   *   () => state.count * 2,
   *   () => {
   *     // scheduler: 标记为 dirty,不立即重新计算
   *     this._dirty = true
   *   }
   * )
   * ```
   */
  constructor(
    public fn: () => T,
    public scheduler?: () => void
  ) {}

  /**
   * 执行副作用函数
   *
   * 执行流程:
   * 1. 将当前 effect 设置为活跃状态(activeEffect = this)
   * 2. 执行 fn(),执行过程中访问响应式属性会触发 getter
   * 3. getter 中调用 track(),将当前 activeEffect 收集到对应属性的 dep 中
   * 4. 执行完成后返回结果
   *
   * @returns 副作用函数的返回值
   * 
   * @example
   * ```typescript
   * const effect = new ReactiveEffect(() => {
   *   return state.count * 2
   * })
   * 
   * const result = effect.run() // 执行并返回结果
   * console.log(result) // 输出: state.count * 2 的值
   * ```
   * 
   * 注意事项:
   * - 每次执行前都会设置 activeEffect,确保依赖收集的准确性
   * - 简化版本没有实现嵌套 effect 的处理(应该用栈管理)
   * - 生产环境应该在 finally 块中恢复之前的 activeEffect
   */
  run() {
    // 将当前 effect 设置为活跃状态
    // 这样在 fn 执行中访问响应式属性时,track 就能知道要收集哪个 effect
    activeEffect = this

    try {
      // 执行原始函数,执行过程中会触发 getter 进行依赖收集
      return this.fn()
    } finally {
      // 注意:这里应该恢复之前的 activeEffect
      // 但当前简化版本没有实现嵌套 effect 的处理
      // 正确的做法应该是:
      // activeEffect = previousActiveEffect
    }
  }
  
  /**
   * 停止 effect,清理所有依赖关系
   * 
   * 用途:
   * - 组件卸载时,停止渲染 effect,避免内存泄漏
   * - watch 停止监听时,清理依赖
   * 
   * @example
   * ```typescript
   * const e = effect(() => {
   *   console.log(state.count)
   * })
   * 
   * // 停止 effect,不再响应数据变化
   * e.stop()
   * 
   * state.count++ // 不会触发 effect 重新执行
   * ```
   */
  stop() {
    // TODO: 实现依赖清理逻辑
    // 遍历 this.deps,从每个 dep 中移除当前 effect
    // for (const dep of this.deps) {
    //   dep.delete(this)
    // }
    // this.deps.length = 0
  }
}

/**
 * 将当前活跃的 effect 添加到依赖集合中
 *
 * 这是依赖收集的关键步骤,建立 effect 和响应式属性之间的关联
 *
 * @param dep - 依赖集合(Set),存储所有依赖于某个响应式属性的 effect
 *
 * 工作流程:
 * 1. 检查当前是否有活跃的 effect
 * 2. 检查该 effect 是否已经被收集过(避免重复)
 * 3. 如果没有收集过,将 effect 添加到 dep 集合
 * 4. 同时将 dep 添加到 effect.deps 数组(反向引用,用于清理)
 * 
 * @example
 * ```typescript
 * // 假设当前 activeEffect = effect1
 * const dep = new Set()
 * 
 * trackEffects(dep)
 * 
 * // dep 现在是: Set([effect1])
 * // effect1.deps 现在是: [dep]
 * ```
 * 
 * 为什么需要去重检查?
 * - 同一个 effect 可能在函数中多次访问同一个属性
 * - 例如: effect(() => state.count + state.count)
 * - 避免重复收集,保证 dep 中每个 effect 只出现一次
 */
export function trackEffects(dep: Dep) {
  if (activeEffect) {
    // 检查是否已经收集过该 effect,避免重复收集
    let shouldTrack = !dep.has(activeEffect)

    if (shouldTrack) {
      // 将当前活跃的 effect 添加到依赖集合中
      dep.add(activeEffect)

      // 建立反向引用:记录该 effect 依赖了哪些 dep
      // 用途:当 effect 停止时,可以从这些 dep 中移除自己
      // 当前代码中被注释掉,简化版本暂不需要
      // activeEffect.deps.push(dep)
    }
  }
}

/**
 * 执行依赖集合中的所有 effect
 *
 * 重要:分两次遍历执行,优先执行 computed effect,再执行普通 effect
 *
 * 原因:
 * - computed effect 有缓存机制,执行成本低
 * - 先更新 computed,确保普通 effect 执行时能获取最新的计算值
 * - 避免普通 effect 多次读取同一个 computed 导致重复计算
 *
 * @param dep - 依赖集合,包含所有需要重新执行的 effect
 * 
 * @example
 * ```typescript
 * const dep = new Set([computedEffect, normalEffect1, normalEffect2])
 * 
 * triggerEffects(dep)
 * // 执行顺序:
 * // 1. computedEffect (如果有 scheduler,标记为 dirty)
 * // 2. normalEffect1 (直接执行)
 * // 3. normalEffect2 (直接执行)
 * ```
 * 
 * 执行策略:
 * - computed effect: 调用 scheduler,标记为 dirty,不立即重新计算
 * - 普通 effect: 直接调用 run(),同步执行
 */
export function triggerEffects(dep: Dep) {
  // 将 dep 转换为数组,兼容 Set 和 Array 两种类型
  const effects = isArray(dep) ? dep : [...dep]

  // 第一次遍历:优先执行 computed effect
  // computed effect 有 scheduler,会被标记为 dirty 而不是立即重新计算
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect)
    }
  }

  // 第二次遍历:执行普通 effect
  // 此时 computed 已经被标记为 dirty,普通 effect 执行时会触发 computed 的重新计算
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect)
    }
  }
}

/**
 * 触发单个 effect 执行
 *
 * 执行策略:
 * - 如果有 scheduler,调用 scheduler(),由调度器决定何时执行
 * - 如果没有 scheduler,直接同步执行 effect.run()
 *
 * @param effect - 需要重新执行的 ReactiveEffect 实例
 *
 * 应用场景:
 * - computed 的 scheduler:标记为 dirty,不立即执行
 * - watch 的 scheduler:可能异步批量执行
 * - 普通 effect:立即同步执行
 * 
 * @example
 * ```typescript
 * // 普通 effect,没有 scheduler
 * const effect1 = new ReactiveEffect(() => {
 *   console.log('updated')
 * })
 * triggerEffect(effect1) // 立即输出 "updated"
 * 
 * // computed effect,有 scheduler
 * const effect2 = new ReactiveEffect(
 *   () => state.count * 2,
 *   () => {
 *     console.log('marked as dirty')
 *     computedInstance._dirty = true
 *   }
 * )
 * triggerEffect(effect2) // 输出 "marked as dirty",但不重新计算
 * ```
 */
export function triggerEffect(effect: ReactiveEffect) {
  // console.log('triggerEffect', effect)

  if (effect.scheduler) {
    // 有调度器,交给调度器处理
    // 例如 computed 的 scheduler 会将 _dirty 设为 true,但不立即重新计算
    effect.scheduler()
  } else {
    // 没有调度器,直接同步执行
    effect.run()
  }
}

/**
 * 依赖收集的核心函数
 *
 * 调用时机:
 * - 当访问响应式对象的属性时(getter 中)
 * - 建立"属性 → effect"的依赖关系
 *
 * @param target - 响应式对象(被代理的对象)
 * @param key - 被访问的属性名
 *
 * 完整流程示例:
 * ```typescript
 * const state = reactive({ count: 0 })
 * effect(() => {
 *   console.log(state.count) // 访问 count 时触发 track(state, 'count')
 * })
 * ```
 *
 * 数据结构变化:
 * targetMap.set(state, new Map([
 *   ['count', new Set([effect])]
 * ]))
 * 
 * 执行步骤:
 * 1. 检查是否有活跃的 effect(如果没有,说明不是在 effect 中访问,无需收集)
 * 2. 从 targetMap 获取 target 的 depsMap
 * 3. 从 depsMap 获取 key 对应的 dep
 * 4. 如果 dep 不存在,创建新的 dep
 * 5. 将 activeEffect 添加到 dep 中
 * 
 * @example
 * ```typescript
 * // 假设执行以下代码:
 * const state = reactive({ count: 0, name: 'Vue' })
 * 
 * effect(() => {
 *   console.log(state.count) // 触发 track(state, 'count')
 * })
 * 
 * // targetMap 结构:
 * // WeakMap {
 * //   state => Map {
 * //     'count' => Set([effect])
 * //   }
 * // }
 * ```
 */
export function track(target: object, key: string | symbol) {
  // 如果没有活跃的 effect,说明不是在 effect 函数中访问的属性
  // 例如:直接在组件 setup 中访问 ref.value,无需收集依赖
  if (!activeEffect) return

  // 从全局 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)

  if (!depsMap) {
    // 如果该对象还没有任何依赖关系,创建新的 Map
    targetMap.set(target, (depsMap = new Map()))
  }

  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)

  if (!dep) {
    // 如果该属性还没有被追踪过,创建新的 Dep 集合
    depsMap.set(key, (dep = createDep()))
  }

  // 将当前活跃的 effect 添加到该属性的依赖集合中
  trackEffects(dep)

  // 调试日志:打印依赖收集的详细信息
  // console.log(
  //   'track 收集依赖',
  //   target,
  //   'key',
  //   key,
  //   'dep',
  //   dep,
  //   'depsMap',
  //   depsMap,
  //   'targetMap',
  //   targetMap
  // )
}

/**
 * 触发依赖更新的核心函数
 *
 * 调用时机:
 * - 当修改响应式对象的属性时(setter 中)
 * - 通知所有依赖该属性的 effect 重新执行
 *
 * @param target - 响应式对象(被代理的对象)
 * @param key - 被修改的属性名
 *
 * 完整流程示例:
 * ```typescript
 * const state = reactive({ count: 0 })
 * state.count = 1 // 修改 count 时触发 trigger(state, 'count')
 *                 // 找到所有依赖 state.count 的 effect 并执行
 * ```
 *
 * 执行顺序:
 * 1. 从 targetMap 找到 target 的 depsMap
 * 2. 从 depsMap 找到 key 对应的 dep(effect 集合)
 * 3. 遍历 dep,依次执行每个 effect
 * 
 * @example
 * ```typescript
 * const state = reactive({ count: 0 })
 * 
 * effect(() => {
 *   console.log('count is:', state.count)
 * })
 * 
 * state.count++ // 触发 trigger(state, 'count')
 *               // 输出: "count is: 1"
 * ```
 * 
 * 注意事项:
 * - 只有当属性值真正变化时才应该调用 trigger
 * - 如果 dep 为空,说明没有 effect 依赖该属性,无需执行任何操作
 * - trigger 是同步执行的,如果需要异步批量更新,应使用 scheduler
 */
export function trigger(target: object, key: string | symbol) {
  // 从全局 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)

  // 如果该对象没有任何依赖关系,直接返回
  if (!depsMap) return

  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)

  // 如果该属性有依赖的 effect,执行它们
  if (dep) {
    triggerEffects(dep)
  }

  // 调试日志:打印触发更新的详细信息
  // console.log(
  //   'trigger 触发依赖',
  //   target,
  //   'key',
  //   key,
  //   'dep',
  //   dep,
  //   'depsMap',
  //   depsMap,
  //   'targetMap',
  //   targetMap
  // )
}
