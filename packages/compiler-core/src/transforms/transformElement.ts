/**
 * Vue Next Mini - 元素节点转换插件
 * 
 * 本文件实现了 transformElement 转换插件,负责将 ELEMENT 类型的 AST 节点
 * 转换为可用于代码生成的 VNODE_CALL 节点。
 * 
 * 转换时机:
 * - 在 traverseNode 的 exit 阶段执行 (postTransformElement)
 * - 确保子节点已经处理完毕
 * 
 * 转换目标:
 * ```
 * 输入 (ELEMENT 节点):
 * {
 *   type: NodeTypes.ELEMENT,
 *   tag: 'div',
 *   props: [...],
 *   children: [...]
 * }
 * 
 * 输出 (添加 codegenNode):
 * {
 *   type: NodeTypes.ELEMENT,
 *   tag: 'div',
 *   props: [...],
 *   children: [...],
 *   codegenNode: {
 *     type: NodeTypes.VNODE_CALL,
 *     tag: '"div"',
 *     props: [],
 *     children: [...]
 *   }
 * }
 * ```
 * 
 * 工作流程:
 * 1. 检查节点类型是否为 ELEMENT
 * 2. 提取标签名、属性、子节点
 * 3. 调用 createVNodeCall 创建 VNODE_CALL 节点
 * 4. 将 VNODE_CALL 赋值给 node.codegenNode
 * 5. 在 codegen 阶段,VNODE_CALL 会被转换为 createElementVNode 调用
 */

import { NodeTypes, createVNodeCall } from '../ast'

/**
 * 元素节点转换插件
 * 
 * 这是一个工厂函数,返回 exit 阶段的回调函数。
 * 
 * @param node - 当前遍历到的 AST 节点
 * @param context - 转换上下文
 * @returns exit 阶段的回调函数 (postTransformElement)
 * 
 * 为什么返回函数?
 * - transform 在 enter 阶段被调用
 * - 返回的函数会在 exit 阶段执行
 * - 这样可以确保子节点已经处理完毕
 * 
 * @example
 * ```typescript
 * // 在 transform.ts 中:
 * const onExit = transformElement(node, context)
 * // ... 递归处理子节点 ...
 * onExit() // 在 exit 阶段执行
 * ```
 */
export const transformElement = (node: any, context: any) => {
  /**
   * Exit 阶段的回调函数
   * 
   * 在节点的所有子节点处理完毕后执行。
   * 
   * @param node - 当前节点 (从 context.currentNode 获取)
   * 
   * 处理逻辑:
   * 1. 从 context 获取最新的 currentNode
   * 2. 检查是否为 ELEMENT 类型
   * 3. 提取标签名、属性、子节点
   * 4. 创建 VNODE_CALL 节点
   * 5. 赋值给 node.codegenNode
   * 
   * 注意事项:
   * - 只处理 ELEMENT 节点,其他节点直接返回
   * - vnodeTag 需要加引号,因为它是字符串字面量
   * - vnodeProps 当前简化版本为空数组
   * - vnodeChildren 直接使用原始 children
   */
  return function postTransformElement(node: any) {
    // 从上下文获取最新的节点 (可能被其他 transform 修改过)
    node = context.currentNode
    
    // 只处理元素节点
    if (node.type !== NodeTypes.ELEMENT) return
    
    // 提取标签名
    const { tag } = node
    
    // 生成 vnode 的标签参数 (需要加引号,因为是字符串字面量)
    let vnodeTag = `"${tag}"`
    
    // 属性列表 (当前简化版本为空)
    // TODO: 应该转换 props 为 JS_OBJECT_EXPRESSION
    let vnodeProps: any = []
    
    // 子节点列表
    let vnodeChildren = node.children
    
    // 保存原始的 children 引用 (供后续使用)
    node.codegenChildren = node.children
    
    // 创建 VNODE_CALL 节点
    // 这个节点会在 codegen 阶段被转换为:
    // createElementVNode("div", props, children)
    node.codegenNode = createVNodeCall(
      context,    // 转换上下文 (用于注册 helper)
      vnodeTag,   // 标签名
      vnodeProps, // 属性
      vnodeChildren // 子节点
    )
  }
}
