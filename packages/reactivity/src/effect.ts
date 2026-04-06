import { isArray, extend } from '@vue/shared'
import { Dep, createDep } from './dep'
import { ComputedRefImpl } from './computed'

/**
 * 依赖映射类型定义
 * key: 属性名（字符串或 Symbol）
 * value: 该属性的依赖集合（Dep）
 */
type KeyToDepMap = Map<string | symbol, Dep>

/**
 * 全局弱引用映射表，存储所有响应式对象的依赖关系
 *
 * 数据结构：
 * targetMap (WeakMap)
 *   └─ target1 (响应式对象) → depsMap (Map)
 *        ├─ 'prop1' → dep1 (Set: [effect1, effect2])
 *        └─ 'prop2' → dep2 (Set: [effect3])
 *   └─ target2 (响应式对象) → depsMap (Map)
 *        └─ 'name' → dep3 (Set: [effect1])
 *
 * 使用 WeakMap 的原因：
 * - 当响应式对象被垃圾回收时，其依赖关系也会自动清理
 * - 避免内存泄漏
 */
const targetMap = new WeakMap<any, KeyToDepMap>()
export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
}
// EffectScheduler
export type EffectScheduler = (...args: any[]) => any
/**
 * 创建并执行一个响应式副作用函数
 *
 * @param fn - 需要响应式执行的函数，当函数中访问的响应式数据变化时会重新执行
 *
 * @example
 * const state = reactive({ count: 0 })
 * effect(() => {
 *   console.log(state.count) // 当 count 变化时会重新执行
 * })
 */
export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  // 创建 ReactiveEffect 实例
  const _effect = new ReactiveEffect(fn)
  if (options) {
    extend(_effect, options)
    debugger
  }
  if (!options || !options.lazy) {
    // 立即执行一次，触发依赖收集过程
    _effect.run()
  }
}

/**
 * 当前正在执行的活跃副作用函数
 *
 * 作用：
 * - 在 track 阶段，用于知道应该将哪个 effect 收集到依赖中
 * - 同一时间只有一个 activeEffect，形成执行栈的概念
 */
export let activeEffect: ReactiveEffect | undefined

/**
 * 响应式副作用类，封装副作用函数的执行和调度逻辑
 *
 * 核心职责：
 * 1. 管理副作用的执行上下文
 * 2. 记录该 effect 依赖的所有 dep 集合
 * 3. 支持自定义调度器（scheduler），用于控制何时重新执行
 */
export class ReactiveEffect<T = any> {
  /**
   * 存储该 effect 依赖的所有 dep 集合
   * 用于 effect 停止时清理依赖关系
   */
  deps: Dep[] = []

  /**
   * 如果该 effect 是计算属性的一部分，指向对应的 ComputedRefImpl 实例
   * 用于区分普通 effect 和 computed effect，在 trigger 时有不同的处理策略
   */
  computed?: ComputedRefImpl<T>

  /**
   * 构造函数
   *
   * @param fn - 副作用函数，执行时会访问响应式数据
   * @param scheduler - 可选的调度器，控制 effect 重新执行的时机
   *                    如果不提供，依赖变化时直接同步执行 run()
   *                    如果提供，依赖变化时调用 scheduler()，由调度器决定执行策略
   */
  constructor(
    public fn: () => T,
    public scheduler?: () => void
  ) {}

  /**
   * 执行副作用函数
   *
   * 执行流程：
   * 1. 将当前 effect 设置为活跃状态（activeEffect = this）
   * 2. 执行 fn()，执行过程中访问响应式属性会触发 getter
   * 3. getter 中调用 track()，将当前 activeEffect 收集到对应属性的 dep 中
   * 4. 执行完成后返回结果
   *
   * @returns 副作用函数的返回值
   */
  run() {
    // 将当前 effect 设置为活跃状态
    // 这样在 fn 执行中访问响应式属性时，track 就能知道要收集哪个 effect
    activeEffect = this

    try {
      // 执行原始函数，执行过程中会触发 getter 进行依赖收集
      return this.fn()
    } finally {
      // 注意：这里应该恢复之前的 activeEffect
      // 但当前简化版本没有实现嵌套 effect 的处理
      // activeEffect = undefined
    }
  }
}

/**
 * 将当前活跃的 effect 添加到依赖集合中
 *
 * 这是依赖收集的关键步骤，建立 effect 和响应式属性之间的关联
 *
 * @param dep - 依赖集合（Set），存储所有依赖于某个响应式属性的 effect
 *
 * 工作流程：
 * 1. 检查当前是否有活跃的 effect
 * 2. 检查该 effect 是否已经被收集过（避免重复）
 * 3. 如果没有收集过，将 effect 添加到 dep 集合
 * 4. 同时将 dep 添加到 effect.deps 数组（反向引用，用于清理）
 */
