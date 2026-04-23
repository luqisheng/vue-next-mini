/**
 * 属性更新策略模块
 * 
 * 该模块负责处理 DOM 元素属性的更新，根据属性类型选择不同的更新策略。
 * Vue 中的属性分为多种类型：class、style、事件监听器、DOM 属性、HTML 特性等，
 * 每种类型有不同的更新逻辑和性能考虑。
 * 
 * 设计目标：
 * 1. 统一入口：所有属性更新都通过 patchProp 函数
 * 2. 策略分发：根据属性名自动选择最优的更新方式
 * 3. 性能优化：针对不同类型采用专门的处理逻辑
 */

import { isOn } from '@vue/shared'
import { patchClass } from '../modules/class'
import { patchStyle } from '../modules/style'
import { patchDomProp } from '../modules/props'
import { patchAttr } from '../modules/attrs'
import { patchEvent } from '../modules/events'

/**
 * 属性更新主函数 - 根据属性类型分发到不同的处理函数
 * 
 * @param el - 目标 DOM 元素
 * @param key - 属性名（如 'class', 'style', 'onClick', 'id' 等）
 * @param prevValue - 旧值（用于对比和优化）
 * @param nextValue - 新值
 * 
 * 分发策略（优先级从高到低）：
 * 1. class - 使用专门的 class 处理器，支持字符串/对象/数组格式
 * 2. style - 使用样式处理器，支持对象和字符串格式，处理浏览器兼容性
 * 3. 事件监听器（以 on 开头）- 使用事件处理器，实现事件委托和缓存优化
 * 4. DOM 属性 - 对于某些特殊属性直接设置 DOM property
 * 5. HTML 特性（Attribute）- 使用 setAttribute/removeAttribute
 * 
 * 工作流程示例：
 * ```typescript
 * // 更新 class
 * patchProp(el, 'class', 'old-class', 'new-class')
 * 
 * // 更新样式
 * patchProp(el, 'style', { color: 'red' }, { color: 'blue' })
 * 
 * // 绑定事件
 * patchProp(el, 'onClick', oldHandler, newHandler)
 * 
 * // 设置普通属性
 * patchProp(el, 'id', 'old-id', 'new-id')
 * ```
 */
export const patchProp = (
  el: Element,
  key: string,
  prevValue: any,
  nextValue: any
) => {
  if (key === 'class') {
    // 处理 class 属性
    // 支持多种格式：字符串、对象 { className: boolean }、数组 ['class1', 'class2']
    patchClass(el, nextValue)
  } else if (key === 'style') {
    // 处理 style 属性
    // 支持对象格式 { color: 'red', fontSize: '14px' } 和字符串格式 'color: red;'
    patchStyle(el, nextValue, prevValue)
  } else if (isOn(key)) {
    // 处理事件监听器（属性名以 'on' 开头，如 onClick, onMouseenter）
    // isOn 是 shared 工具函数，判断是否以 'on' 开头且第四个字符是大写字母
    patchEvent(el, key, prevValue, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    // 处理应该设置为 DOM Property 的属性
    // 例如：input.value, video.src 等
    patchDomProp(el, key, nextValue)
  } else {
    // 处理普通的 HTML 特性（Attribute）
    // 使用 setAttribute/removeAttribute API
    patchAttr(el, key, nextValue)
  }
}

/**
 * 判断属性是否应该设置为 DOM Property 而非 HTML Attribute
 * 
 * @param el - 目标 DOM 元素
 * @param key - 属性名
 * @returns true 表示应该设置为 DOM Property，false 表示设置为 HTML Attribute
 * 
 * 核心判断逻辑：
 * 1. 如果属性名在元素对象中存在（key in el），通常应该设置为 DOM Property
 * 2. 但有三个特例需要排除：
 *    - 'form' 属性：虽然 input.form 存在，但应该作为 attribute 处理
 *    - 'list' 属性（当元素是 INPUT 时）：用于关联 datalist，应作为 attribute
 *    - 'type' 属性（当元素是 TEXTAREA 且当前 type 为 text 时）：避免动态修改 textarea 类型
 * 
 * DOM Property vs HTML Attribute 的区别：
 * - Property：DOM 对象的 JavaScript 属性，可以通过 el.propertyName 访问
 * - Attribute：HTML 标签上的属性，通过 getAttribute/setAttribute 操作
 * - 大多数情况下两者同步，但有些属性（如 input.value）不同步
 * 
 * 为什么需要区分：
 * - 某些属性设置为 Property 才能正确工作（如 input.value）
 * - 某些属性必须设置为 Attribute（如 form、list）
 * - 正确的设置方式可以避免边界情况和兼容性问题
 * 
 * 示例：
 * ```typescript
 * // input.value 应该设置为 Property
 * shouldSetAsProp(inputElement, 'value') // true
 * 
 * // input.form 应该设置为 Attribute
 * shouldSetAsProp(inputElement, 'form') // false
 * ```
 */
function shouldSetAsProp(el: Element, key: string) {
  // 特例 1：form 属性始终作为 attribute 处理
  if (key === 'form') {
    return false
  }
  
  // 特例 2：INPUT 元素的 list 属性（关联 datalist）作为 attribute 处理
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }
  
  // 特例 3：TEXTAREA 的 type 属性，如果当前是 text 类型，不要修改
  // 这是为了避免动态改变 textarea 的行为
  if (
    key === 'type' &&
    el.tagName === 'TEXTAREA' &&
    el.getAttribute(key) === 'text'
  ) {
    return false
  }
  
  // 默认规则：如果属性名存在于元素对象中，则设置为 DOM Property
  // 例如：'value' in inputElement 返回 true
  return key in el
}
