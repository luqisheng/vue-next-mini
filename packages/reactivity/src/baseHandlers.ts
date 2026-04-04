// 从 effect 模块导入依赖收集和触发更新的函数
import { track, trigger } from './effect'

/**
 * 创建 getter 拦截器工厂函数
 * 返回的函数会在访问对象属性时被调用
 */
const get = createGetter()
function createGetter() {
  /**
   * Proxy 的 get 拦截器
   * @param target - 被代理的目标对象
   * @param key - 要获取的属性名
   * @param receiver - Proxy 实例本身
   * @returns 属性值
   */
  return function get(target: object, key: string | symbol, receiver: object) {
    // 使用 Reflect.get 获取属性的原始值
    const res = Reflect.get(target, key, receiver)
    
    // 关键：依赖收集，记录当前活跃 effect 依赖于该属性
    track(target, key)
    
    // 返回属性值
    return res
  }
}

/**
 * 创建 setter 拦截器工厂函数
 * 返回的函数会在修改对象属性时被调用
 */
const set = createSetter()
function createSetter() {
  /**
   * Proxy 的 set 拦截器
   * @param target - 被代理的目标对象
   * @param key - 要设置的属性名
   * @param value - 新的属性值
   * @param receiver - Proxy 实例本身
   * @returns 设置是否成功
   */
  return function set(target: object, key: string | symbol, value: any, receiver: object) {
    // 使用 Reflect.set 设置属性值
    const res = Reflect.set(target, key, value, receiver)
    
    // 关键：触发更新，通知所有依赖该属性的 effect 重新执行
    trigger(target, key)
    
    // 返回设置结果
    return res
  }
}

/**
 * 可变对象的 Proxy 处理器配置
 * 用于创建可响应式的对象代理
 */
export const mutableHandlers: ProxyHandler<object> = {
  // 属性读取拦截器，触发 track 依赖收集
  get,
  // 属性设置拦截器，触发 trigger 派发更新
  set
}
