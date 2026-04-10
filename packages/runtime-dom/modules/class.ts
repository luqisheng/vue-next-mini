import { isString, isArray, isObject } from '../../shared/src/index'

// 标准化 class 值，支持字符串、对象、数组
function normalizeClass(value: any): string {
  if (isString(value)) {
    return value
  }
  
  if (isObject(value)) {
    // 对象格式：{ className: boolean }
    let result = ''
    for (const key in value) {
      if (value[key]) {
        result += (result ? ' ' : '') + key
      }
    }
    return result
  }
  
  if (isArray(value)) {
    // 数组格式：['class1', 'class2']
    return value.map(normalizeClass).filter(Boolean).join(' ')
  }
  
  return String(value || '')
}

export function patchClass(el: Element, value: string | object | Array<any> | null) {
  const normalizedValue = normalizeClass(value)
  
  if (normalizedValue) {
    el.className = normalizedValue
    el.setAttribute('class', normalizedValue)
  } else {
    el.className = ''
    el.removeAttribute('class')
  }
}
