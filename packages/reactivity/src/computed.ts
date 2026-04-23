/**
 * Vue Next Mini - Computed(计算属性)实现
 * 
 * 本文件实现了 Vue 3 的 computed API,提供懒求值和缓存机制。
 * 
 * 核心特性:
 * 1. 懒求值(Lazy Evaluation):只有在首次访问或依赖变化后才重新计算
 * 2. 缓存机制(Caching):计算结果会被缓存,避免重复计算
 * 3. 依赖追踪(Dependency Tracking):自动追踪 getter 中访问的响应式数据
 * 4. 调度策略(Scheduling):依赖变化时标记为 dirty,不立即重新计算
 * 
 * 工作原理:
 * ┌─────────────────┐
 * │ 创建 computed    │
 * │ computed(() =>   │
 * │   state.count * 2│
 * │ )                │
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │ ComputedRefImpl  │
 * │ - effect         │ ( ReactiveEffect(getter, scheduler) )
 * │ - _dirty = true  │ (需要重新计算)
 * │ - _value         │ (缓存的计算结果)
 * │ - dep            │ (依赖此 computed 的 effect)
 * └────────┬────────┘
 *          │
 *          ▼ 访问 .value
 * ┌─────────────────┐
 * │ 检查 _dirty?     │
 * ├─ Yes → 执行      │
 * │   effect.run()   │ (执行 getter,收集依赖,缓存结果)
 * │   _dirty = false │
 * ├─ No  → 返回      │
 * │   _value         │ (直接返回缓存值)
 * └────────┬────────┘
 *          │
 *          ▼ 依赖变化
 * ┌─────────────────┐
 * │ 触发 scheduler   │
 * │ _dirty = true    │ (标记为需要重新计算)
 * │ triggerRefValue  │ (通知依赖此 computed 的 effect)
 * └─────────────────┘
 * 
 * @example
 * ```typescript
 * const count = ref(0)
 * 
 * // 创建计算属性
 * const doubleCount = computed(() => count.value * 2)
 * 
 * // 首次访问,执行 getter
 * console.log(doubleCount.value) // 0 (执行: 0 * 2)
 * 
 * // 再次访问,使用缓存
 * console.log(doubleCount.value) // 0 (直接返回缓存,不重新计算)
 * 
 * // 修改依赖
 * count.value = 5
 * 
 * // 下次访问时,会重新计算
 * console.log(doubleCount.value) // 10 (执行: 5 * 2)
 * ```
 */

import { isFunction } from '@vue/shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue, triggerRefValue } from './ref'

/**
 * 计算属性实现类
 * 
 * ComputedRefImpl 是 computed 的核心实现,它结合了 effect 和 ref 的特性:
 * - 像 effect: 有 ReactiveEffect,可以追踪依赖
 * - 像 ref: 有 value 属性,可以通过 getter/setter 访问
 * 
 * 实现了懒求值和缓存机制:
 * 1. 只有在首次访问或依赖变化后才重新计算(_dirty 标志控制)
 * 2. 通过 scheduler 在依赖变化时标记为 dirty,而不是立即重新计算
 * 3. 计算结果缓存在 _value 中,避免重复计算
 * 
 * 与普通 effect 的区别:
 * - 普通 effect: 依赖变化时立即重新执行
 * - computed effect: 依赖变化时标记为 dirty,延迟到下次访问时才重新计算
 * 
 * 与 ref 的区别:
 * - ref: 手动设置 value
 * - computed: 自动根据 getter 计算 value,只读
 */
export class ComputedRefImpl<T> {
  // 依赖收集器,用于追踪哪些 effect 依赖了这个计算属性
  // 当 computed 的值变化时,需要通知这些 effect 重新执行
  public dep?: Dep = undefined
  
  // 缓存的计算结果
  // 只有在 _dirty 为 true 时才会更新
  public _value!: T
  
  // 响应式 effect,执行 getter 函数并收集依赖
  // 这个 effect 的 scheduler 会在依赖变化时被调用
  public readonly effect: ReactiveEffect<T>
  
  // 标识这是一个 ref 对象(用于 isRef 判断)
  public readonly __v_isRef = true
  
  // dirty 标志位:true 表示需要重新计算,false 表示可以使用缓存值
  // 初始值为 true,确保首次访问时会执行 getter
  private _dirty = true
  
