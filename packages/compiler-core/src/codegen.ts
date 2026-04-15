import { helperNameMap, CREATE_ELEMENT_VNODE } from './runtimeHelpers'
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
  const { push, helper, newline, indent, deindent } = context
  genFunctionPreamble(context)
  const functionName = 'render'
  const args = ['_ctx', '_cache']
  const signature = args.join(', ')
  push(`function ${functionName}(${signature}) {`)
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
    case NodeTypes.ELEMENT:
      genElement(node, context)
      break
    case NodeTypes.VNODE_CALL:
      genVNodeCall(node, context)
      break
  }
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
  push(`${helper(node.content.content)}`) // 引入aliasHelper
}
// genExpression
function genExpression(node: any, context: any) {
  const { push } = context
  push(`${node.content}`) // 引入aliasHelper
}
// genElement
function genElement(node: any, context: any) {
  // Element节点在codegen阶段应该已经被转换为VNodeCall
  // 这里留空或抛出错误
}
