/**
 * CSS 样式处理模块
 * 
 * 该模块负责处理元素的 style 属性更新，支持对象格式和字符串格式的样式设置。
 * 
 * 设计目标：
 * 1. 支持多种格式：对象 { color: 'red' } 和字符串 'color: red;'
 * 2. 增量更新：只更新变化的样式属性，保留未变化的属性
 * 3. 清理逻辑：当新值中移除某个样式时，正确清空旧值
 * 4. 数组支持：某些样式属性可以接受多个值（如 vendor prefixes）
 * 
 * 与 class 的区别：
 * - class 是离散的类名切换
 * - style 是连续的样式值设置
 * - style 的优先级高于 class
 */

import { isString, isArray } from '../../shared/src/index'

/**
 * 更新元素的 inline style
 * 
 * @param el - 目标 DOM 元素
 * @param prev - 旧的样式值（对象或字符串）
 * @param next - 新的样式值（对象或字符串）
 * 
 * 工作流程：
 * 
 * 情况 1：新值是对象格式（常见场景）
 * ```typescript
 * patchStyle(el, { color: 'red' }, { color: 'blue', fontSize: '14px' })
 * ```
 * 处理步骤：
 * a. 遍历新值对象，逐个设置样式属性
 * b. 如果旧值也是对象，检查哪些属性被移除，将其清空
 * 
 * 情况 2：新值是字符串格式
 * ```typescript
 * patchStyle(el, 'color: red;', 'color: blue; font-size: 14px;')
 * ```
 * 处理步骤：
 * a. 直接设置 style.cssText（完全替换）
 * b. 这种方式简单但会丢失未指定的样式
 * 
 * 性能优化：
 * - 对象格式支持增量更新，只修改变化的属性
 * - 字符串格式使用 cssText 一次性设置，适合批量更新
 * 
 * 示例：
 * ```typescript
 * // 对象格式（推荐）
 * patchStyle(el, null, { color: 'red', fontSize: '14px' })
 * // 结果：<div style="color: red; font-size: 14px;">
 * 
 * // 更新部分样式
 * patchStyle(el, { color: 'red', fontSize: '14px' }, { color: 'blue' })
 * // 结果：<div style="color: blue; font-size: ;"> (fontSize 被清空)
 * 
 * // 字符串格式
 * patchStyle(el, null, 'color: red; font-size: 14px;')
 * // 结果：<div style="color: red; font-size: 14px;">
 * ```
 */
export function patchStyle(el: Element, prev: any, next: any) {
  // 获取元素的 style 对象（CSSStyleDeclaration）
  const style = (el as HTMLElement).style
  
  // 判断新值是否是字符串格式
  const isCssString = isString(next)
  
  if (next && !isCssString) {
    // 情况 1：新值是对象格式
    
    // 步骤 a：设置新的样式属性
    for (const key in next) {
      setStyle(style, key, next[key])
    }
    
    // 步骤 b：清理旧值中存在但新值中不存在的属性
    if (prev && !isString(prev)) {
      for (const key in prev) {
        // 如果新值中该属性为 null/undefined，则清空
        if (next[key] == null) {
          setStyle(style, key, '')
        }
      }
    }
  } else {
    // 情况 2：新值是字符串格式或 null
    // 直接使用 cssText 完全替换（注意：这里应该是 next 而不是 prev）
    // 原代码有个 bug，应该设置为 next 而不是 prev
    style.cssText = next || ''
  }
}

/**
 * 设置单个样式属性
 * 
 * @param style - CSSStyleDeclaration 对象（即 element.style）
 * @param name - CSS 属性名（如 'color', 'fontSize', 'background-color'）
 * @param val - 样式值，可以是字符串或字符串数组
 * 
 * 支持的值的类型：
 * 1. 字符串：直接设置
 *    ```typescript
 *    setStyle(style, 'color', 'red')
 *    // 结果：style.color = 'red'
 *    ```
 * 
 * 2. 数组：拼接为空格分隔的字符串（用于 vendor prefixes 或多值）
 *    ```typescript
 *    setStyle(style, 'display', ['-webkit-box', '-ms-flexbox', 'flex'])
 *    // 结果：style.display = '-webkit-box -ms-flexbox flex'
 *    ```
 * 
 * 注意事项：
 * - CSS 属性名可以是驼峰式（fontSize）或连字符式（font-size）
 * - 浏览器会自动处理这两种格式的转换
 * - 数组格式在实际开发中较少使用，主要用于兼容性处理
 * 
 * 为什么需要这个函数？
 * - 统一处理字符串和数组两种情况
 * - 便于未来扩展（如添加单位转换、浏览器前缀等）
 * - 提取公共逻辑，避免重复代码
 */
function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) {
  // 如果值是数组，用空格连接；否则直接使用
  // 使用 (style as any) 绕过 TypeScript 的类型检查
  // 因为 style 的索引签名可能不包含所有 CSS 属性
  ;(style as any)[name] = isArray(val) ? val.join(' ') : val
}
