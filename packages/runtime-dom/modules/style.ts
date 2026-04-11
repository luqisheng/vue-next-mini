import { isString, isArray } from '../../shared/src/index'

export function patchStyle(el: Element, prev: any, next: any) {
  const style = (el as HTMLElement).style
  const isCssString = isString(next)
  if (next && !isCssString) {
    for (const key in next) {
      setStyle(style, key, next[key])
    }
    if (prev && !isString(prev)) {
      for (const key in prev) {
        if (next[key] == null) {
          setStyle(style, key, '')
        }
      }
    }
  } else {
    style.cssText = prev
  }
}
function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) {
  ;(style as any)[name] = isArray(val) ? val.join(' ') : val
}