  /**
   * 构造函数
   * 
   * 创建 ComputedRefImpl 实例,初始化 effect 和 scheduler。
   * 
   * @param getter - 计算属性的 getter 函数,返回值就是 computed 的值
   * 
   * @example
   * ```typescript
   * const count = ref(0)
   * 
   * const doubleCount = new ComputedRefImpl(() => {
   *   return count.value * 2
   * })
   * 
   * console.log(doubleCount.value) // 0
   * ```
   * 
   * Scheduler 的作用:
   * - 当 getter 中依赖的响应式数据变化时,scheduler 会被调用
   * - scheduler 将 _dirty 设为 true,标记需要重新计算
   * - 同时触发 triggerRefValue,通知依赖此 computed 的其他 effect
   * - 但不会立即重新执行 getter,而是等到下次访问 .value 时
   */
  constructor(getter: any) {
    // 创建响应式 effect,传入 getter 和 scheduler
    this.effect = new ReactiveEffect(
      getter,  // 副作用函数:执行 getter,收集依赖
      () => {  // scheduler: 当依赖变化时触发
        // scheduler 被调用的时机:
        // - getter 中访问的响应式数据发生变化
        // - 例如: count.value++ 触发了 doubleCount 的 scheduler
        
        // 如果当前不是 dirty 状态,说明之前已经计算过且有缓存
        if (!this._dirty) {
          // 标记为 dirty,表示下次访问时需要重新计算
          this._dirty = true
          
          // 触发依赖此计算属性的其他 effect 重新执行
          // 例如: effect(() => console.log(doubleCount.value))
          // 当 count 变化时,这个 effect 需要重新执行
          triggerRefValue(this)
        }
      }
    )
    
    // 将 computed 实例挂载到 effect 上,用于在 track 时建立关联
    // 这样在 triggerEffects 中可以区分 computed effect 和普通 effect
    this.effect.computed = this
  }
  
  /**
   * 获取计算属性的值(懒求值 + 缓存)
   * 
   * 这是 computed 的核心逻辑,实现了懒求值和缓存机制。
   * 
   * 执行流程:
   * 1. 调用 trackRefValue(this),收集依赖此 computed 的 effect
   * 2. 检查 _dirty 标志:
   *    - 如果为 true: 执行 effect.run(),重新计算并缓存结果
   *    - 如果为 false: 直接返回缓存的 _value,不重新计算
   * 3. 返回 _value
   * 
   * @returns 计算后的值
   * 
   * @example
   * ```typescript
   * const count = ref(0)
   * const doubleCount = computed(() => count.value * 2)
   * 
   * // 首次访问: _dirty = true
   * console.log(doubleCount.value)
   * // 1. trackRefValue(doubleCount) - 收集依赖
   * // 2. _dirty = true,执行 effect.run()
   * // 3. 执行 getter: count.value * 2 = 0
   * // 4. _value = 0, _dirty = false
   * // 5. 返回 0
   * 
   * // 再次访问: _dirty = false
   * console.log(doubleCount.value)
   * // 1. trackRefValue(doubleCount) - 收集依赖
   * // 2. _dirty = false,跳过计算
   * // 3. 直接返回 _value (0)
   * 
   * // 修改依赖
   * count.value = 5
   * // 1. 触发 doubleCount 的 scheduler
   * // 2. _dirty = true
   * // 3. triggerRefValue(doubleCount) - 通知依赖它的 effect
   * 
   * // 再次访问: _dirty = true
   * console.log(doubleCount.value)
   * // 1. trackRefValue(doubleCount) - 收集依赖
   * // 2. _dirty = true,执行 effect.run()
   * // 3. 执行 getter: count.value * 2 = 10
   * // 4. _value = 10, _dirty = false
   * // 5. 返回 10
   * ```
   * 
   * 性能优势:
   * - 避免重复计算:如果依赖没有变化,直接返回缓存值
   * - 延迟计算:只在真正需要时才计算,而不是依赖变化时立即计算
   * - 批量更新:多个依赖变化只会标记一次 dirty,不会多次计算
   */
  get value() {
    // 收集依赖:记录当前正在执行的 effect 依赖了这个计算属性
    // 例如: effect(() => console.log(doubleCount.value))
    // 这个 effect 会被添加到 doubleCount.dep 中
    trackRefValue(this)
    
    // 如果是 dirty 状态,说明需要重新计算
    if (this._dirty) {
      // 标记为非 dirty,避免重复计算
      // 注意:这里先设置为 false,防止 getter 中再次访问 this.value 导致无限递归
      this._dirty = false
      
      // 执行 effect.run() 会:
      // 1. 设置 activeEffect = this.effect
      // 2. 执行 getter 函数
      // 3. getter 中访问的响应式数据会收集 this.effect 作为依赖
      // 4. 返回计算结果
      // 5. 恢复 activeEffect
      this._value = this.effect.run()
    }
    
    // 返回缓存的计算结果
    // 如果 _dirty 为 false,直接返回之前的 _value,不重新计算
    return this._value
  }
  
