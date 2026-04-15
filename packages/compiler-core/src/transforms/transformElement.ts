import { NodeTypes } from '../ast'
import { createVNodeCall } from '../ast'

export const transformElement = (node: any, context: any) => {
  return function postTransformElement(node: any) {
    node = context.currentNode
    if (node.type !== NodeTypes.ELEMENT) return
    const { tag } = node
    let vnodeTag = `"${tag}"`
    let vnodeProps: any = []
    let vnodeChildren = node.children
    node.codegenChildren = node.children
    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren
    )
  }
}
