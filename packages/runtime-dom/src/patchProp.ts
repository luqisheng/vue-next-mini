import { isOn } from '@vue/shared'
import { patchClass } from '../modules/class'
import { patchStyle } from '../modules/style'
import { patchDomProp } from '../modules/props'
import { patchAttr } from '../modules/attrs'
import { patchEvent } from '../modules/events'

export const patchProp = (
  el: Element,
  key: string,
  prevValue: any,
  nextValue: any
) => {
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {
    patchStyle(el, nextValue, prevValue)
  } else if (isOn(key)) {
    // 处理事件
    patchEvent(el, key, prevValue, nextValue)
  } else if (shouldSetAsProp(el, key)) {
    patchDomProp(el, key, nextValue)
  } else {
    //   否则，设置element的属性
    patchAttr(el, key, nextValue)
  }
}
function shouldSetAsProp(el: Element, key: string) {
  if (key === 'form') {
    return false
  }
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }
  if (
    key === 'type' &&
    el.tagName === 'TEXTAREA' &&
    el.getAttribute(key) === 'text'
  ) {
    return false
  }
  return key in el
}
