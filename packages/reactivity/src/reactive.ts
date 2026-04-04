// 从 baseHandlers 模块导入可变对象的 Proxy 处理器
import { mutableHandlers } from './baseHandlers'

/**
 * 全局弱引用缓存，存储已创建的响应式对象代理
 * Key: 原始对象，Value: Proxy 代理对象
 * 使用 WeakMap 避免内存泄漏，当原始对象被回收时，Proxy 也会自动被回收
 */
export const reactiveMap = new WeakMap<object, any>()

/**
 * reactive 函数：创建对象的响应式代理
 * @param target - 要转换为响应式的目标对象
 * @returns 响应式代理对象
 */
export function reactive(target: object) {
  // 使用统一的创建函数处理响应式对象
  return createReactiveObject(target, mutableHandlers, reactiveMap)
}

/**
 * 创建响应式对象的内部核心函数
 * 支持缓存机制，避免重复创建相同的 Proxy
 * 
 * @param target - 要转换为响应式的目标对象
 * @param baseHandlers - Proxy 的处理器配置（包含 get/set 拦截器）
 * @param proxyMap - 用于缓存已创建 Proxy 的 WeakMap
 * @returns 响应式代理对象
 */
function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  // 【优化点 1：缓存检查】
  // 如果该对象已经创建过 Proxy，直接返回缓存的代理，避免重复代理
  if (proxyMap.has(target)) {
    return proxyMap.get(target)
  }
  
  // 【核心步骤：创建 Proxy】
  // 使用 Proxy 包装目标对象，通过 baseHandlers 拦截属性的读写操作
  const proxy = new Proxy(target, baseHandlers)
  
  // 【优化点 2：缓存新创建的 Proxy】
  // 将原始对象和对应的 Proxy 存入缓存，下次可直接复用
  proxyMap.set(target, proxy)
  
  // 返回创建好的响应式代理对象
  return proxy
}
