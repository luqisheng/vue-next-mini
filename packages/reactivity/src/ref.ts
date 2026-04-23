/**
 * Vue Next Mini - Ref 实现
 * 
 * 本文件实现了 Vue 3 的 ref API,用于包装基本类型值为响应式对象。
 * 
 * 核心概念:
 * 1. Ref: 一个包含 value 属性的对象,通过 getter/setter 实现响应式
 * 2. RefImpl: Ref 的具体实现类,内部管理 _value 和 _rawValue
 * 3. trackRefValue: 访问 .value 时收集依赖
 * 4. triggerRefValue: 修改 .value 时触发更新
 * 
 * 与 reactive 的区别:
 * - ref: 用于基本类型(string, number, boolean),通过 .value 访问
 * - reactive: 用于对象类型,直接访问属性
 * 
 * @example
 * ```typescript
 * const count = ref(0)
 * 
 * effect(() => {
 *   console.log(count.value) // 访问时收集依赖
 * })
 * 
 * count.value++ // 修改时触发更新
 * ```
 * 
 * 工作原理:
 * ┌──────────────┐     get value      ┌──────────────┐
 * │ 访问 ref.value│ ────────────────► │trackRefValue  │
 * └──────────────┘                    │  收集依赖      │
 *                                     └──────────────┘
 *                                            ▲
 *                                            │
 * ┌──────────────┐    set value     ┌────────┴──────┐
 * │修改 ref.value│ ────────────────►│triggerRefValue│
 * └──────────────┘                  │  触发更新      │
 *                                   └───────────────┘
 */

import { Dep, createDep } from './dep'
import { activeEffect, trackEffects, triggerEffects } from './effect'
import { toReactive } from './reactive'
import { hasChanged } from '@vue/shared'

/**
 * Ref 接口定义
 * 
 * Ref 是一个包含 value 属性的对象,value 是响应式的。
 * 当访问或修改 value 时,会自动进行依赖收集和触发更新。
 * 
 * @template T - Ref 包装的值类型
 * @property value - 访问器属性,用于获取/设置包装的值(getter/setter)
 * @property __v_isRef - 标识该对象是否为 Ref 的标记(只读)
 * @property dep - 依赖收集容器,用于存储所有依赖此 Ref 的 effect
 * 
 * @example
 * ```typescript
 * interface Ref<number> {
 *   value: number
 *   __v_isRef: true
 *   dep?: Set<ReactiveEffect>
 * }
 * 
 * const count: Ref<number> = ref(0)
 * console.log(count.value) // 0
 * console.log(count.__v_isRef) // true
 * ```
 */
export interface Ref<T = any> {
  value: T
  __v_isRef: boolean
  dep?: Dep
}

/**
 * 创建 Ref 对象的入口函数
 * 
 * 这是用户使用的 API,用于将任意值包装成响应式的 Ref 对象。
 * 
 * @param value - 要被包装成响应式的原始值(可以是任意类型)
 * @returns 返回一个 Ref 对象,通过 .value 访问内部值
 * 
 * @example
 * ```typescript
 * // 包装基本类型
 * const count = ref(0)
 * const name = ref('Vue')
 * const flag = ref(true)
 * 
 * // 包装对象(会自动转为 reactive)
 * const obj = ref({ count: 0 })
 * console.log(isReactive(obj.value)) // true
 * 
 * // 包装数组
 * const list = ref([1, 2, 3])
 * list.value.push(4) // 响应式操作
 * ```
 * 
 * 注意事项:
 * - 如果传入的已经是 Ref,会直接返回,避免重复包装
 * - 如果值是对象,会自动调用 toReactive 转为响应式对象
 * - 基本类型通过 getter/setter 实现响应式
 */
export function ref(value?: unknown) {
  return createRef(value, false)
}

/**
 * 创建 Ref 对象的内部函数
 * 
 * 这是一个工厂函数,支持创建不同类型的 Ref:
 * - 普通 Ref (shallow = false): 对象值会自动转为 reactive
 * - 浅层 Ref (shallow = true): 对象值保持原样,不递归转换
 * 
 * @param rawValue - 原始值
 * @param shallow - 是否为浅层响应式
 *   - true: 不递归转换嵌套对象,只追踪 .value 的变化
 *   - false: 如果值是对象,自动转为 reactive
 * @returns 如果传入的已经是 Ref 则直接返回,否则创建新的 RefImpl 实例
 * 
 * @example
 * ```typescript
 * // 普通 ref
 * const r1 = createRef({ count: 0 }, false)
 * console.log(isReactive(r1.value)) // true (自动转为 reactive)
 * 
 * // 浅层 ref
 * const r2 = createRef({ count: 0 }, true)
 * console.log(isReactive(r2.value)) // false (保持原样)
 * 
 * r2.value = { count: 1 } // 触发更新
 * r2.value.count = 1 // 不会触发更新(浅层)
 * ```
 */
