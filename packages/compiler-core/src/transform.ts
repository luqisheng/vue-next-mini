import { isString,isArray } from '@vue/shared'
import { NodeTypes } from './ast'
import { isSingleElementRoot } from './hoistStatic'
import { TO_DISPLAY_STRING } from './runtimeHelpers'

export interface TransformContext {
  root: any
  parent: ParentNode | null
  childIndex: number
  currentNode: any
  helpers: Map<symbol, number>
  helper<T extends symbol>(name: T): T
  nodeTransforms: any[]
  replaceNode(node: any): void
}
export function createTransformContext(root: any, { nodeTransforms = [] }) {
  const context: TransformContext = {
    root,
    parent: null,
    childIndex: 0,
    currentNode: root,
    helpers: new Map(),
    helper(name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    },
    nodeTransforms,
    replaceNode(node) {
      context.parent!.children[context.childIndex] = context.currentNode = node
    }
  }
  return context
}
export function transform(root: any, options: any) {
  const context = createTransformContext(root, options)
  traverseNode(root, context)
  createRootCodegen(root)
  root.helpers = [...context.helpers.keys()]
  root.components = []
  root.directives = []
  root.imports = []
  root.hoists = []
  root.temps = []
  root.cached = []
}

// 深度优先
export function traverseNode(node: any, context: TransformContext) {
  const { nodeTransforms } = context
  context.currentNode = node
  const exitFns:any = []
  for (let i = 0; i < nodeTransforms.length; i++) {
    const transform = nodeTransforms[i]
    const onExit = transform(node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.currentNode) {
      return
    }else{
      node = context.currentNode
    }
  }

  switch (node.type) {
    case NodeTypes.IF_BRANCH:
      break
    case NodeTypes.ELEMENT:
      traverseChildren(node, context)
      break
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING)
      break
    case NodeTypes.IF:
      for (let index = 0; index < node.branches.length; index++) {
        traverseNode(node.branches[index], context)
      }
      break
    default:
      break
  }
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}

export function traverseChildren(parent: any, context: TransformContext) {
  parent.children.forEach((node: any, index: number) => {
    context.parent = parent
    context.childIndex = index
    traverseNode(node, context)
  })
}

function createRootCodegen(root: any) {
  const { children } = root
  // 根节点只有一个子节点
  if (children.length === 1) {
    const child = children[0]
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      // 将子节点的codegenNode赋值给根节点
      root.codegenNode = child.codegenNode
      return child.codegenNode
    }
  }
  // todo:根节点有多个子节点
  // return root.codegenNode = context.helper(CREATE_VNODE)(
  //     undefined,
  //     root.children
  // )
}

export function createStructuralDirectiveTransform(
  name: string | RegExp,
  fn: any
) {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)
  return (node: any, context: any) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          props.splice(i, 1)
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
    }
  }
}
