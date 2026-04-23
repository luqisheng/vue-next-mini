/**
 * Vue Next Mini - 代码生成器 (Codegen)
 * 
 * 本文件实现了编译器的第三阶段: Codegen (代码生成)。
 * 
 * 核心功能:
 * 将转换后的 AST 树转换为可执行的 JavaScript render 函数字符串。
 * 
 * 编译流程回顾:
 * 1. Parse:   模板字符串 → AST
 * 2. Transform: AST → 优化后的 AST (添加 codegenNode)
 * 3. Codegen: AST → render 函数字符串 ← 本阶段
 * 
 * 生成示例:
 * ```
 * 模板: <div id="app">{{ message }}</div>
 * 
 * 生成的 render 函数:
 * function render(_ctx, _cache) {
 *   with (_ctx) {
 *     const { createElementVNode: _createElementVNode, toDisplayString: _toDisplayString } = Vue
 *     
 *     return _createElementVNode("div", { id: "app" }, [
 *       _toDisplayString(message)
 *     ])
 *   }
 * }
 * ```
 * 
 * 代码生成策略:
 * - 递归遍历 AST 节点
 * - 根据节点类型生成对应的 JavaScript 代码
 * - 使用 helper 函数简化生成的代码
 * - 支持缩进和换行,生成可读性好的代码
 */

import {
  helperNameMap,
  CREATE_ELEMENT_VNODE,
  TO_DISPLAY_STRING
} from './runtimeHelpers'
import { NodeTypes } from './ast'
import { isString, isArray } from '@vue/shared'

/**
 * helper 别名生成函数
 * 
 * 将 helper symbol 转换为代码中的别名形式。
 * 
 * @param s - helper symbol
 * @returns 别名字符串,如 "createElementVNode:_createElementVNode"
 * 
 * @example
 * ```typescript
 * aliasHelper(CREATE_ELEMENT_VNODE)
 * // 返回: "createElementVNode:_createElementVNode"
 * 
 * // 在代码中使用:
 * // const { createElementVNode: _createElementVNode } = Vue
 * ```
 * 
 * 为什么需要别名?
 * - 原始名称太长,使用简短的别名 (_createElementVNode)
 * - 避免与用户变量名冲突
 * - 符合 Vue 内部命名规范
 */
const aliasHelper = (s: symbol) => `${helperNameMap[s]}:_${helperNameMap[s]}`

/**
 * 创建代码生成上下文
 * 
 * 维护代码生成过程中的状态,包括生成的代码字符串、缩进级别等。
 * 
 * @param ast - AST 根节点
 * @returns CodegenContext 实例
 * 
 * 上下文属性说明:
 * - code: 累积生成的代码字符串
 * - runtimeGlobalName: 运行时全局对象名称 (默认 'Vue')
 * - source: 原始模板源码
 * - indextLevel: 当前缩进级别
 * - isSSR: 是否为服务端渲染模式
 * 
 * 上下文方法说明:
 * - helper(key): 获取 helper 函数的别名
 * - push(code): 追加代码字符串
 * - newline(): 添加换行
 * - indent(): 增加缩进
 * - deindent(): 减少缩进
 */
function createCodegenContext(ast: any) {
  const context = {
    code: '',                      // 生成的代码
    runtimeGlobalName: 'Vue',      // 运行时全局对象
    source: ast.loc.source,        // 原始模板
    indextLevel: 0,                // 缩进级别
    
    isSSR: false,                  // 是否 SSR 模式
    
    /**
     * 获取 helper 函数的别名
     * 
     * @param key - helper symbol
     * @returns 带下划线前缀的别名,如 "_createElementVNode"
     * 
     * @example
     * helper(CREATE_ELEMENT_VNODE)
     * // 返回: "_createElementVNode"
     */
    helper(key: any) {
      return `_${helperNameMap[key]}`
    },
    
    /**
     * 追加代码字符串
     * 
     * @param code - 要追加的代码
     */
    push(code: any) {
      context.code += code
    },
    
    /**
     * 添加换行 (带当前缩进)
     */
    newline() {
      newline(context.indextLevel)
    },
    
    /**
     * 增加缩进级别
     */
    indent() {
      newline(++context.indextLevel)
    },
    
    /**
     * 减少缩进级别
     */
    deindent() {
      newline(--context.indextLevel)
    }
  }
  
  /**
   * 添加换行和缩进
   * 
   * @param n - 缩进级别
   * 
   * @example
   * newline(2)
   * // 添加: "\n  " (换行 + 2个双空格)
   */
  function newline(n: number) {
    // 每个缩进级别是 2 个空格
    context.code += '\n' + `  `.repeat(n)
  }
  
  return context
}

