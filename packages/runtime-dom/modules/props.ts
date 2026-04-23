/**
 * DOM Property 处理模块
 * 
 * 该模块负责直接设置 DOM 元素的 JavaScript 属性（Property）。
 * 
 * 适用场景：
 * - 需要直接操作 DOM 对象属性的情况
 * - 某些特殊属性只能通过 property 设置（如 input.value, video.src）
 * - 性能敏感的场景（property 访问比 attribute 快）
 * 
 * 与 HTML Attribute 的区别：
 * - Property：DOM 对象的 JavaScript 属性，有类型（字符串、数字、布尔值等）
 * - Attribute：HTML 标签上的字符串属性，通过 getAttribute/setAttribute 操作
 * - 例如：<input value="123"> 的 attribute 是 "123"，但 property 可能是数字 123
 * 
 * 注意事项：
 * - 不是所有 property 都可以安全设置（有些是只读的）
 * - 设置错误的 property 可能导致运行时错误
 * - 使用 try-catch 包裹以容错
 */

/**
 * 直接设置 DOM 元素的 property
 * 
 * @param el - 目标 DOM 元素
 * @param key - property 名称（如 'value', 'checked', 'disabled'）
 * @param value - 要设置的值
 * 
 * 工作原理：
 * - 直接使用 el[key] = value 的方式设置 property
 * - 这是最直接的 DOM 操作方式，没有中间层
 * 
 * 错误处理：
 * - 使用 try-catch 捕获可能的异常
 * - 某些 property 是只读的（如 parentNode），设置时会抛出错误
 * - 静默失败，不向外暴露错误（避免影响渲染流程）
 * 
 * 常见应用场景：
 * ```typescript
 * // 表单元素的值
 * patchDomProp(inputElement, 'value', 'Hello')
 * 
 * // 复选框的选中状态
 * patchDomProp(checkboxElement, 'checked', true)
 * 
 * // 禁用状态
 * patchDomProp(buttonElement, 'disabled', true)
 * 
 * // 媒体元素的源
 * patchDomProp(videoElement, 'src', 'video.mp4')
 * ```
 * 
 * 为什么需要 try-catch？
 * - 某些 property 是只读的（如 nodeName, parentElement）
 * - 某些 property 有严格的类型要求
 * - 不同浏览器对某些 property 的处理可能不同
 * - 静默失败可以避免中断整个渲染流程
 */
export function patchDomProp(el: any, key: string, value: any) {
  try {
    // 直接设置 DOM property
    el[key] = value
  } catch (error) {
    // 静默处理错误，避免中断渲染
    // 在实际生产中可以考虑记录日志用于调试
  }
}
