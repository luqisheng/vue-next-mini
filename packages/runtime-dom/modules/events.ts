/**
 * 事件监听器处理模块
 * 
 * 该模块负责处理 DOM 事件的绑定和更新，实现了 Vue 的事件系统核心逻辑。
 * 
 * 设计目标：
 * 1. 事件缓存：避免重复绑定相同的事件监听器
 * 2. 动态更新：支持运行时替换事件处理函数而无需解绑再绑定
 * 3. 内存管理：正确清理事件监听器，防止内存泄漏
 * 
 * 核心机制：
 * - 使用 _vei 对象在 DOM 元素上缓存事件处理器（VEI = Vue Event Invokers）
 * - 每个事件类型对应一个 invoker 函数，invoker 内部引用实际的处理函数
 * - 更新时只需修改 invoker.value，无需重新 addEventListener/removeEventListener
 */

/**
 * 更新事件监听器
 * 
 * @param el - 目标 DOM 元素（扩展类型包含 _vei 缓存对象）
 * @param rawName - 原始事件名（如 'onClick', 'onMouseenter'）
 * @param prevValue - 旧的事件处理函数
 * @param nextValue - 新的事件处理函数
 * 
 * 工作流程：
 * 1. 获取或初始化 _vei 缓存对象（存储在 DOM 元素上）
 * 2. 从缓存中查找该事件类型的现有 invoker
 * 3. 根据新旧值的情况进行不同处理：
 *    a. 有新值且有旧 invoker：直接更新 invoker.value（无需重新绑定）
 *    b. 有新值但无旧 invoker：创建新的 invoker 并绑定事件
 *    c. 无新值但有旧 invoker：解绑事件并清理缓存
 * 
 * 性能优化：
 * - 当只是更新处理函数时（情况 a），不需要调用 removeEventListener/addEventListener
 * - 直接修改 invoker.value，浏览器会自动调用新的处理函数
 * - 避免了频繁的事件绑定/解绑操作
 * 
 * 示例场景：
 * ```typescript
 * // 首次绑定
 * patchEvent(el, 'onClick', null, handleClick)
 * // 创建 invoker，调用 addEventListener
 * 
 * // 更新处理函数
 * patchEvent(el, 'onClick', handleClick, handleNewClick)
 * // 只更新 invoker.value，不重新绑定
 * 
 * // 移除事件
 * patchEvent(el, 'onClick', handleNewClick, null)
 * // 调用 removeEventListener，清理缓存
 * ```
 */
export function patchEvent(
  el: Element & { _vei?: Object },
  rawName: string,
  prevValue: any,
  nextValue: any
) {
  // 获取或初始化事件缓存对象
  // _vei (Vue Event Invokers) 存储所有事件类型的 invoker 函数
  const invokers: any = el._vei || (el._vei = {})
  
  // 从缓存中获取当前事件类型的 invoker
  const existingInvoker = invokers[rawName]
  
  if (nextValue && existingInvoker) {
    // 情况 1：有新值且存在旧的 invoker
    // 直接更新 invoker 的 value，无需重新绑定事件
    // 这是性能优化的关键：避免 removeEventListener + addEventListener
    existingInvoker.value = nextValue
  } else {
    // 情况 2 和 3：需要绑定或解绑事件
    // 解析事件名（将 'onClick' 转换为 'click'）
    const name = parseName(rawName)
    
    if (nextValue) {
      // 情况 2：有新值，创建新的 invoker 并绑定事件
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker)
    } else if (existingInvoker) {
      // 情况 3：无新值但有旧 invoker，解绑事件并清理缓存
      el.removeEventListener(name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

/**
 * 解析事件名 - 将 Vue 风格的事件名转换为原生事件名
 * 
 * @param name - Vue 风格的事件名（如 'onClick', 'onMouseenter'）
 * @returns 原生事件名（如 'click', 'mouseenter'）
 * 
 * 转换规则：
 * - 去掉前缀 'on'（2 个字符）
 * - 转换为小写（因为 HTML 事件名通常是小写的）
 * 
 * 示例：
 * ```typescript
 * parseName('onClick')      // 'click'
 * parseName('onMouseenter') // 'mouseenter'
 * parseName('onKeyUp')      // 'keyup'
 * ```
 * 
 * 注意：这是一个简化版本，完整的 Vue 实现还需要处理：
 * - 修饰符（如 .once, .capture, .passive）
 * - 自定义事件映射
 */
function parseName(name: string) {
  // 去掉 'on' 前缀并转为小写
  let event = name.slice(2).toLowerCase()
  return event
}

/**
 * 创建事件调用器（Invoker）
 * 
 * @param initiaValue - 初始的事件处理函数
 * @returns invoker 函数（包含 value 属性的特殊函数）
 * 
 * Invoker 的设计原理：
 * - invoker 本身是一个函数，可以作为事件监听器传递给 addEventListener
 * - invoker 有一个 value 属性，存储实际的业务处理函数
 * - 当事件触发时，invoker 被调用，然后转发给 invoker.value
 * 
 * 这种设计的优势：
 * 1. 稳定性：invoker 函数本身不变，可以长期绑定到 DOM 元素
 * 2. 灵活性：通过修改 invoker.value 可以动态更换处理函数
 * 3. 性能：避免频繁的事件绑定/解绑操作
 * 
 * 工作流程：
 * ```typescript
 * // 创建 invoker
 * const invoker = createInvoker(handleClick)
 * // invoker 是一个函数：(e) => invoker.value(e)
 * // invoker.value 指向 handleClick
 * 
 * // 绑定到 DOM
 * el.addEventListener('click', invoker)
 * 
 * // 更新处理函数（无需重新绑定）
 * invoker.value = handleNewClick
 * 
 * // 事件触发时
 * // 1. 浏览器调用 invoker(event)
 * // 2. invoker 内部调用 invoker.value(event)
 * // 3. 实际执行 handleNewClick(event)
 * ```
 * 
 * 闭包的作用：
 * - invoker 函数形成了一个闭包，可以访问自己的 value 属性
 * - 即使外部修改了 invoker.value，闭包内的引用也会自动更新
 */
function createInvoker(initiaValue: any) {
  // 创建 invoker 函数
  const invoker = (e: Event) => {
    // 如果 value 存在，调用实际的处理函数
    // 这里做了安全检查，避免 value 为 null/undefined 时报错
    invoker.value && invoker.value(e)
  }
  
  // 设置初始的处理函数
  invoker.value = initiaValue
  
  return invoker
}