export function createRef(rawValue?: unknown, shallow?: boolean) {
  // 如果已经是 Ref 对象,直接返回,避免重复包装
  if (isRef(rawValue)) {
    return rawValue
  }
  // 创建新的 RefImpl 实例
  return new RefImpl(rawValue, Boolean(shallow))
}

/**
 * 判断一个值是否为 Ref 对象
 * 
 * 通过检查 __v_isRef 标记来判断。
 * 这个标记在 RefImpl 构造函数中被设置为 true。
 * 
 * @param value - 要检查的值
 * @returns 如果是 Ref 对象返回 true,否则返回 false
 * 
 * @example
 * ```typescript
 * const r = ref(0)
 * console.log(isRef(r)) // true
 * 
 * const obj = { value: 0 }
 * console.log(isRef(obj)) // false
 * 
 * const state = reactive({ count: 0 })
 * console.log(isRef(state)) // false
 * ```
 * 
 * 使用场景:
 * - unref 函数中,判断是否需要解包
 * - toValue 函数中,统一处理 Ref 和普通值
 * - 组件 props 验证中,检查类型
 */
// isRef
export function isRef(value: any): value is Ref {
  // !! 双重取反确保返回布尔值
  // value && value.__v_isRef === true 确保 value 不为 null/undefined
  return !!(value && value.__v_isRef === true)
}

/**
 * Ref 的具体实现类
 * 
 * 通过 getter/setter 拦截 value 属性的访问和修改,实现依赖收集和触发更新。
 * 
 * 内部结构:
 * - _rawValue: 存储原始值,用于比较是否发生变化
 * - _value: 存储经过响应式处理的值(如果是对象则转换为 reactive)
 * - dep: 依赖集合,存储所有依赖此 Ref 的 effect
 * - __v_isRef: 标记,标识这是一个 Ref 对象
 * - __v_isShallow: 标记,标识是否为浅层响应式
 * 
 * 工作流程:
 * 1. 访问 ref.value → 触发 getter → trackRefValue → 收集依赖
 * 2. 修改 ref.value → 触发 setter → 检查变化 → triggerRefValue → 触发更新
 * 
 * @template T - 值的类型
 */
// RefImpl
class RefImpl<T> implements Ref<T> {
  private _value: T // 存储经过响应式处理的值(如果是对象则转换为 reactive)
  private _rawValue: T // 存储原始值,用于比较是否发生变化
  public readonly __v_isRef = true // Ref 标识,用于 isRef() 判断
  public dep?: Dep = undefined // 依赖收集容器,存储所有依赖此 Ref 的 effect

  /**
   * RefImpl 构造函数
   * 
   * 初始化 Ref 实例,根据是否为浅层响应式来决定如何处理初始值。
   * 
   * @param value - 初始值
   * @param __v_isShallow - 是否为浅层响应式
   *   - true: 直接使用原始值,不转换
   *   - false: 如果值是对象,调用 toReactive 转为响应式
   * 
   * @example
   * ```typescript
   * // 普通 Ref
   * const r1 = new RefImpl(0, false)
   * console.log(r1._value) // 0
   * console.log(r1._rawValue) // 0
   * 
   * // 对象类型的普通 Ref
   * const r2 = new RefImpl({ count: 0 }, false)
   * console.log(isReactive(r2._value)) // true (自动转为 reactive)
   * console.log(r2._rawValue) // { count: 0 } (原始对象)
   * 
   * // 浅层 Ref
   * const r3 = new RefImpl({ count: 0 }, true)
   * console.log(isReactive(r3._value)) // false (保持原样)
   * ```
   */
  constructor(
    value: T,
    public readonly __v_isShallow: boolean
  ) {
    // 根据是否为浅层响应式来决定是否将值转换为 reactive
    // 
    // toReactive 的逻辑:
    // - 如果 value 是对象 → reactive(value)
    // - 如果 value 是基本类型 → 原样返回
    this._value = __v_isShallow ? value : toReactive(value)
    
    // 保存原始值,用于后续比较是否发生变化
    // 注意:_rawValue 始终是原始值,不会被转换
    this._rawValue = value
  }

  /**
   * value 的 getter
   * 
   * 当访问 ref.value 时,这个函数会被调用。
   * 
   * @returns 当前值(可能是响应式对象或原始值)
   * 
   * 执行流程:
   * 1. 调用 trackRefValue(this) 收集依赖
   * 2. 返回 this._value
   * 
   * @example
   * ```typescript
   * const count = ref(0)
   * 
   * effect(() => {
   *   console.log(count.value) // 触发 getter
   *   // 1. trackRefValue(count) → 收集当前 effect 到 count.dep
   *   // 2. 返回 count._value (0)
   * })
   * ```
   * 
   * 注意事项:
   * - 如果没有活跃的 effect,trackRefValue 不会做任何事
   * - 例如:在组件 setup 中直接访问 ref.value,不会收集依赖
   */
  get value() {
    // 收集依赖:如果当前有活跃的 effect,将其添加到 dep 中
    trackRefValue(this)
    // 返回内部存储的值
    return this._value
  }

