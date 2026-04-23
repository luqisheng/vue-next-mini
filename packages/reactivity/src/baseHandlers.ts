/**
 * Vue Next Mini - Proxy 处理器(Handlers)实现
 * 
 * 本文件定义了 Proxy 的拦截器(get/set),是响应式系统的核心。
 * 
 * 工作原理:
 * 1. get 拦截器:拦截属性访问,调用 track() 收集依赖
 * 2. set 拦截器:拦截属性修改,调用 trigger() 触发更新
 * 
 * 关键设计:
 * - 使用工厂函数(createGetter/createSetter)创建拦截器
 * - 便于扩展,可以创建不同类型的 handlers(如 readonly, shallow)
 * - 通过闭包保存上下文信息
 * 
 * @example
 * ```typescript
 * const handlers = {
 *   get(target, key, receiver) {
 *     const res = Reflect.get(target, key, receiver)
 *     track(target, key) // 收集依赖
 *     return res
 *   },
 *   set(target, key, value, receiver) {
 *     const res = Reflect.set(target, key, value, receiver)
 *     trigger(target, key) // 触发更新
 *     return res
 *   }
 * }
 * 
 * const proxy = new Proxy(obj, handlers)
 * ```
 */

// 从 effect 模块导入依赖收集和触发更新的函数
import { track, trigger } from './effect'

/**
 * 创建 getter 拦截器工厂函数
 * 
 * 返回的函数会在访问对象属性时被调用。
 * 使用工厂函数的原因:
 * 1. 可以传入不同的配置(如 isReadonly, isShallow)
 * 2. 便于代码复用和扩展
 * 3. 保持代码的灵活性和可维护性
 * 
 * @returns getter 拦截器函数
 */
const get = createGetter()

/**
 * 创建 getter 拦截器的工厂函数
 * 
 * 在完整的 Vue 3 实现中,这个函数会接收参数来创建不同类型的 getter:
 * - isReadonly: 是否只读
 * - isShallow: 是否浅层响应式
 * 
 * 当前简化版本没有这些参数,但保留了工厂函数的结构,便于后续扩展。
 * 
 * @returns getter 拦截器函数
 * 
 * @example
 * ```typescript
 * // 完整版的可能用法:
 * const readonlyGet = createGetter(true, false)  // 只读,非浅层
 * const shallowGet = createGetter(false, true)   // 非只读,浅层
 * const normalGet = createGetter(false, false)   // 普通响应式
 * ```
 */
function createGetter() {
  /**
   * Proxy 的 get 拦截器
   * 
   * 当访问响应式对象的属性时,这个函数会被调用。
   * 
   * @param target - 被代理的目标对象(原始对象)
   * @param key - 要获取的属性名(字符串或 Symbol)
   * @param receiver - Proxy 实例本身(通常是 this 指向)
   * @returns 属性值
   * 
   * 执行流程:
   * 1. 使用 Reflect.get 获取属性的原始值
   * 2. 调用 track() 收集依赖(如果当前有活跃的 effect)
   * 3. 返回属性值
   * 
   * 为什么使用 Reflect.get 而不是 target[key]?
   * 1. 正确处理继承链上的属性
   * 2. 正确处理 getter 中的 this 指向
   * 3. 返回值更准确,避免一些边界情况
   * 
   * @example
   * ```typescript
   * const state = reactive({ count: 0 })
   * 
   * effect(() => {
   *   console.log(state.count) // 触发 get 拦截器
   *   // 1. Reflect.get(state, 'count') → 0
   *   // 2. track(state, 'count') → 收集当前 effect
   *   // 3. 返回 0
   * })
   * ```
   * 
   * 注意事项:
   * - 如果属性值是对象,在完整版中会递归转为 reactive
   * - 某些特殊属性(__v_isReactive, __v_isRef 等)不应收集依赖
   * - 数组的 length 属性有特殊处理逻辑
   */
  return function get(target: object, key: string | symbol, receiver: object) {
    // 使用 Reflect.get 获取属性的原始值
    // Reflect.get 的优势:
    // 1. 正确处理原型链上的属性
    // 2. 正确处理 getter 中的 this 指向(receiver)
    // 3. 返回值与原生行为一致
    const res = Reflect.get(target, key, receiver)
    
    // 关键:依赖收集,记录当前活跃 effect 依赖于该属性
    // 
    // track 的作用:
    // - 建立 "target.key → effect" 的映射关系
    // - 当 key 变化时,知道要通知哪些 effect
    // 
    // 如果没有活跃的 effect,track 会直接返回,不做任何操作
    // 例如:在组件 setup 中直接访问 state.count,不会收集依赖
    track(target, key)
    
    // 返回属性值
    // 在完整版中,如果 res 是对象,这里会递归调用 reactive(res)
    // 确保嵌套对象也是响应式的
    return res
  }
}

