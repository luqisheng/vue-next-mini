/**
 * Vue Next Mini - v-if 指令转换插件
 * 
 * 本文件实现了 v-if/v-else/v-else-if 指令的转换逻辑。
 * 
 * 核心功能:
 * 1. 识别 v-if/v-else/v-else-if 指令
 * 2. 将条件分支转换为 IF/IF_BRANCH AST 节点
 * 3. 生成条件表达式 (三元运算符) 的代码
 * 
 * 转换示例:
 * ```
 * 模板:
 * <div v-if="show">Content</div>
 * 
 * 解析后的 AST:
 * {
 *   type: ELEMENT,
 *   tag: 'div',
 *   props: [
 *     { type: DIRECTIVE, name: 'if', exp: 'show' }
 *   ],
 *   children: [...]
 * }
 * 
 * 转换后的 AST:
 * {
 *   type: IF,
 *   branches: [
 *     {
 *       type: IF_BRANCH,
 *       condition: 'show',
 *       children: [ELEMENT节点]
 *     }
 *   ]
 * }
 * 
 * 生成的代码:
 * show
 *   ? createElementVNode("div", ...)
 *   : _createCommentVNode("v-if", true)
 * ```
 * 
 * v-if/v-else 链:
 * ```
 * 模板:
 * <div v-if="a">A</div>
 * <div v-else-if="b">B</div>
 * <div v-else>C</div>
 * 
 * 生成的代码:
 * a
 *   ? createElementVNode("div", ..., "A")
 *   : b
 *     ? createElementVNode("div", ..., "B")
 *     : createElementVNode("div", ..., "C")
 * ```
 */

import {
  NodeTypes,
  createConditionalExpression,
  createCallExpression,
  createObjectProperty,
  createSimpleExpression,
  createObjectExpression
} from '../ast'
import {
  createStructuralDirectiveTransform,
  TransformContext
} from '../transform'
import { CREATE_COMMENT } from '../runtimeHelpers'
import { getMemoedVNodeCall } from '../utils'
import { isString } from '@vue/shared'

/**
 * v-if 指令转换插件
 * 
 * 使用 createStructuralDirectiveTransform 创建结构性指令转换器。
 * 
 * @param /^(if|else|else-if)$/ - 匹配 v-if, v-else, v-else-if
 * @param 处理函数 - 接收 (node, dir, context) 参数
 * @returns 转换插件函数
 * 
 * 工作流程:
 * 1. 匹配指令名称 (if, else, else-if)
 * 2. 调用 processIf 处理 v-if
 * 3. 返回 exit 回调,用于生成 codegenNode
 */
export const transformIf = createStructuralDirectiveTransform(
  // 正则表达式:匹配 if, else, else-if
  /^(if|else|else-if)$/,
  
  // 处理函数
  (node: any, dir: any, context: any) => {
    // 调用 processIf 处理指令
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      let key = 0
      
      // 返回 exit 回调
      return () => {
        if (isRoot) {
          // 根分支 (v-if):直接创建 codegenNode
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            key++,
            context
          )
        } else {
          // 非根分支 (v-else-if / v-else):找到链的末尾,添加 alternate
          let parentCondition = ifNode.codegenNode
          
          // 遍历到条件表达式的最后一个 alternate
          while (
            parentCondition.alternate.type ===
            NodeTypes.JS_CONDITIONAL_EXPRESSION
          ) {
            parentCondition = parentCondition.alternate
          }
          
          // 在末尾添加新的分支
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            key++,
            context
          )
        }
      }
    })
  }
)

/**
 * 处理 v-if 指令
 * 
 * 将带有 v-if 指令的元素节点转换为 IF/IF_BRANCH 结构。
 * 
 * @param node - 带有 v-if 指令的元素节点
 * @param dir - 指令对象 { name: 'if', exp: 'show' }
 * @param context - 转换上下文
 * @param processCodegen - 可选的代码生成回调
 * @returns exit 回调函数 (如果提供了 processCodegen)
 * 
 * 工作流程:
 * 1. 检查是否为 v-if 指令 (不是 v-else 或 v-else-if)
 * 2. 创建 IF_BRANCH 节点
 * 3. 创建 IF 节点,包含该分支
 * 4. 替换原节点为 IF 节点
 * 5. 如果提供了 processCodegen,调用并返回其结果
 * 
 * @example
 * ```typescript
 * // 输入: <div v-if="show">Content</div>
 * 
 * // 创建的 IF_BRANCH:
 * {
 *   type: IF_BRANCH,
 *   condition: 'show',
 *   children: [div元素节点]
 * }
 * 
 * // 创建的 IF:
 * {
 *   type: IF,
 *   branches: [IF_BRANCH]
 * }
 * 
 * // 替换后,原 div 节点被 IF 节点替代
 * ```
 * 
 * 为什么只处理 v-if?
 * - v-else 和 v-else-if 需要依附于前面的 v-if
 * - 它们会在后续的遍历中被处理
 * - v-if 是条件链的起点
 */
export function processIf(
  node: any,
  dir: any,
  context: TransformContext,
  processCodegen?: (node: any, branch: any, isRoot: boolean) => () => void
) {
  // 只处理 v-if 指令
  if (dir.name === 'if') {
    // 创建条件分支
    const branch = createIfBranch(node, dir)
    
    // 创建 IF 节点
    const ifNode = {
      type: NodeTypes.IF,
      loc: {},
      branches: [branch]  // 初始只有一个分支
    }
    
    // 用 IF 节点替换原元素节点
    context.replaceNode(ifNode)
    
    // 如果提供了代码生成回调,调用它
    if (processCodegen) {
      // 第三个参数 true 表示这是根分支 (v-if)
      return processCodegen(ifNode, branch, true)
    }
  }
}

