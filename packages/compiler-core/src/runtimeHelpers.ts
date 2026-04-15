export const CREATE_ELEMENT_VNODE = Symbol('createElementVNode')
export const CREATE_VNODE = Symbol('createVNode')
export const TO_DISPLAY_STRING=Symbol('toDisplayString')

// 修复：明确指定 helperNameMap 的索引签名类型为 Record<symbol, string>
export const helperNameMap: Record<symbol, string> = {
  [CREATE_ELEMENT_VNODE]: 'createElementVNode',
  [CREATE_VNODE]: 'createVNode',
  [TO_DISPLAY_STRING]:'toDisplayString'
}

