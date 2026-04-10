import { isOn } from '@vue/shared'
export const patchProp = (
  el: Element,
  key: string,
  prevValue: any,
  nextValue: any
) => {
  if (key === 'class') {
  } else if (key === 'style') {
  } else if (isOn(key)) {
  } else {
    //   否则，设置element的属性
    el.setAttribute(key, nextValue)
  }
}
