import { Dep, createDep } from './dep'
import { activeEffect, trackEffects, triggerEffects } from './effect'
import { toReactive } from './reactive'
import { hasChanged } from '@vue/shared'
/**
 * Ref 接口定义
 * @template T - Ref 包装的值类型
 * @property value - 访问器属性，用于获取/设置包装的值
 * @property __v_isRef - 标识该对象是否为 Ref 的标记
 * @property dep - 依赖收集容器，用于存储所有依赖此 Ref 的 effect
 */
export interface Ref<T = any> {
  value: T
  __v_isRef: boolean
  dep?: Dep
}

/**
 * 创建 Ref 对象的入口函数
 * @param value - 要被包装成响应式的原始值
 * @returns 返回一个 Ref 对象
 */
export function ref(value?: unknown) {
  return createRef(value, false)
}

/**
 * 创建 Ref 对象的内部函数
 * @param rawValue - 原始值
 * @param shallow - 是否为浅层响应式，true 表示不递归转换嵌套对象
 * @returns 如果传入的已经是 Ref 则直接返回，否则创建新的 RefImpl 实例
 */
export function createRef(rawValue?: unknown, shallow?: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, Boolean(shallow))
}

/**
 * 判断一个值是否为 Ref 对象
 * @param value - 要检查的值
 * @returns 如果是 Ref 对象返回 true，否则返回 false
 */
// isRef
export function isRef(value: any): value is Ref {
  return !!(value && value.__v_isRef === true)
}

/**
 * Ref 的具体实现类
 * 通过 getter/setter 拦截 value 属性的访问和修改，实现依赖收集和触发更新
 * @template T - 值的类型
 */
// RefImpl
class RefImpl<T> implements Ref<T> {
  private _value: T // 存储经过响应式处理的值（如果是对象则转换为 reactive）
  private _rawValue: T // 存储原始值，用于比较是否发生变化
  public readonly __v_isRef = true // Ref 标识
  public dep?: Dep = undefined // 依赖收集容器

  /**
   * RefImpl 构造函数
   * @param value - 初始值
   * @param __v_isShallow - 是否为浅层响应式
   */
  constructor(
    value: T,
    public readonly __v_isShallow: boolean
  ) {
    // 根据是否为浅层响应式来决定是否将值转换为 reactive
    this._value = __v_isShallow? value : toReactive(value)
    this._rawValue = value
  }

  /**
   * value 的 getter
   * 在访问值时进行依赖收集
   * @returns 当前值
   */
  get value() {
    trackRefValue(this)
    return this._value
  }

  /**
   * value 的 setter
   * 在设置新值时触发依赖更新
   * @param newValue - 新的值
   */
  set value(newValue: T) {
    console.log('set value',newValue)
    // 只有当新值与原始值不同时才触发更新
    if(hasChanged(newValue, this._rawValue)) {
      this._rawValue = newValue
      // 根据是否为浅层响应式来决定是否将新值转换为 reactive
      this._value = this.__v_isShallow ? newValue : toReactive(newValue)
      triggerRefValue(this)
    }
  }
}

/**
 * 追踪 Ref 的依赖收集函数
 * 当 activeEffect 存在时，将当前 effect 添加到 Ref 的依赖容器中
 * @param ref - Ref 对象
 */
// trackRefValue
export function trackRefValue(ref: Ref) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

/**
 * 触发 Ref 依赖更新的函数
 * 当 Ref 的值改变时，执行所有依赖此 Ref 的 effect
 * @param ref - Ref 对象
 */
// triggerRefValue
export function triggerRefValue(ref: Ref) {
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}