export function trackEffects(dep: Dep) {
  if (activeEffect) {
    // 检查是否已经收集过该 effect，避免重复收集
    let shouldTrack = !dep.has(activeEffect)

    if (shouldTrack) {
      // 将当前活跃的 effect 添加到依赖集合中
      dep.add(activeEffect)

      // 建立反向引用：记录该 effect 依赖了哪些 dep
      // 用途：当 effect 停止时，可以从这些 dep 中移除自己
      // 当前代码中被注释掉，简化版本暂不需要
      // activeEffect.deps.push(dep)
    }
  }
}

/**
 * 执行依赖集合中的所有 effect
 *
 * 重要：分两次遍历执行，优先执行 computed effect，再执行普通 effect
 *
 * 原因：
 * - computed effect 有缓存机制，执行成本低
 * - 先更新 computed，确保普通 effect 执行时能获取最新的计算值
 * - 避免普通 effect 多次读取同一个 computed 导致重复计算
 *
 * @param dep - 依赖集合，包含所有需要重新执行的 effect
 */
export function triggerEffects(dep: Dep) {
  // 将 dep 转换为数组，兼容 Set 和 Array 两种类型
  const effects = isArray(dep) ? dep : [...dep]

  // 第一次遍历：优先执行 computed effect
  // computed effect 有 scheduler，会被标记为 dirty 而不是立即重新计算
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect)
    }
  }

  // 第二次遍历：执行普通 effect
  // 此时 computed 已经被标记为 dirty，普通 effect 执行时会触发 computed 的重新计算
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect)
    }
  }
}

/**
 * 触发单个 effect 执行
 *
 * 执行策略：
 * - 如果有 scheduler，调用 scheduler()，由调度器决定何时执行
 * - 如果没有 scheduler，直接同步执行 effect.run()
 *
 * @param effect - 需要重新执行的 ReactiveEffect 实例
 *
 * 应用场景：
 * - computed 的 scheduler：标记为 dirty，不立即执行
 * - watch 的 scheduler：可能异步批量执行
 * - 普通 effect：立即同步执行
 */
export function triggerEffect(effect: ReactiveEffect) {
  // console.log('triggerEffect', effect)

  if (effect.scheduler) {
    // 有调度器，交给调度器处理
    // 例如 computed 的 scheduler 会将 _dirty 设为 true，但不立即重新计算
    effect.scheduler()
  } else {
    // 没有调度器，直接同步执行
    effect.run()
  }
}

/**
 * 依赖收集的核心函数
 *
 * 调用时机：
 * - 当访问响应式对象的属性时（getter 中）
 * - 建立"属性 → effect"的依赖关系
 *
 * @param target - 响应式对象（被代理的对象）
 * @param key - 被访问的属性名
 *
 * 完整流程示例：
 * ```typescript
 * const state = reactive({ count: 0 })
 * effect(() => {
 *   console.log(state.count) // 访问 count 时触发 track(state, 'count')
 * })
 * ```
 *
 * 数据结构变化：
 * targetMap.set(state, new Map([
 *   ['count', new Set([effect])]
 * ]))
 */
export function track(target: object, key: string | symbol) {
  // 如果没有活跃的 effect，说明不是在 effect 函数中访问的属性
  // 例如：直接在组件 setup 中访问 ref.value，无需收集依赖
  if (!activeEffect) return

  // 从全局 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)

  if (!depsMap) {
    // 如果该对象还没有任何依赖关系，创建新的 Map
    targetMap.set(target, (depsMap = new Map()))
  }

  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)

  if (!dep) {
    // 如果该属性还没有被追踪过，创建新的 Dep 集合
    depsMap.set(key, (dep = createDep()))
  }

  // 将当前活跃的 effect 添加到该属性的依赖集合中
  trackEffects(dep)

  // 调试日志：打印依赖收集的详细信息
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
 * 调用时机：
 * - 当修改响应式对象的属性时（setter 中）
 * - 通知所有依赖该属性的 effect 重新执行
 *
 * @param target - 响应式对象（被代理的对象）
 * @param key - 被修改的属性名
 *
 * 完整流程示例：
 * ```typescript
 * const state = reactive({ count: 0 })
 * state.count = 1 // 修改 count 时触发 trigger(state, 'count')
 *                 // 找到所有依赖 state.count 的 effect 并执行
 * ```
 *
 * 执行顺序：
 * 1. 从 targetMap 找到 target 的 depsMap
 * 2. 从 depsMap 找到 key 对应的 dep（effect 集合）
 * 3. 遍历 dep，依次执行每个 effect
 */
export function trigger(target: object, key: string | symbol) {
  // 从全局 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)

  // 如果该对象没有任何依赖关系，直接返回
  if (!depsMap) return

  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)

  // 如果该属性有依赖的 effect，执行它们
  if (dep) {
    triggerEffects(dep)
  }

  // 调试日志：打印触发更新的详细信息
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
