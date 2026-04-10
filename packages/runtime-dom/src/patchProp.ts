import { isOn } from '@vue/shared'
import { patchClass } from '../modules/class'
import { patchStyle } from '../modules/style'

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
    // TODO: 处理事件
  } else {
    //   否则，设置element的属性
    el.setAttribute(key, nextValue)
  }
}
