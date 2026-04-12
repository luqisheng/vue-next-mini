import { isString, isObject, isArray } from '@vue/shared'
import { normalizeClass, normalizeStyle } from './normalizeProp'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'
// VNode types
export const Text = Symbol.for('Text')
export const Fragment = Symbol.for('Fragment')
export const ELEMENT = Symbol.for('Element')

export interface VNode {
  __v_isVNode: true
  el: any
  type: any
  props: any
  children: any
  shapeFlag: number
  key?: any
  component?: any
}

export function createVNode(type: any, props?: any, children?: any): VNode {
  console.log('createVNode', type, props, children)
  if (props) {
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (style && !isString(style)) {
      props.style = normalizeStyle(style)
    }
  }
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0

  return createBaseVNode(type, props, children, shapeFlag)
}

function createBaseVNode(
  type: any,
  props?: any,
  children?: any,
  shapeFlag: number = 0
): VNode {
  const vnode: VNode = {
    __v_isVNode: true,
    el: null,
    type,
    props,
    children,
    shapeFlag,
    key: props?.key || null
  }
  normalizeChildren(vnode, children)
  return vnode
}
// normalize children
function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  // const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    type = ShapeFlags.SLOTS_CHILDREN
  } else if (isString(children)) {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }
  vnode.children = children
  vnode.shapeFlag |= type
}
export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}
// isSameVNodeType
export function isSameVNodeType(n1: VNode, n2: VNode) {
  return n1.type === n2.type && n1.key === n2.key
}
