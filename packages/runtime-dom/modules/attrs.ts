/**
 * HTML 特性（Attribute）处理模块
 * 
 * 该模块负责处理普通的 HTML 特性更新，使用原生的 setAttribute 和 removeAttribute API。
 * 
 * 适用场景：
 * - 自定义数据属性（data-*）
 * - ARIA 属性（aria-*）
 * - 普通 HTML 特性（如 id, title, src, href 等）
 * - 不被 patchProp 特殊处理的属性
 * 
 * 与 DOM Property 的区别：
 * - Attribute 是 HTML 标签上的字符串值
 * - Property 是 DOM 对象上的 JavaScript 值（可能有类型转换）
 * - 例如：<input value="123"> 的 attribute 是字符串 "123"，但 property 可能是数字 123
 */

/**
 * 更新或移除 HTML 特性
 * 
 * @param el - 目标 DOM 元素
 * @param key - 特性名称（如 'id', 'data-value', 'aria-label'）
 * @param value - 特性值，如果为 null 则移除该特性
 * 
 * 工作原理：
 * 1. 如果值为 null，调用 removeAttribute 移除特性
 * 2. 否则调用 setAttribute 设置特性
 * 
 * 注意事项：
 * - setAttribute 的值会被转换为字符串
 * - removeAttribute 会完全移除特性，而不是设置为空字符串
 * - 某些浏览器对某些特性有特殊处理（如 boolean attributes）
 * 
 * 示例：
 * ```typescript
 * // 设置特性
 * patchAttr(el, 'data-id', '123')  // <div data-id="123">
 * patchAttr(el, 'aria-label', 'Close')  // <button aria-label="Close">
 * 
 * // 移除特性
 * patchAttr(el, 'data-id', null)  // 移除 data-id 属性
 * ```
 */
export function patchAttr(el: Element, key: string, value: any) {
  if (value === null) {
    // 值为 null 时移除特性
    el.removeAttribute(key)
  } else {
    // 设置特性（值会被自动转换为字符串）
    el.setAttribute(key, value)
  }
}
