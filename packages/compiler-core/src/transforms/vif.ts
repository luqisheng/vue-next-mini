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

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node: any, dir: any, context: any) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      let key = 0
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            key++,
            context
          )
        } else {
          let parentCondition = ifNode.codegenNode
          while (
            parentCondition.alternate.type ===
            NodeTypes.JS_CONDITIONAL_EXPRESSION
          ) {
            parentCondition = parentCondition.alternate
          }
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
export function processIf(
  node: any,
  dir: any,
  context: TransformContext,
  processCodegen?: (node: any, branch: any, isRoot: boolean) => () => void
) {
  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode = {
      type: NodeTypes.IF,
      loc: {},
      branches: [branch]
    }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  }
}

function createIfBranch(node: any, dir: any) {
  return {
    type: NodeTypes.IF_BRANCH,
    loc: {},
    condition: dir.exp,
    children: [node]
  }
}

// createCodegenNodeForBranch
function createCodegenNodeForBranch(
  branch: any,
  keyIndex: number,
  context: TransformContext
) {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex),
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true'])
    )
  }else{
    return createChildrenCodegenNode(branch, keyIndex)
  }
}

function createChildrenCodegenNode(branch: any, keyIndex: number) {
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false)
  )
  const { children } = branch
  const firstChild = children[0]
  const ret = firstChild.codegenNode
  const vnodeCall = getMemoedVNodeCall(ret)
  injextProp(vnodeCall, keyProperty)
}
export function injextProp(node: any, prop: any) {
  let propsWithInjection
  let props =
    node.type === NodeTypes.VNODE_CALL ? node.props : node.arguments[2]
  if (props == null || isString(props.type)) {
    propsWithInjection = createObjectExpression([prop])
  }
  node.props = propsWithInjection
}
