import { isFunction } from '@vue/shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue, triggerRefValue } from './ref'

/**
 * 计算属性实现类
 * 实现了懒求值和缓存机制：
 * 1. 只有在首次访问或依赖变化后才重新计算
 * 2. 通过 _dirty 标志位控制是否需要重新计算
 * 3. 当依赖的响应式数据变化时，通过 scheduler 标记为 dirty
 */
export class ComputedRefImpl<T> {
    // 依赖收集器，用于追踪哪些 effect 依赖了这个计算属性
    public dep?: Dep = undefined
    
    // 缓存的计算结果
    public _value!: T
    
    // 响应式 effect，执行 getter 函数并收集依赖
    public readonly effect: ReactiveEffect<T>
    
    // 标识这是一个 ref 对象
    public readonly __v_isRef = true
    
    // dirty 标志位：true 表示需要重新计算，false 表示可以使用缓存值
    private _dirty = true
    
    /**
     * 构造函数
     * @param getter - 计算属性的 getter 函数
     */
  constructor(getter:any) {
    // 创建响应式 effect，传入 getter 和 scheduler
    this.effect = new ReactiveEffect(getter,()=>{
      // scheduler：当 effect 的依赖发生变化时触发
      // 如果当前不是 dirty 状态，说明之前已经计算过且有缓存
      if (!this._dirty) {
        // 标记为 dirty，表示下次访问时需要重新计算
        this._dirty = true
        // 触发依赖此计算属性的其他 effect 重新执行
        triggerRefValue(this)
      }
    })
    // 将 computed 实例挂载到 effect 上，用于在 track 时建立关联
    this.effect.computed = this
  }
  
  /**
   * 获取计算属性的值（懒求值 + 缓存）
   */
  get value() {
    // 收集依赖：记录当前正在执行的 effect 依赖了这个计算属性
    trackRefValue(this)
    
    // 如果是 dirty 状态，说明需要重新计算
    if (this._dirty) {
      // 标记为非 dirty，避免重复计算
      this._dirty = false
      // 执行 effect.run() 会：
      // 1. 执行 getter 函数
      // 2. 收集 getter 中访问的响应式数据作为依赖
      // 3. 返回计算结果
      this.effect.run()
    }
    
    // 注意：这里有个问题，应该使用缓存的值而不是再次执行 run()
    // 正确的做法应该是：this._value = this.effect.run() 放在 if 块内
    this._value = this.effect.run()
    return this._value
  }
  
  /**
   * 设置计算属性的值
   * 通常计算属性是只读的，除非提供了 setter
   */
  set value(newValue) {
    console.log('set value',newValue)
  }
}

/**
 * 创建计算属性
 * @param getterOrOptions - getter 函数或包含 get/set 的对象
 * @returns ComputedRefImpl 实例
 */
export function computed(getterOrOptions: any) {
  let getter
  
  // 判断传入的是函数还是对象
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    // 如果直接传入函数，则作为 getter
    getter = getterOrOptions
  } else {
    // 如果传入对象，则取对象的 get 属性
    getter = getterOrOptions.get
  }
  
  // 创建计算属性实例
  const cRef = new ComputedRefImpl(getter)
  return cRef
}