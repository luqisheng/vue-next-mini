import { NodeTypes } from '../ast'
import { isText } from '../utils'

// 作用：将相邻的文本节点进行合并为一个表达式
export const transformText = (node: any, compile: any) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.IF_BRANCH ||
    node.type === NodeTypes.FOR
  ) {
    return () => {
      const children = node.children
      let currentContainer: any = null
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                )
              }
              currentContainer.children.push(' + ', next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }
    }
  }
}

// createCompoundExpression
export function createCompoundExpression(children: any, loc: any) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    children,
    loc
  }
}