/**
 * 代码生成的主入口函数
 * 
 * 将 AST 转换为完整的 render 函数字符串。
 * 
 * @param ast - 转换后的 AST 根节点
 * @returns { ast, code } 包含 AST 和生成的代码
 * 
 * 生成的代码结构:
 * ```javascript
 * const _Vue = Vue
 * 
 * return function render(_ctx, _cache) {
 *   with (_ctx) {
 *     const { createElementVNode: _createElementVNode } = _Vue
 *     
 *     return _createElementVNode(...)
 *   }
 * }
 * ```
 * 
 * 工作流程:
 * 1. 创建代码生成上下文
 * 2. 生成函数前置代码 (const _Vue = Vue)
 * 3. 生成函数签名 (function render(_ctx, _cache))
 * 4. 生成 with 语句
 * 5. 生成 helper 导入
 * 6. 生成 return 语句和主体代码
 * 7. 闭合括号
 * 
 * @example
 * ```typescript
 * const ast = baseParse('<div>hello</div>')
 * transform(ast, { nodeTransforms: [transformElement] })
 * 
 * const { code } = generate(ast)
 * console.log(code)
 * // 输出完整的 render 函数字符串
 * ```
 */
export function generate(ast: any) {
  // 创建代码生成上下文
  const context = createCodegenContext(ast)
  
  // 解构常用方法,方便调用
  const { push, newline, indent, deindent } = context
  
  // 生成函数前置代码
  genFunctionPreamble(context)
  
  // 函数名
  const functionName = 'render'
  
  // 函数参数
  const args = ['_ctx', '_cache']
  const signature = args.join(', ')
  
  // 生成函数声明: function render(_ctx, _cache) {
  push(`function ${functionName}(${signature}) {`)
  indent()
  
  // 生成 with 语句: with (_ctx) {
  push(`with (_ctx) {`)
  indent()
  
  // 检查是否有使用的 helpers
  const hasHelpers = ast.helpers.length > 0
  
  if (hasHelpers) {
    // 生成 helper 解构赋值
    // const { createElementVNode: _createElementVNode } = _Vue
    push(`const { ${ast.helpers.map(aliasHelper).join(', ')} } = _Vue`)
    newline()
  }
  
  newline()
  
  // 生成 return 语句
  push(`return `)
  
  // 生成主体代码
  if (ast.codegenNode) {
    // 如果有 codegenNode,递归生成代码
    genNode(ast.codegenNode, context)
  } else {
    // 否则返回 null
    push(`null`)
  }

  // 闭合 with 语句
  deindent()
  push('}')

  // 闭合函数
  deindent()
  push('}')
  
  // 返回生成的结果
  return {
    ast,      // AST (供调试)
    code: context.code  // 生成的代码字符串
  }
}

/**
 * 生成函数前置代码
 * 
 * 生成 render 函数之前的初始化代码。
 * 
 * @param context - 代码生成上下文
 * 
 * 生成的代码:
 * ```javascript
 * const _Vue = Vue
 * 
 * return 
 * ```
 * 
 * 为什么需要 _Vue?
 * - 在 with 语句中,直接引用 Vue 可能被 _ctx 中的变量覆盖
 * - 使用 _Vue 确保始终指向全局 Vue 对象
 * - 用于解构 helper 函数
 */
function genFunctionPreamble(context: any) {
  const { push, runtimeGlobalName, newline } = context
  
  // 使用配置的全局对象名称 (默认 'Vue')
  const VueBinding = runtimeGlobalName
  
  // 生成: const _Vue = Vue
  push(`const _Vue = ${VueBinding}\n`)
  
  // 添加换行
  newline()
  
  // 生成: return (后面会接函数表达式)
  push(`return `)
}

