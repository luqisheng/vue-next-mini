import { createVNode, Text } from './vnode'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'

export function renderComponentRoot(instance: any) {
  const { vnode, render, data = {} } = instance
  
  // 防御性检查：确保 render 函数存在
  if (!render) {
    console.warn(`Component is missing render function.`, instance.type)
    return createVNode(Text, null, '')
  }
  
  let result
  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      result = normalizeVNode(render.call(data, data))
    }
  } catch (error) {
    console.error('Error in render function:', error)
    return createVNode(Text, null, '')
  }
  
  // 确保返回值有效
  if (result == null) {
    console.warn('Render function returned null or undefined')
    return createVNode(Text, null, '')
  }
  
  return result
}
export function normalizeVNode(child: any) {
  if (typeof child === 'object') {
    return cloneIfMounted(child)
  } else {
    return createVNode(Text, null, String(child))
  }
}

export function cloneIfMounted(child: any) {
  return child
}
