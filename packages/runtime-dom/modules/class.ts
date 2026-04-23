/**
 * CSS 类名处理模块
 * 
 * 该模块负责处理元素的 class 属性更新，支持多种数据格式：
 * 1. 字符串格式：'class1 class2'
 * 2. 对象格式：{ class1: true, class2: false }
 * 3. 数组格式：['class1', 'class2', { class3: true }]
 * 
 * 设计目标：
 * - 提供灵活的 class 绑定方式，符合 Vue 的使用习惯
 * - 自动标准化不同格式为统一的字符串
 * - 正确处理空值和移除逻辑
 */

import { isString, isArray, isObject } from '../../shared/src/index'

/**
 * 标准化 class 值 - 将各种格式统一转换为字符串
 * 
 * @param value - 可以是字符串、对象、数组或任意值
 * @returns 标准化的 class 字符串
 * 
 * 支持的格式及转换规则：
 * 
 * 1. 字符串格式（直接返回）：
 *    'active selected' -> 'active selected'
 * 
 * 2. 对象格式（键为类名，值为布尔值决定是否包含）：
 *    { active: true, disabled: false } -> 'active'
 *    { 'btn-primary': true, 'btn-lg': true } -> 'btn-primary btn-lg'
 * 
 * 3. 数组格式（递归处理每个元素，过滤掉 falsy 值）：
 *    ['active', 'selected'] -> 'active selected'
 *    ['btn', { primary: true }] -> 'btn primary'
 *    [null, undefined, 'active'] -> 'active'
 * 
 * 4. 其他类型（转换为字符串）：
 *    123 -> '123'
 *    null -> ''
 * 
 * 实现细节：
 * - 对象格式：遍历所有键，值为 truthy 时保留该类名
 * - 数组格式：对每个元素递归调用 normalizeClass，然后拼接
 * - 使用 filter(Boolean) 过滤掉空字符串和 falsy 值
 * 
 * 示例：
 * ```typescript
 * normalizeClass('active')  // 'active'
 * normalizeClass({ active: true, disabled: false })  // 'active'
 * normalizeClass(['btn', { primary: true }])  // 'btn primary'
 * normalizeClass(null)  // ''
 * ```
 */
function normalizeClass(value: any): string {
  if (isString(value)) {
    // 字符串格式：直接返回
    return value
  }
  
  if (isObject(value)) {
    // 对象格式：{ className: boolean }
    // 遍历对象，收集值为 truthy 的键名
    let result = ''
    for (const key in value) {
      if (value[key]) {
        // 如果已经有内容，先添加空格分隔符
        result += (result ? ' ' : '') + key
      }
    }
    return result
  }
  
  if (isArray(value)) {
    // 数组格式：['class1', 'class2'] 或混合格式
    // 对每个元素递归标准化，然后过滤空值并拼接
    return value.map(normalizeClass).filter(Boolean).join(' ')
  }
  
  // 其他类型：转换为字符串（处理 null、undefined、数字等）
  return String(value || '')
}

/**
 * 更新元素的 class 属性
 * 
 * @param el - 目标 DOM 元素
 * @param value - class 值（支持字符串、对象、数组或 null）
 * 
 * 工作流程：
 * 1. 调用 normalizeClass 将值标准化为字符串
 * 2. 如果标准化后有值：
 *    - 设置 el.className（直接操作 DOM property，性能更好）
 *    - 同时调用 setAttribute（确保 attribute 也同步更新）
 * 3. 如果标准化后为空：
 *    - 清空 className
 *    - 移除 class attribute
 * 
 * 为什么要同时设置 className 和 attribute？
 * - className 是 DOM property，修改它会立即反映到 UI
 * - setAttribute 确保 HTML 标记也正确更新（某些场景需要）
 * - 两者保持一致可以避免潜在的同步问题
 * 
 * 性能考虑：
 * - 直接设置 className 比操作 classList 更快（单次赋值）
 * - 但需要注意会完全替换原有的类名（不是追加）
 * 
 * 示例：
 * ```typescript
 * patchClass(el, 'active selected')  // <div class="active selected">
 * patchClass(el, { active: true })   // <div class="active">
 * patchClass(el, null)               // <div> (移除 class)
 * ```
 */
export function patchClass(el: Element, value: string | object | Array<any> | null) {
  // 标准化 class 值
  const normalizedValue = normalizeClass(value)
  
  if (normalizedValue) {
    // 有值时：设置 className 和 attribute
    el.className = normalizedValue
    el.setAttribute('class', normalizedValue)
  } else {
    // 无值时：清空并移除
    el.className = ''
    el.removeAttribute('class')
  }
}
