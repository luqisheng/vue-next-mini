import { isString, isObject } from '../../shared/src/index'

export function patchStyle(el: Element, value: string | object | null, oldValue?: string | object | null) {
  const style = (el as HTMLElement).style
  
  if (!value) {
    // 清空所有样式
    style.cssText = ''
    return
  }
  
  if (isString(value)) {
    // 字符串格式：直接设置 cssText
    style.cssText = value
  } else if (isObject(value)) {
    // 对象格式：遍历设置每个样式
    for (const key in value) {
      const val = (value as any)[key]
      if (val != null) {
        style[key as any] = val
      }
    }
    
    // 如果存在旧值且也是对象，需要移除不在新值中的样式
    if (oldValue && isObject(oldValue)) {
      for (const key in oldValue) {
        if (!(key in value)) {
          style[key as any] = ''
        }
      }
    }
  }
}
