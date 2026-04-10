import { isString, isArray, isObject } from '@vue/shared'
export function normalizeClass(value: unknown): string | string[] | undefined {
  console.log('normalizeClass', value)
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const normalized = normalizeClass(value[index])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value as object) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}
// normalizeStyle
export function normalizeStyle(value: unknown) {
  console.log('normalizeStyle')
  return isObject(value) ? stringifyStyle(value) : isString(value) ? value : ''
}
// stringifyStyle
export function stringifyStyle(
  styles: Record<string, string | number | undefined>
): string {
  console.log('stringifyStyle',styles)
  if (isArray(styles)) {
    return styles.map(stringifyStyle).join(';')
  }
  return Object.keys(styles)
    .map(key => `${hyphenate(key)}:${styles[key]}`)
    .join(';')
}
// hyphenate
export function hyphenate(str: string): string {
  console.log('hyphenate')
  return str.replace(/[A-Z]/g, match => '-' + match.toLowerCase())
}