/**
 * 递归生成节点代码
 * 
 * 这是代码生成的核心函数,根据节点类型分发到不同的生成函数。
 * 
 * @param node - AST 节点
 * @param context - 代码生成上下文
 * 
 * 支持的节点类型:
 * - TEXT: 文本节点
 * - INTERPOLATION: 插值节点 {{ }}
 * - SIMPLE_EXPRESSION: 简单表达式
 * - COMPOUND_EXPRESSION: 复合表达式
 * - ELEMENT / IF: 元素或条件节点 (递归生成 codegenNode)
 * - VNODE_CALL: 虚拟节点调用
 * - JS_CALL_EXPRESSION: JS 函数调用
 * - JS_CONDITIONAL_EXPRESSION: 条件表达式
 * 
 * 工作流程:
 * 1. 根据 node.type 判断节点类型
 * 2. 调用对应的 genXxx 函数
 * 3. genXxx 函数递归调用 genNode 处理子节点
 * 
 * @example
 * ```typescript
 * // VNODE_CALL 节点
 * genNode({
 *   type: NodeTypes.VNODE_CALL,
 *   tag: 'div',
 *   props: {...},
 *   children: [...]
 * }, context)
 * 
 * // → 调用 genVNodeCall
 * // → 生成: _createElementVNode("div", {...}, [...])
 * ```
 */
function genNode(node: any, context: any) {
  switch (node.type) {
    case NodeTypes.TEXT:
      // 文本节点: "hello"
      genText(node, context)
      break
      
    case NodeTypes.INTERPOLATION:
      // 插值节点: _toDisplayString(message)
      genInterpolation(node, context)
      break
      
    case NodeTypes.SIMPLE_EXPRESSION:
      // 简单表达式: count 或 "static"
      genExpression(node, context)
      break
      
    case NodeTypes.COMPOUND_EXPRESSION:
      // 复合表达式: 多个部分的组合
      genCompoundExpression(node, context)
      break
      
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
      // 元素或条件节点:递归生成 codegenNode
      genNode(node.codegenNode, context)
      break
      
    case NodeTypes.VNODE_CALL:
      // 虚拟节点调用: _createElementVNode(...)
      genVNodeCall(node, context)
      break
      
    // 调用表达式
    case NodeTypes.JS_CALL_EXPRESSION:
      // JS 函数调用: callee(args)
      genCallExpression(node, context)
      break
      
    // 条件表达式
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      // 三元运算符: test ? consequent : alternate
      genConditionalExpression(node, context)
      break
  }
}

/**
 * 生成函数调用表达式
 * 
 * @param node - JS_CALL_EXPRESSION 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入节点
 * {
 *   type: NodeTypes.JS_CALL_EXPRESSION,
 *   callee: 'console.log',
 *   arguments: ['"Hello"']
 * }
 * 
 * // 生成的代码
 * console.log("Hello")
 * ```
 */
// genCallExpression
function genCallExpression(node: any, context: any) {
  const { push, helper } = context
  
  // 如果 callee 是字符串,直接使用;否则通过 helper 获取别名
  const callee = isString(node.callee) ? node.callee : helper(node.callee)
  
  // 生成: callee(
  push(callee + '(')
  
  // 生成参数列表
  genNodeList(node.arguments, context)
  
  // 生成: )
  push(')')
}

/**
 * 生成条件表达式 (三元运算符)
 * 
 * @param node - JS_CONDITIONAL_EXPRESSION 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入节点
 * {
 *   type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
 *   test: { type: SIMPLE_EXPRESSION, content: 'show', isStatic: false },
 *   consequent: { ... },  // v-if 分支
 *   alternate: null,       // v-else 分支
 *   newlines: true
 * }
 * 
 * // 生成的代码 (newlines = true)
 * show
 *   ? createElementVNode("div")
 *   : null
 * 
 * // 生成的代码 (newlines = false)
 * show ? createElementVNode("div") : null
 * ```
 * 
 * 格式化逻辑:
 * - newlines = true: 多行格式,适合复杂表达式
 * - newlines = false: 单行格式,适合简单表达式
 * - 嵌套的条件表达式不会重复增加缩进
 */
