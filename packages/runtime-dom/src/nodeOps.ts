/**
 * DOM 节点操作封装模块
 * 
 * 该模块提供了一组统一的 DOM 操作方法，将原生 DOM API 抽象为渲染器可用的接口。
 * runtime-core 的渲染器通过这些方法来操作真实 DOM，实现了平台无关性。
 * 
 * 设计原则：
 * 1. 抽象层：隐藏不同平台（浏览器、Weex、小程序等）的 DOM 操作差异
 * 2. 一致性：提供统一的 API 接口，便于测试和维护
 * 3. 性能：直接使用原生 DOM API，避免不必要的封装开销
 */

const doc = document

/**
 * DOM 节点操作集合对象
 * 
 * 包含所有渲染器需要的 DOM 操作方法，这些方法会被传递给 createRenderer 作为 rendererOptions 的一部分。
 */
export const nodeOps = {
  /**
   * 插入子节点到父节点中
   * 
   * @param child - 要插入的子节点
   * @param parent - 父节点
   * @param anchor - 锚点节点（可选），如果提供则插入到锚点之前，否则追加到末尾
   * 
   * 工作原理：
   * - 使用原生 insertBefore API
   * - 如果没有锚点，传入 null 表示追加到末尾（insertBefore 第二个参数为 null 时等同于 appendChild）
   * 
   * 应用场景：
   * - 挂载新组件时插入根元素
   * - 列表渲染时插入新项
   * - 条件渲染时显示/隐藏元素
   */
  insert(child: any, parent: Element, anchor?: any) {
    parent.insertBefore(child, anchor || null)
  },

  /**
   * 从 DOM 树中移除节点
   * 
   * @param child - 要移除的节点
   * 
   * 安全检查：
   * - 先检查节点是否存在
   * - 再检查节点是否有父节点（避免重复移除导致错误）
   * 
   * 应用场景：
   * - 卸载组件时移除根元素
   * - 列表项删除时移除对应 DOM
   * - 条件渲染时隐藏元素
   */
  remove(child: any) {
    if (child && child.parentNode) {
      child.parentNode.removeChild(child)
    }
  },

  /**
   * 创建 HTML 元素节点
   * 
   * @param tag - HTML 标签名（如 'div', 'span', 'input' 等）
   * @returns 创建的 DOM 元素
   * 
   * 工作原理：
   * - 使用 document.createElement 创建元素
   * - 返回的是原生 DOM 对象，可以直接操作
   * 
   * 注意：
   * - 这里只创建普通 HTML 元素，不涉及 Web Components 或自定义元素
   * - SVG 元素的创建需要特殊处理（本简化版本未实现）
   */
  createElement(tag: any): Element {
    const el = doc.createElement(tag)
    return el
  },

  /**
   * 设置元素的文本内容
   * 
   * @param node - 目标元素
   * @param text - 要设置的文本内容
   * 
   * 工作原理：
   * - 直接设置 textContent 属性
   * - 会清除元素内所有子节点，替换为纯文本
   * 
   * 应用场景：
   * - 更新插值表达式 {{ message }} 的内容
   * - 设置纯文本节点
   * 
   * 性能考虑：
   * - textContent 比 innerText 性能更好（不触发重排）
   * - 适合大量文本更新场景
   */
  setElementText(node: Element, text: string) {
    node.textContent = text
  },

  /**
   * 创建文本节点
   * 
   * @param text - 文本内容
   * @returns 创建的文本节点
   * 
   * 工作原理：
   * - 使用 document.createTextNode 创建文本节点
   * - 文本节点是 DOM 树中的叶子节点，不包含子节点
   * 
   * 应用场景：
   * - 渲染模板中的纯文本部分
   * - 插值表达式的结果展示
   * 
   * 与 setElementText 的区别：
   * - createText 创建独立的文本节点对象
   * - setElementText 直接设置元素的 textContent 属性
   */
  createText(text: string): Text {
    return doc.createTextNode(text)
  },

  /**
   * 设置节点的文本值
   * 
   * @param node - 目标节点（通常是文本节点或注释节点）
   * @param text - 要设置的文本内容
   * 
   * 工作原理：
   * - 修改节点的 nodeValue 属性
   * - 适用于文本节点和注释节点
   * 
   * 应用场景：
   * - 更新已存在的文本节点内容
   * - 动态修改注释内容（调试场景）
   * 
   * 与 setElementText 的区别：
   * - setText 针对单个节点（文本节点/注释节点）
   * - setElementText 针对元素节点，会清空所有子节点
   */
  setText(node: Element, text: string) {
    node.nodeValue = text
  },

  /**
   * 创建注释节点
   * 
   * @param text - 注释内容
   * @returns 创建的注释节点
   * 
   * 工作原理：
   * - 使用 document.createComment 创建注释节点
   * - 注释节点在 DOM 中不可见，但存在于 DOM 树中
   * 
   * 应用场景：
   * - Vue 模板编译时的占位符（如 v-if 分支的标记）
   * - SSR 水合（hydration）时的边界标记
   * - 调试时标记组件边界
   * 
   * 示例：
   * 编译后的模板可能包含：<!--v-if--> 这样的注释作为条件渲染的标记
   */
  createComment(text: string): Comment {
    return doc.createComment(text)
  },
}
