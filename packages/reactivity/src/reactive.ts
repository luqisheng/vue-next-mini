/**
 * Vue Next Mini - 响应式对象(reactive)实现
 * 
 * 本文件实现了 Vue 3 的 reactive API,通过 Proxy 将普通对象转换为响应式对象。
 * 
 * 核心原理:
 * 1. 使用 Proxy 拦截对象的属性访问(get)和修改(set)
 * 2. get 拦截器中调用 track() 收集依赖
 * 3. set 拦截器中调用 trigger() 触发更新
 * 4. 使用 WeakMap 缓存已创建的 Proxy,避免重复代理
 * 
 * 与 ref 的区别:
 * - reactive: 用于对象类型,自动深度转换嵌套对象
 * - ref: 用于任意类型,需要通过 .value 访问
 * 
 * @example
 * ```typescript
 * const state = reactive({
 *   count: 0,
 *   user: { name: 'Vue' } // 嵌套对象也会自动转为响应式
 * })
 * 
 * effect(() => {
 *   console.log(state.count) // 访问时收集依赖
 * })
 * 
 * state.count++ // 修改时触发更新
 * ```
 */

// 从 baseHandlers 模块导入可变对象的 Proxy 处理器
import { mutableHandlers } from './baseHandlers'
// 导入 isObject 工具函数
import { isObject } from '@vue/shared'

/**
 * 全局弱引用缓存,存储已创建的响应式对象代理
 * Key: 原始对象,Value: Proxy 代理对象
 * 
 * 使用 WeakMap 的原因:
 * 1. 避免内存泄漏:当原始对象被垃圾回收时,Proxy 也会自动被回收
 * 2. 性能优化:避免对同一个对象重复创建 Proxy
 * 3. 身份保持:确保 reactive(obj) 多次调用返回同一个 Proxy
 * 
 * @example
 * ```typescript
 * const obj = { count: 0 }
 * const proxy1 = reactive(obj)
 * const proxy2 = reactive(obj)
 * 
 * console.log(proxy1 === proxy2) // true (从缓存返回)
 * ```
 */
export const reactiveMap = new WeakMap<object, any>()

/**
 * 响应式标记枚举
 * 用于标识一个对象是否为响应式对象
 */
export const enum ReactiveFlags {
  /** 标识该对象是响应式的 */
  IS_REACTIVE = '__v_isReactive',
}

/**
 * reactive 函数:创建对象的响应式代理
 * 
 * 这是 Vue 3 中最常用的响应式 API 之一,用于将普通对象转换为响应式对象。
 * 
 * @param target - 要转换为响应式的目标对象(必须是对象类型)
 * @returns 响应式代理对象
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const state = reactive({
 *   count: 0,
 *   name: 'Vue'
 * })
 * 
 * // 在 effect 中使用
 * effect(() => {
 *   console.log(state.count) // 收集依赖
 * })
 * 
 * state.count++ // 触发更新
 * ```
 * 
 * @example
 * ```typescript
 * // 嵌套对象会自动转为响应式
 * const state = reactive({
 *   user: {
 *     name: 'Vue',
 *     age: 3
 *   }
 * })
 * 
 * effect(() => {
 *   console.log(state.user.name) // 深层属性也能收集依赖
 * })
 * 
 * state.user.name = 'Vue 3' // 触发更新
 * ```
 * 
 * 注意事项:
 * - 只能用于对象类型(Array, Object, Map, Set 等)
 * - 对于基本类型(string, number, boolean),应使用 ref
 * - 返回的是 Proxy 对象,不是原始对象的副本
 * - 不要解构响应式对象,会丢失响应性
 */
export function reactive(target: object) {
  // 使用统一的创建函数处理响应式对象
  return createReactiveObject(target, mutableHandlers, reactiveMap)
}

