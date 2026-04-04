import { isArray } from '@vue/shared'
import {Dep,createDep} from './dep'
// 依赖映射类型：key 到依赖集合的映射
type KeyToDepMap = Map<string | symbol,Dep >
// 全局弱引用映射，存储所有响应式对象及其依赖关系
// WeakMap 的 key 是响应式对象本身，value 是该对象所有属性的依赖集合
const targetMap = new WeakMap<any, KeyToDepMap>()

/**
 * effect 函数：创建一个响应式副作用函数
 * @param fn - 需要响应式执行的函数
 */
export function effect<T = any>(fn: () => T) {
  // 创建 ReactiveEffect 实例
  const _effect = new ReactiveEffect(fn)
  // 立即执行一次，触发依赖收集
  _effect.run()
}

// 当前活跃的副作用函数，用于 track 时知道要收集哪个 effect
export let activeEffect: ReactiveEffect | undefined

/**
 * ReactiveEffect 类：响应式副作用的封装
 * 每个 effect 都会创建这个类的实例
 */
export class ReactiveEffect<T = any> {
  deps: Dep[] = [] // 存储该 effect 依赖的所有 dep 集合
  constructor(public fn: () => T) {}
  
  run() {
    // 将当前 effect 设置为活跃状态，这样在 fn 执行中访问响应式属性时就能收集到这个 effect
    activeEffect = this
    // 执行原始函数，执行过程中会触发 getter 进行依赖收集
    this.fn()
  }
}

/**
 * trackEffects：将当前活跃 effect 添加到依赖集合中
 * @param dep - 依赖集合，存储所有依赖于该属性的 effect
 */
export function trackEffects(dep: Dep) {
  if (activeEffect) {
    // 检查是否已经收集过，避免重复
    let shouldTrack = !dep.has(activeEffect)
    if (shouldTrack) {
      // 将当前活跃 effect 添加到依赖集合
      dep.add(activeEffect)
      activeEffect.deps.push(dep) // 注释掉的代码：用于反向追踪 effect 依赖了哪些 dep
    }
  }
}

/**
 * triggerEffects：执行依赖集合中的所有 effect
 * @param dep - 依赖集合，包含所有需要重新执行的 effect
 */
export function triggerEffects(dep: Dep) {
  const effects = isArray(dep)?dep:[...dep]
  // 遍历并执行所有依赖的 effect
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

/**
 * triggerEffect：触发单个 effect 执行
 * @param effect - 需要重新执行的 ReactiveEffect 实例
 */
export function triggerEffect(effect: ReactiveEffect){
  console.log('triggerEffect', effect)
  effect.run()
}

/**
 * track：依赖收集的核心函数
 * 当访问响应式对象的属性时调用，用于收集当前活跃 effect
 * @param target - 响应式对象
 * @param key - 被访问的属性名
 */
// 收集依赖
export function track(target: object, key: string | symbol) {
  // 如果没有活跃的 effect，说明不是在 effect 函数中访问的，无需收集
  if (!activeEffect) return
  
  // 从 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 如果不存在，创建新的 Map 并存入 targetMap
    targetMap.set(target, (depsMap = new Map()))
  }
  
  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)
  if (!dep) {
    // 如果不存在，创建新的 Set 并存入 depsMap
    depsMap.set(key, (dep = createDep()))
  }
  
  // 将当前活跃 effect 添加到依赖集合
  trackEffects(dep)
  
  // 调试日志：打印依赖收集的详细信息
  console.log(
    'track 收集依赖',
    target,
    'key',
    key,
    'dep',
    dep,
    'depsMap',
    depsMap,
    'targetMap',
    targetMap
  )
}

/**
 * trigger：触发依赖更新的核心函数
 * 当修改响应式对象的属性时调用，用于执行所有依赖该属性的 effect
 * @param target - 响应式对象
 * @param key - 被修改的属性名
 */
// 触发依赖
export function trigger(target: object, key: string | symbol) {
  // 从 targetMap 中获取该对象的依赖映射表
  let depsMap = targetMap.get(target)
  // 如果该对象没有任何依赖，直接返回
  if (!depsMap) return
  
  // 从 depsMap 中获取该属性的依赖集合
  let dep = depsMap.get(key)
  // 如果该属性有依赖的 effect，执行它们
  if (dep) {
    triggerEffects(dep)
  }
  
  // 调试日志：打印触发更新的详细信息
  console.log('trigger 触发依赖',
    target,
    'key',
    key,
    'dep',
    dep,
    'depsMap',
    depsMap,
    'targetMap',
    targetMap)
}