// genConditionalExpression
function genConditionalExpression(node: any, context: any) {
  const { test, alternate, consequent, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  
  // 生成条件部分
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context)
  }
  
  // 如果需要换行,增加缩进
  needNewline && indent()
  context.indentLevel++
  
  // 添加空格或换行
  needNewline || push(' ')
  
  // 生成: ?
  push('?')
  
  // 生成真值分支
  genNode(consequent, context)
  
  context.indentLevel--
  
  // 添加换行或空格
  needNewline && newline()
  needNewline || push(' ')
  
  // 生成: :
  push(':')

  // 检查是否是嵌套的条件表达式
  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  
  // 如果不是嵌套,增加缩进
  if (!isNested) {
    context.indentLevel++
  }
  
  // 生成假值分支
  genNode(alternate, context)

  // 如果不是嵌套,减少缩进
  if (!isNested) {
    context.indentLevel--
  }
  
  // 如果需要换行,减少缩进
  needNewline && deindent()
}

/**
 * 生成文本节点
 * 
 * @param node - TEXT 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入节点
 * { type: NodeTypes.TEXT, content: 'Hello World' }
 * 
 * // 生成的代码
 * "Hello World"
 * ```
 * 
 * 为什么使用 JSON.stringify?
 * - 自动处理转义字符 (\n, \t, ", ', etc.)
 * - 自动添加引号
 * - 保证生成的字符串是合法的 JavaScript
 */
// genText
function genText(node: any, context: any) {
  const { push } = context
  // 使用 JSON.stringify 确保字符串正确转义和加引号
  push(JSON.stringify(node.content), node)
}

/**
 * 生成虚拟节点调用
 * 
 * 这是最重要的代码生成函数,将 VNODE_CALL 节点转换为 createElementVNode 调用。
 * 
 * @param node - VNODE_CALL 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入节点
 * {
 *   type: NodeTypes.VNODE_CALL,
 *   tag: 'div',
 *   props: { type: JS_OBJECT_EXPRESSION, properties: [...] },
 *   children: [...]
 * }
 * 
 * // 生成的代码
 * _createElementVNode("div", { id: "app" }, [...])
 * ```
 * 
 * 参数说明:
 * - tag: 标签名或组件名
 * - props: 属性对象 (可选)
 * - children: 子节点数组 (可选)
 * - patchFlag: 补丁标志 (优化提示,当前版本未使用)
 * - dynamicProps: 动态属性列表 (优化提示,当前版本未使用)
 * - directives: 指令列表 (当前版本未使用)
 * - isBlock: 是否为块级节点 (当前版本未使用)
 * - disableTracking: 禁用依赖追踪 (当前版本未使用)
 * - isComponent: 是否为组件 (当前版本未使用)
 */
// genVNodeCall
function genVNodeCall(node: any, context: any) {
  const { push, helper } = context
  
  // 解构节点属性
  const {
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent
  } = node

  // 生成 helper 函数名: _createElementVNode
  push(`${helper(CREATE_ELEMENT_VNODE)}` + `(`)
  
  // 生成参数列表 (过滤掉 null/undefined)
  const args = genNullableArgs([
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent
  ])
  
  // 递归生成所有参数
  genNodeList(args, context)
  
  // 闭合括号
  push(`)`)
}

/**
 * 过滤空参数并替换为 null
 * 
 * 从后向前查找第一个非空参数,然后截取数组。
 * 将中间的 null/undefined 显式替换为 'null' 字符串。
 * 
 * @param args - 参数数组
 * @returns 过滤后的参数数组
 * 
 * @example
 * ```typescript
 * genNullableArgs(['div', undefined, undefined])
 * // 返回: ['div']
 * 
 * genNullableArgs(['div', null, 'text'])
 * // 返回: ['div', 'null', 'text']
 * ```
 * 
 * 为什么要这样处理?
 * - 尾部连续的 null/undefined 可以省略
 * - 中间的 null 必须保留,保持参数位置对应
 * - 例如: createElementVNode(tag, null, children)
 */
function genNullableArgs(args: any[]) {
  let i = args.length
  
  // 从后向前查找第一个非空参数
  while (i--) {
    if (args[i] != null) {
      break
    }
  }
  
  // 截取数组,并将 null/undefined 替换为 'null' 字符串
  return args.slice(0, i + 1).map((arg: any) => arg || `null`)
}