/**
 * 创建 setter 拦截器工厂函数
 * 
 * 返回的函数会在修改对象属性时被调用。
 * 与 getter 类似,使用工厂函数便于扩展不同类型的 setter。
 * 
 * @returns setter 拦截器函数
 */
const set = createSetter()

/**
 * 创建 setter 拦截器的工厂函数
 * 
 * 在完整版中,这个函数也会接收参数来创建不同类型的 setter。
 * 当前简化版本保留了工厂函数结构,便于后续扩展。
 * 
 * @returns setter 拦截器函数
 */
function createSetter() {
  /**
   * Proxy 的 set 拦截器
   * 
   * 当修改响应式对象的属性时,这个函数会被调用。
   * 
   * @param target - 被代理的目标对象(原始对象)
   * @param key - 要设置的属性名(字符串或 Symbol)
   * @param value - 新的属性值
   * @param receiver - Proxy 实例本身(通常是 this 指向)
   * @returns 设置是否成功(boolean)
   * 
   * 执行流程:
   * 1. 使用 Reflect.set 设置属性值
   * 2. 调用 trigger() 触发依赖更新
   * 3. 返回设置结果
   * 
   * 为什么使用 Reflect.set 而不是 target[key] = value?
   * 1. 返回值明确表示操作是否成功
   * 2. 正确处理继承链上的属性
   * 3. 正确处理 setter 中的 this 指向
   * 4. 符合 Proxy 的设计规范
   * 
   * @example
   * ```typescript
   * const state = reactive({ count: 0 })
   * 
   * effect(() => {
   *   console.log('count is:', state.count)
   * })
   * 
   * state.count = 1 // 触发 set 拦截器
   * // 1. Reflect.set(state, 'count', 1) → true
   * // 2. trigger(state, 'count') → 执行所有依赖 count 的 effect
   * // 3. 输出: "count is: 1"
   * ```
   * 
   * 注意事项:
   * - 如果新值与旧值相同,完整版中会跳过 trigger,避免不必要的更新
   * - 对于数组,需要特殊处理 length 和索引的变化
   * - 对于新增属性,需要触发特殊的 key('__iterate')
   * - 返回值必须与 Reflect.set 的返回值一致,否则 Proxy 会报错
   */
  return function set(target: object, key: string | symbol, value: any, receiver: object) {
    // 使用 Reflect.set 设置属性值
    // 
    // Reflect.set 的优势:
    // 1. 返回值明确表示操作是否成功
    // 2. 正确处理原型链和 setter
    // 3. 与 Proxy 配合良好,避免循环调用
    const res = Reflect.set(target, key, value, receiver)
    
    // 关键:触发更新,通知所有依赖该属性的 effect 重新执行
    // 
    // trigger 的作用:
    // - 找到所有依赖 target.key 的 effect
    // - 依次执行这些 effect(或通过 scheduler 调度)
    // - 实现响应式更新
    trigger(target, key)
    
    // 返回设置结果
    // 必须返回 Reflect.set 的结果,保持一致性
    return res
  }
}

/**
 * 可变对象的 Proxy 处理器配置
 * 
 * 这是最常用的 handlers,用于创建普通的响应式对象(reactive)。
 * 
 * 特点:
 * - get: 拦截属性访问,收集依赖
 * - set: 拦截属性修改,触发更新
 * - 允许读写操作,完全响应式
 * 
 * 其他类型的 handlers(完整版中有):
 * - readonlyHandlers: 只读,不允许修改
 * - shallowReactiveHandlers: 浅层响应式,不递归转换嵌套对象
 * - shallowReadonlyHandlers: 浅层只读
 * 
 * @example
 * ```typescript
 * // 使用 mutableHandlers 创建响应式对象
 * const proxy = new Proxy(obj, mutableHandlers)
 * 
 * // 等价于
 * const state = reactive(obj)
 * ```
 * 
 * 工作流程示意:
 * ```
 * 访问属性: proxy.count
 *   ↓
 * get(target, 'count', receiver)
 *   ↓
 * Reflect.get(...) → 获取值
 *   ↓
 * track(target, 'count') → 收集依赖
 *   ↓
 * 返回值
 * 
 * 修改属性: proxy.count = 1
 *   ↓
 * set(target, 'count', 1, receiver)
 *   ↓
 * Reflect.set(...) → 设置值
 *   ↓
 * trigger(target, 'count') → 触发更新
 *   ↓
 * 返回 true/false
 * ```
 */
export const mutableHandlers: ProxyHandler<object> = {
  // 属性读取拦截器,触发 track 依赖收集
  get,
  // 属性设置拦截器,触发 trigger 派发更新
  set
}
