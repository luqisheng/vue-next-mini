/**
 * 属性规范化模块
 * 
 * 提供 class 和 style 属性的规范化函数，将各种格式的输入
 * 转换为标准的字符串格式，便于后续应用到 DOM 元素上。
 * 
 * Vue 支持灵活的 class 和 style 绑定格式：
 * - class: 字符串、数组、对象
 * - style: 字符串、对象（支持驼峰命名和短横线命名）
 */
import { isString, isArray, isObject } from '@vue/shared'

/**
 * 规范化 class 属性
 * 
 * 将各种格式的 class 值统一转换为空格分隔的字符串。
 * 
 * 支持的格式：
 * 1. 字符串：'active btn-primary' -> 'active btn-primary'
 * 2. 数组：['active', 'btn-primary'] -> 'active btn-primary'
 * 3. 对象：{ active: true, 'btn-primary': false } -> 'active'
 * 4. 嵌套：可以递归处理数组中的对象或字符串
 * 
 * 使用示例：
 * ```typescript
 * normalizeClass('active')                    // 'active'
 * normalizeClass(['active', 'btn'])           // 'active btn'
 * normalizeClass({ active: true })            // 'active'
 * normalizeClass([{ active: true }, 'btn'])   // 'active btn'
 * ```
 * 
 * @param value - class 值（可以是字符串、数组或对象）
 * @returns 规范化后的 class 字符串
 */
export function normalizeClass(value: unknown): string | string[] | undefined {
  console.log('normalizeClass', value)
  
  let res = ''
  
  if (isString(value)) {
    // 情况1：字符串，直接使用
    res = value
  } else if (isArray(value)) {
    // 情况2：数组，递归处理每个元素并拼接
    for (let index = 0; index < value.length; index++) {
      const normalized = normalizeClass(value[index])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    // 情况3：对象，key 为类名，value 为布尔值表示是否启用
    for (const name in value as object) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  
  // 去除首尾空格
  return res.trim()
}

/**
 * 规范化 style 属性
 * 
 * 将各种格式的 style 值统一转换为内联样式字符串。
 * 
 * 支持的格式：
 * 1. 字符串：'color: red; font-size: 14px' -> 直接返回
 * 2. 对象：{ color: 'red', fontSize: '14px' } -> 'color:red;font-size:14px'
 * 
 * 注意：对象的 key 会自动从驼峰命名转换为短横线命名
 * （如 fontSize -> font-size）
 * 
 * 使用示例：
 * ```typescript
 * normalizeStyle('color: red')                        // 'color: red'
 * normalizeStyle({ color: 'red', fontSize: '14px' })  // 'color:red;font-size:14px'
 * ```
 * 
 * @param value - style 值（可以是字符串或对象）
 * @returns 规范化后的 style 字符串
 */
export function normalizeStyle(value: unknown) {
  console.log('normalizeStyle')
  
  // 根据类型选择处理方式
  return isObject(value) 
    ? stringifyStyle(value)     // 对象格式：转换为字符串
    : isString(value) 
      ? value                   // 字符串格式：直接返回
      : ''                      // 其他格式：返回空字符串
}

/**
 * 将 style 对象转换为字符串
 * 
 * 遍历 style 对象的所有属性，将每个属性转换为 "key:value" 格式，
 * 并用分号连接所有属性。
 * 
 * 关键特性：
 * 1. 自动将驼峰命名转换为短横线命名（通过 hyphenate 函数）
 * 2. 支持数组格式（递归处理）
 * 3. 支持数值类型（如 width: 100 会自动添加单位，但当前简化版未实现）
 * 
 * @param styles - style 对象或数组
 * @returns 内联样式字符串
 */
export function stringifyStyle(
  styles: Record<string, string | number | undefined>
): string {
  console.log('stringifyStyle', styles)
  
  if (isArray(styles)) {
    // 如果是数组，递归处理每个元素并用分号连接
    return styles.map(stringifyStyle).join(';')
  }
  
  // 遍历对象的所有属性
  return Object.keys(styles)
    .map(key => `${hyphenate(key)}:${styles[key]}`)  // 转换 key 并拼接值
    .join(';')  // 用分号连接所有属性
}

/**
 * 将驼峰命名转换为短横线命名
 * 
 * 这是 CSS 属性命名的标准转换函数。
 * 
 * 转换规则：
 * - 将所有大写字母替换为 "-小写字母"
 * - 例如：fontSize -> font-size, backgroundColor -> background-color
 * 
 * 实现原理：
 * 使用正则表达式 /[A-Z]/g 匹配所有大写字母，
 * 然后在每个匹配位置插入 "-" 并将字母转为小写。
 * 
 * @param str - 驼峰命名字符串
 * @returns 短横线命名字符串
 */
export function hyphenate(str: string): string {
  console.log('hyphenate')
  
  // 正则替换：在每个大写字母前插入 "-" 并转为小写
  return str.replace(/[A-Z]/g, match => '-' + match.toLowerCase())
}