/**
 * 创建 IF_BRANCH 节点
 * 
 * @param node - 元素节点
 * @param dir - 指令对象
 * @returns IF_BRANCH 节点
 * 
 * @example
 * ```typescript
 * // 输入: <div v-if="show">Content</div>
 * // dir = { name: 'if', exp: { content: 'show', ... } }
 * 
 * // 输出:
 * {
 *   type: IF_BRANCH,
 *   condition: dir.exp,  // 'show'
 *   children: [div节点]
 * }
 * ```
 */
function createIfBranch(node: any, dir: any) {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: {},
    condition: dir.exp,  // 条件表达式
    children: [node]     // 分支内的子节点
  }
}

/**
 * 为分支创建代码生成节点
 * 
 * 根据分支是否有条件,决定生成条件表达式还是直接生成子节点代码。
 * 
 * @param branch - IF_BRANCH 节点
 * @param keyIndex - key 索引 (用于生成唯一的 key)
 * @param context - 转换上下文
 * @returns 代码生成节点 (CONDITIONAL_EXPRESSION 或其他)
 * 
 * 处理逻辑:
 * 1. 如果有条件 (v-if 或 v-else-if):
 *    - 创建条件表达式: condition ? consequent : alternate
 *    - consequent: 分支的子节点代码
 *    - alternate: 注释节点占位符
 * 2. 如果没有条件 (v-else):
 *    - 直接返回子节点代码
 * 
 * @example
 * ```typescript
 * // v-if 分支
 * createCodegenNodeForBranch(branch, 0, context)
 * // 返回: show ? createElementVNode(...) : _createCommentVNode("v-if", true)
 * 
 * // v-else 分支
 * createCodegenNodeForBranch(branch, 1, context)
 * // 返回: createElementVNode(...)
 * ```
 */
// createCodegenNodeForBranch
function createCodegenNodeForBranch(
  branch: any,
  keyIndex: number,
  context: TransformContext
) {
  if (branch.condition) {
    // 有条件:创建三元表达式
    return createConditionalExpression(
      branch.condition,  // 条件: show
      // 真值分支:子节点的代码
      createChildrenCodegenNode(branch, keyIndex),
      // 假值分支:注释节点占位符
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true'])
    )
  } else {
    // 无条件 (v-else):直接返回子节点代码
    return createChildrenCodegenNode(branch, keyIndex)
  }
}

/**
 * 为分支的子节点创建代码生成节点
 * 
 * 主要工作:
 * 1. 获取第一个子节点的 codegenNode
 * 2. 注入 key 属性 (用于 diff 算法)
 * 3. 返回增强后的 codegenNode
 * 
 * @param branch - IF_BRANCH 节点
 * @param keyIndex - key 索引
 * @returns 注入了 key 的 codegenNode
 * 
 * @example
 * ```typescript
 * // 输入 branch.children[0].codegenNode:
 * // { type: VNODE_CALL, tag: '"div"', props: null, children: [...] }
 * 
 * // 输出:
 * // { type: VNODE_CALL, tag: '"div"', props: { key: 0 }, children: [...] }
 * ```
 * 
 * 为什么需要 key?
 * - v-if 分支切换时,Vue 需要知道是否复用 DOM
 * - 不同的 key 表示不同的分支,不会复用
 * - 提高 diff 算法的准确性
 */
function createChildrenCodegenNode(branch: any, keyIndex: number) {
  // 创建 key 属性: { key: 0 }
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false)  // 动态值
  )
  
  const { children } = branch
  const firstChild = children[0]
  
  // 获取第一个子节点的 codegenNode
  const ret = firstChild.codegenNode
  
  // 获取真正的 VNODE_CALL (可能包裹在其他节点中)
  const vnodeCall = getMemoedVNodeCall(ret)
  
  // 注入 key 属性
  injextProp(vnodeCall, keyProperty)
  
  return ret
}

/**
 * 向节点注入属性
 * 
 * @param node - VNODE_CALL 节点或其他节点
 * @param prop - 要注入的属性 (如 key)
 * 
 * 处理逻辑:
 * 1. 确定节点的 props 位置
 *    - VNODE_CALL: node.props
 *    - JS_CALL_EXPRESSION: node.arguments[2]
 * 2. 如果 props 为空或是字符串类型:
 *    - 创建新的对象表达式,包含要注入的属性
 * 3. 否则,合并到现有 props 中 (当前简化版本未实现)
 * 
 * @example
 * ```typescript
 * // 输入 node:
 * // { type: VNODE_CALL, tag: '"div"', props: null, children: [...] }
 * 
 * // prop:
 * // { type: JS_PROPERTY, key: 'key', value: '0' }
 * 
 * // 输出:
 * // { type: VNODE_CALL, tag: '"div"', props: { key: 0 }, children: [...] }
 * ```
 */
export function injextProp(node: any, prop: any) {
  let propsWithInjection
  
  // 确定 props 的位置
  let props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.arguments[2]
  
  // 如果 props 为空或是字符串类型,创建新的对象
  if (props == null || isString(props.type)) {
    propsWithInjection = createObjectExpression([prop])
  }
  
  // TODO: 应该处理 props 已存在的情况,合并属性
  // 当前简化版本直接替换
  node.props = propsWithInjection
}