/**
 * 递归生成节点列表
 * 
 * @param nodes - 节点数组
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入: [expr1, expr2, expr3]
 * // 输出: expr1, expr2, expr3
 * ```
 * 
 * 处理逻辑:
 * - 字符串:直接追加
 * - 数组:作为数组生成
 * - 节点:递归调用 genNode
 * - 节点之间用逗号分隔
 */
// genNodeList
function genNodeList(nodes: any, context: any) {
  const { push } = context
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    
    if (isString(node)) {
      // 字符串:直接追加
      push(node)
    } else if (isArray(node)) {
      // 数组:作为数组生成
      genNodeListAsArray(node, context)
    } else {
      // 节点:递归生成
      genNode(node, context)
    }
    
    // 如果不是最后一个,添加逗号和空格
    if (i < nodes.length - 1) {
      push(', ')
    }
  }
}

/**
 * 生成数组字面量
 * 
 * @param nodes - 节点数组
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入: [node1, node2]
 * // 输出: [node1, node2]
 * ```
 */
// genNodeListAsArray
function genNodeListAsArray(nodes: any, context: any) {
  const { push } = context
  
  // 生成: [
  push(`[`)
  
  // 递归生成数组元素
  genNodeList(nodes, context)
  
  // 生成: ]
  push(`]`)
}

/**
 * 生成插值节点代码
 * 
 * @param node - INTERPOLATION 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 模板: {{ message }}
 * 
 * // 输入节点
 * {
 *   type: NodeTypes.INTERPOLATION,
 *   content: {
 *     type: NodeTypes.SIMPLE_EXPRESSION,
 *     content: 'message',
 *     isStatic: false
 *   }
 * }
 * 
 * // 生成的代码
 * _toDisplayString(message)
 * ```
 * 
 * 为什么需要 toDisplayString?
 * - 将任意值转换为字符串
 * - 处理 null/undefined (转为空字符串)
 * - 处理对象 (调用 toString)
 * - 防止 XSS 攻击 (转义 HTML)
 */
// genInterpolation
function genInterpolation(node: any, context: any) {
  const { push, helper } = context
  
  // 生成: _toDisplayString(
  push(`${helper(TO_DISPLAY_STRING)}(`)
  
  // 递归生成表达式内容
  genNode(node.content, context)
  
  // 生成: )
  push(')')
}

/**
 * 生成简单表达式
 * 
 * @param node - SIMPLE_EXPRESSION 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 静态表达式
 * { content: 'app', isStatic: true }
 * // 生成: "app"
 * 
 * // 动态表达式
 * { content: 'count', isStatic: false }
 * // 生成: count
 * ```
 * 
 * 静态 vs 动态:
 * - 静态: 常量,不会被响应式追踪,需要加引号
 * - 动态: 变量,需要从 _ctx 中获取,不加引号
 */
// genExpression
function genExpression(node: any, context: any) {
  const { push } = context
  const { content, isStatic } = node
  
  // 静态内容:加引号序列化
  // 动态内容:直接输出变量名
  push(isStatic ? JSON.stringify(content) : content)
}

/**
 * 生成复合表达式
 * 
 * 复合表达式由多个部分组成,可以是字符串或节点。
 * 
 * @param node - COMPOUND_EXPRESSION 节点
 * @param context - 代码生成上下文
 * 
 * @example
 * ```typescript
 * // 输入节点
 * {
 *   type: NodeTypes.COMPOUND_EXPRESSION,
 *   children: [
 *     '"Hello "',
 *     { type: SIMPLE_EXPRESSION, content: 'name', isStatic: false },
 *     '"!"'
 *   ]
 * }
 * 
 * // 生成的代码
 * "Hello " + name + "!"
 * ```
 * 
 * 应用场景:
 * - 模板字符串拼接
 * - 复杂的表达式组合
 */
// genCompoundExpression
function genCompoundExpression(node: any, context: any) {
  const { push } = context
  const children = node.children
  
  // 依次生成所有部分
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    
    if (isString(child)) {
      // 字符串:直接追加
      push(child)
    } else {
      // 节点:递归生成
      genNode(child, context)
    }
  }
}
