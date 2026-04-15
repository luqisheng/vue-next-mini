import {
  helperNameMap,
  CREATE_ELEMENT_VNODE,
  TO_DISPLAY_STRING
} from './runtimeHelpers'
import { NodeTypes } from './ast'
import { isString, isArray } from '@vue/shared'

const aliasHelper = (s: symbol) => `${helperNameMap[s]}:_${helperNameMap[s]}`
function createCodegenContext(ast: any) {
  const context = {
    code: '',
    runtimeGlobalName: 'Vue',
    source: ast.loc.source,
    indextLevel: 0,
    isSSR: false,
    helper(key: any) {
      return `_${helperNameMap[key]}`
    },
    push(code: any) {
      context.code += code
    },
    newline() {
      newline(context.indextLevel)
    },
    indent() {
      newline(++context.indextLevel)
    },
    deindent() {
      newline(--context.indextLevel)
    }
  }
  function newline(n: number) {
    context.code += '\n' + `  `.repeat(n)
  }
  return context
}
export function generate(ast: any) {
  const context = createCodegenContext(ast)
  const { push, newline, indent, deindent } = context
  genFunctionPreamble(context)
  const functionName = 'render'
  const args = ['_ctx', '_cache']
  const signature = args.join(', ')
  push(`function ${functionName}(${signature}) {`)
  indent()
  push(`with (_ctx) {`)
  indent()
  const hasHelpers = ast.helpers.length > 0
  if (hasHelpers) {
    push(`const { ${ast.helpers.map(aliasHelper).join(', ')} } = _Vue`) // 引入aliasHelper
    newline()
  }
  newline()
  push(`return `)
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context)
  } else {
    push(`null`)
  }

  deindent()
  push('}')

  deindent()
  push('}')
  return {
    ast,
    code: context.code
  }
}
function genFunctionPreamble(context: any) {
  const { push, runtimeGlobalName, newline } = context
  const VueBinding = runtimeGlobalName
  push(`const _Vue = ${VueBinding}\n`)
  newline()
  push(`return `)
}
function genNode(node: any, context: any) {
  switch (node.type) {
    case NodeTypes.TEXT:
      genText(node, context)
      break
    case NodeTypes.INTERPOLATION:
      genInterpolation(node, context)
      break
    case NodeTypes.SIMPLE_EXPRESSION:
      genExpression(node, context)
      break
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context)
      break
    case NodeTypes.ELEMENT:
    case NodeTypes.IF:
      genNode(node.codegenNode, context)
      break
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
      break
    // 调用
    case NodeTypes.JS_CALL_EXPRESSION:
      genCallExpression(node, context)
      break
    // 条件
    case NodeTypes.JS_CONDITIONAL_EXPRESSION:
      genConditionalExpression(node, context)
      break
  }
}
// genCallExpression
function genCallExpression(node: any, context: any) {
  const { push, helper } = context
  const callee = isString(node.callee) ? node.callee : helper(node.callee)
  push(callee + '(')
  genNodeList(node.arguments, context)
  push(')')
}
// genConditionalExpression
function genConditionalExpression(node: any, context: any) {
  const { test, alternate, consequent, newline: needNewline } = node
  const { push, indent, deindent, newline } = context
  if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
    genExpression(test, context)
  }
  needNewline && indent()
  context.indentLevel++
  needNewline || push(' ')
  push('?')
  genNode(consequent, context)
  context.indentLevel--
  needNewline && newline()
  needNewline || push(' ')
  push(':')

  const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
  if (!isNested) {
    context.indentLevel++
  }
  genNode(alternate, context)

  if (!isNested) {
    context.indentLevel--
  }
  needNewline && deindent()
}

// genText
function genText(node: any, context: any) {
  const { push } = context
  push(JSON.stringify(node.content), node)
}
// genVNodeCall
function genVNodeCall(node: any, context: any) {
  const { push, helper } = context
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

  // 使用正确的helper：CREATE_ELEMENT_VNODE
  push(`${helper(CREATE_ELEMENT_VNODE)}` + `(`)
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
  genNodeList(args, context)
  push(`)`)
}
function genNullableArgs(args: any[]) {
  let i = args.length
  while (i--) {
    if (args[i] != null) {
      break
    }
  }
  return args.slice(0, i + 1).map((arg: any) => arg || `null`)
}

// genNodeList
function genNodeList(nodes: any, context: any) {
  const { push } = context
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (isString(node)) {
      push(node)
    } else if (isArray(node)) {
      genNodeListAsArray(node, context)
    } else {
      genNode(node, context)
    }
    if (i < nodes.length - 1) {
      push(', ')
    }
  }
}
// genNodeListAsArray
function genNodeListAsArray(nodes: any, context: any) {
  const { push } = context
  push(`[`) // 引入aliasHelper
  genNodeList(nodes, context)
  push(`]`) // 引入aliasHelper
}
// genInterpolation
function genInterpolation(node: any, context: any) {
  const { push, helper } = context
  push(`${helper(TO_DISPLAY_STRING)}(`) // 引入aliasHelper
  genNode(node.content, context)
  push(')')
}
// genExpression
function genExpression(node: any, context: any) {
  const { push } = context
  const { content, isStatic } = node
  push(isStatic ? JSON.stringify(content) : content)
}
// genCompoundExpression
function genCompoundExpression(node: any, context: any) {
  const { push } = context
  const children = node.children
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isString(child)) {
      push(child)
    } else {
      genNode(child, context)
    }
  }
}
