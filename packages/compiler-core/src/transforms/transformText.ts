/**
 * Vue Next Mini - 文本节点合并转换插件
 * 
 * 本文件实现了 transformText 转换插件,负责将相邻的文本节点合并为一个复合表达式。
 * 
 * 优化目标:
 * 减少生成的代码量,提高运行时性能。
 * 
 * 转换示例:
 * ```
 * 模板: <div>Hello {{ name }}!</div>
 * 
 * 解析后的 AST children:
 * [
 *   { type: TEXT, content: 'Hello ' },
 *   { type: INTERPOLATION, content: 'name' },
 *   { type: TEXT, content: '!' }
 * ]
 * 
 * 转换后 (未优化):
 * createElementVNode("div", null, [
 *   "Hello ",
 *   _toDisplayString(name),
 *   "!"
 * ])
 * 
 * 转换后 (优化后):
 * createElementVNode("div", null, [
 *   "Hello " + _toDisplayString(name) + "!"
 * ])
 * ```
 * 
 * 工作原理:
 * 1. 遍历节点的子节点
 * 2. 找到连续的文本节点或插值节点
 * 3. 将它们合并为一个 COMPOUND_EXPRESSION
 * 4. 使用 '+' 运算符连接
 * 
 * 性能优势:
 * - 减少数组元素数量
 * - 减少虚拟 DOM 节点数量
 * - 提高 diff 效率
 */

import { NodeTypes } from '../ast'
import { isText } from '../utils'

/**
 * 文本节点合并转换插件
 * 
 * @param node - 当前遍历到的 AST 节点
 * @param compile - 编译上下文 (实际应该是 context)
 * @returns exit 阶段的回调函数,或者 undefined
 * 
 * 处理的节点类型:
 * - ROOT: 根节点
 * - ELEMENT: 元素节点
 * - IF_BRANCH: v-if 分支
 * - FOR: v-for 循环
 * 
 * 为什么不处理其他节点?
 * - 只有容器节点才有 children
 * - 文本节点、插值节点等是叶子节点,没有子节点需要合并
 */
// 作用：将相邻的文本节点进行合并为一个表达式
export const transformText = (node: any, compile: any) => {
  // 只处理容器节点
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.IF_BRANCH ||
    node.type === NodeTypes.FOR
  ) {
    // 返回 exit 阶段的回调函数
    return () => {
      const children = node.children
      
      // 当前正在合并的容器 (COMPOUND_EXPRESSION)
      let currentContainer: any = null
      
      // 遍历所有子节点
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        
        // 检查是否为文本类节点 (TEXT 或 INTERPOLATION)
        if (isText(child)) {
          // 向后查找连续的文本节点
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            
            // 如果下一个也是文本节点
            if (isText(next)) {
              // 如果还没有创建容器,创建一个新的 COMPOUND_EXPRESSION
              if (!currentContainer) {
                // 将当前节点替换为复合表达式
                currentContainer = children[i] = createCompoundExpression(
                  [child],  // 初始包含当前节点
                  child.loc // 位置信息
                )
              }
              
              // 将下一个节点添加到容器中,用 '+' 连接
              currentContainer.children.push(' + ', next)
              
              // 从 children 数组中移除已合并的节点
              children.splice(j, 1)
              
              // 调整索引,避免跳过下一个元素
              j--
            } else {
              // 遇到非文本节点,结束当前合并
              currentContainer = undefined
              break
            }
          }
        }
      }
    }
  }
}

/**
 * 创建复合表达式节点
 * 
 * 用于将多个文本/插值节点合并为一个表达式。
 * 
 * @param children - 子节点数组 (可以是节点或字符串)
 * @param loc - 位置信息
 * @returns COMPOUND_EXPRESSION 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createCompoundExpression(
 *   [
 *     { type: TEXT, content: 'Hello ' },
 *     ' + ',
 *     { type: INTERPOLATION, content: 'name' }
 *   ],
 *   loc
 * )
 * 
 * // 输出
 * {
 *   type: NodeTypes.COMPOUND_EXPRESSION,
 *   children: [...],
 *   loc: {...}
 * }
 * 
 * // codegen 阶段生成:
 * // "Hello " + _toDisplayString(name)
 * ```
 * 
 * children 的结构:
 * - 节点对象: TEXT, INTERPOLATION 等
 * - 字符串: ' + ', ' - ',等操作符
 * 
 * 在 codegen 时,会依次生成所有 children,形成完整的表达式
 */
// createCompoundExpression
export function createCompoundExpression(children: any, loc: any) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    children,
    loc
  }
}