  /**
   * 设置计算属性的值
   * 
   * 通常计算属性是只读的,除非提供了 setter。
   * 当前简化版本没有实现 setter 功能,只是一个占位符。
   * 
   * @param newValue - 新的值(当前版本中被忽略)
   * 
   * @example
   * ```typescript
   * // 完整版 Vue 3 支持 writable computed:
   * const firstName = ref('John')
   * const lastName = ref('Doe')
   * 
   * const fullName = computed({
   *   get() {
   *     return firstName.value + ' ' + lastName.value
   *   },
   *   set(newValue) {
   *     const names = newValue.split(' ')
   *     firstName.value = names[0]
   *     lastName.value = names[1]
   *   }
   * })
   * 
   * fullName.value = 'Jane Smith' // 触发 setter
   * console.log(firstName.value) // "Jane"
   * console.log(lastName.value) // "Smith"
   * ```
   * 
   * 注意事项:
   * - 当前简化版本不支持 writable computed
   * - 尝试设置 computed.value 只会打印日志,不会有任何效果
   * - 完整版需要检测 getterOrOptions 是否包含 set 属性
   */
  set value(newValue) {
    console.log('set value', newValue)
    // TODO: 实现 writable computed
    // 完整版应该:
    // 1. 检查是否有 setter
    // 2. 如果有,调用 setter(newValue)
    // 3. 如果没有,在开发环境抛出警告
  }
}

/**
 * 创建计算属性
 * 
 * 这是用户使用的 API,用于创建计算属性。
 * 支持两种用法:
 * 1. 直接传入 getter 函数
 * 2. 传入包含 get 和可选 set 的对象
 * 
 * @param getterOrOptions - getter 函数或包含 get/set 的对象
 * @returns ComputedRefImpl 实例
 * 
 * @example
 * ```typescript
 * // 用法1: 直接传入函数
 * const count = ref(0)
 * const doubleCount = computed(() => count.value * 2)
 * 
 * // 用法2: 传入对象(完整版支持)
 * const fullName = computed({
 *   get() {
 *     return firstName.value + ' ' + lastName.value
 *   },
 *   set(newValue) {
 *     const names = newValue.split(' ')
 *     firstName.value = names[0]
 *     lastName.value = names[1]
 *   }
 * })
 * ```
 * 
 * 工作流程:
 * 1. 判断传入的是函数还是对象
 * 2. 提取 getter 函数
 * 3. 创建 ComputedRefImpl 实例
 * 4. 返回实例
 * 
 * 注意事项:
 * - getter 应该是纯函数,不应该有副作用
 * - getter 中访问的响应式数据会自动成为依赖
 * - computed 的值是只读的(除非提供 setter)
 * - computed 适合用于派生状态,避免在模板中进行复杂计算
 */
export function computed(getterOrOptions: any) {
  let getter
  
  // 判断传入的是函数还是对象
  const onlyGetter = isFunction(getterOrOptions)
  
  if (onlyGetter) {
    // 如果直接传入函数,则作为 getter
    // 例如: computed(() => state.count * 2)
    getter = getterOrOptions
  } else {
    // 如果传入对象,则取对象的 get 属性
    // 例如: computed({ get() {...}, set() {...} })
    getter = getterOrOptions.get
  }
  
  // 创建计算属性实例
  const cRef = new ComputedRefImpl(getter)
  
  // 返回 ComputedRefImpl 实例
  // 用户可以通过 .value 访问计算结果
  return cRef
}
