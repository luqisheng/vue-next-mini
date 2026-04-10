import { VNode, createVNode,isVNode } from './vnode'
import { isObject,isArray } from '@vue/shared'
export function h(type: any, props?: any, children?: any): VNode {
  const l = arguments.length
  if (l === 2) {
    if (isObject(props)&&!isArray(props)) {
        if (isVNode(props)) {
            return createVNode(type, null, [props])
        }
        return createVNode(type, props)
    }else{
        return createVNode(type, null, props)
    }
  }else{
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, props, children)
  }
}