  /**
   * value 的 setter
   * 
   * 当修改 ref.value 时,这个函数会被调用。
   * 
   * @param newValue - 新的值
   * 
   * 执行流程:
   * 1. 检查新值与原始值是否不同(hasChanged)
   * 2. 如果不同:
   *    a. 更新 _rawValue (保存原始值)
   *    b. 根据是否为浅层响应式,决定是否转换 _value
   *    c. 调用 triggerRefValue(this) 触发更新
   * 3. 如果相同,不做任何操作(避免不必要的更新)
   * 
   * @example
   * ```typescript
   * const count = ref(0)
   * 
   * effect(() => {
   *   console.log('count is:', count.value)
   * })
   * 
   * count.value = 1 // 触发 setter
   * // 1. hasChanged(1, 0) → true
   * // 2. _rawValue = 1
   * // 3. _value = 1 (基本类型,不需要转换)
   * // 4. triggerRefValue(count) → 执行所有依赖的 effect
   * // 输出: "count is: 1"
   * ```
   * 
   * 为什么需要 hasChanged 检查?
   * - 避免不必要的更新,提升性能
   * - 防止无限循环(例如 effect 中修改同一个 ref)
   * - 符合 Vue 的设计哲学:只在真正变化时才更新
   */
  set value(newValue: T) {
    console.log('set value', newValue)
    
    // 只有当新值与原始值不同时才触发更新
    // hasChanged 使用 Object.is 进行比较,能正确处理 NaN 和 +0/-0
    if (hasChanged(newValue, this._rawValue)) {
      // 更新原始值
      this._rawValue = newValue
      
      // 根据是否为浅层响应式来决定是否将新值转换为 reactive
      // - 浅层:直接使用新值
      // - 非浅层:如果新值是对象,自动转为 reactive
      this._value = this.__v_isShallow ? newValue : toReactive(newValue)
      
      // 触发依赖更新:执行所有依赖此 Ref 的 effect
      triggerRefValue(this)
    }
  }
}

/**
 * 追踪 Ref 的依赖收集函数
 * 
 * 当访问 ref.value 时,这个函数会被调用,用于收集依赖。
 * 
 * @param ref - Ref 对象
 * 
 * 执行流程:
 * 1. 检查是否有活跃的 effect
 * 2. 如果有,获取或创建 ref.dep (依赖集合)
 * 3. 将 activeEffect 添加到 dep 中
 * 
 * @example
 * ```typescript
 * const count = ref(0)
 * 
 * effect(() => {
 *   console.log(count.value) // 访问 value,触发 trackRefValue
 * })
 * 
 * // count.dep 现在是: Set([effect])
 * ```
 * 
 * 懒初始化 dep:
 * - ref.dep || (ref.dep = createDep())
 * - 只有在第一次收集依赖时才创建 dep
 * - 避免为未被追踪的 ref 创建空的 Set,节省内存
 */
// trackRefValue
export function trackRefValue(ref: Ref) {
  if (activeEffect) {
    // 如果 ref.dep 不存在,创建一个新的 Dep
    // 然后将当前活跃的 effect 添加到 dep 中
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

/**
 * 触发 Ref 依赖更新的函数
 * 
 * 当 Ref 的值改变时,这个函数会被调用,用于通知所有依赖的 effect 重新执行。
 * 
 * @param ref - Ref 对象
 * 
 * 执行流程:
 * 1. 检查 ref.dep 是否存在
 * 2. 如果存在,调用 triggerEffects(dep)
 * 3. triggerEffects 会遍历 dep 中的所有 effect,依次执行
 * 
 * @example
 * ```typescript
 * const count = ref(0)
 * 
 * effect(() => {
 *   console.log('count is:', count.value)
 * })
 * 
 * count.value = 1 // 触发 setter,调用 triggerRefValue
 * // 1. 检查 count.dep (存在)
 * // 2. triggerEffects(count.dep)
 * // 3. 执行所有 effect
 * // 输出: "count is: 1"
 * ```
 * 
 * 注意事项:
 * - 如果 dep 为空(没有 effect 依赖此 ref),不做任何操作
 * - effect 的执行顺序取决于它们被收集的顺序
 * - 如果 effect 有 scheduler,会调用 scheduler 而不是直接执行
 */
// triggerRefValue
export function triggerRefValue(ref: Ref) {
  if (ref.dep) {
    // 触发所有依赖此 Ref 的 effect
    triggerEffects(ref.dep)
  }
}