/**
 * 创建响应式对象的内部核心函数
 * 
 * 这是一个通用的工厂函数,支持不同类型的响应式对象创建。
 * 通过传入不同的 handlers 和 proxyMap,可以创建:
 * - reactive (可变响应式)
 * - readonly (只读响应式)
 * - shallowReactive (浅层响应式)
 * 
 * @param target - 要转换为响应式的目标对象
 * @param baseHandlers - Proxy 的处理器配置(包含 get/set 拦截器)
 * @param proxyMap - 用于缓存已创建 Proxy 的 WeakMap
 * @returns 响应式代理对象
 * 
 * 工作流程:
 * 1. 检查缓存,如果已存在则直接返回
 * 2. 创建 Proxy,使用 baseHandlers 拦截操作
 * 3. 添加响应式标记(__v_isReactive)
 * 4. 存入缓存,方便下次复用
 * 5. 返回 Proxy 对象
 */
function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  // 【优化点 1:缓存检查】
  // 如果该对象已经创建过 Proxy,直接返回缓存的代理,避免重复代理
  // 
  // 为什么需要缓存?
  // 1. 性能:避免重复创建 Proxy 的开销
  // 2. 一致性:确保 reactive(obj) 多次调用返回同一个对象
  // 3. 避免循环:防止递归代理导致的死循环
  if (proxyMap.has(target)) {
    return proxyMap.get(target)
  }
  
  // 【核心步骤:创建 Proxy】
  // 使用 Proxy 包装目标对象,通过 baseHandlers 拦截属性的读写操作
  // 
  // Proxy 的优势:
  // 1. 可以拦截所有属性访问,包括动态添加的属性
  // 2. 不需要预先知道对象的属性列表
  // 3. 性能优于 Object.defineProperty(尤其是对于大对象)
  const proxy = new Proxy(target, baseHandlers)

  // 【添加响应式标记】
  // 在 Proxy 上添加 __v_isReactive 标记,用于后续判断是否为响应式对象
  // 这个标记只在 Proxy 上存在,不会污染原始对象
  proxy[ReactiveFlags.IS_REACTIVE] = true
  
  // 【优化点 2:缓存新创建的 Proxy】
  // 将原始对象和对应的 Proxy 存入缓存,下次可直接复用
  proxyMap.set(target, proxy)
  
  // 返回创建好的响应式代理对象
  return proxy
}

/**
 * 将值转换为响应式(如果是对象)
 * 
 * 这是一个工具函数,用于在需要的地方自动将对象转为响应式。
 * 常用于 ref 的内部实现,当 ref 的值是对象时,自动调用 toReactive。
 * 
 * @param value - 任意类型的值
 * @returns 如果值是对象则返回响应式代理,否则原样返回
 * 
 * @example
 * ```typescript
 * const obj = { count: 0 }
 * const reactiveObj = toReactive(obj) // reactive({ count: 0 })
 * 
 * const num = 42
 * const sameNum = toReactive(num) // 42 (基本类型不变)
 * ```
 * 
 * 应用场景:
 * - ref 的实现中,当值是对象时自动转为 reactive
 * - 组件 props 的处理中,对象类型的 props 自动响应式化
 */
export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value as object) : value

/**
 * 判断一个值是否为响应式对象
 * 
 * 通过检查 __v_isReactive 标记来判断。
 * 这个标记在 createReactiveObject 中被添加到 Proxy 上。
 * 
 * @param value - 要检查的值
 * @returns 如果是响应式对象返回 true,否则返回 false
 * 
 * @example
 * ```typescript
 * const state = reactive({ count: 0 })
 * console.log(isReactive(state)) // true
 * 
 * const obj = { count: 0 }
 * console.log(isReactive(obj)) // false
 * 
 * const r = ref(0)
 * console.log(isReactive(r)) // false (ref 不是 reactive)
 * ```
 * 
 * 注意事项:
 * - 只能检测 reactive 创建的对象,不能检测 ref
 * - 检测 ref 应使用 isRef()
 * - !! 双重取反确保返回布尔值
 */
export const isReactive = (value: any): boolean =>
  !!(value && value.__v_isReactive)
