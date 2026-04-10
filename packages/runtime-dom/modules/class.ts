import { isString } from 'packages/shared/src/index'
export function patchClass(el: Element, value: string | null){
    if (value == null) value = ''
    el.className = value
    if (isString(value) && value) el.setAttribute('class', value)
        else el.removeAttribute('class')
    console.log('patchClass', value)
    return
}