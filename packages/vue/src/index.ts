import { isArray } from '@vue/shared'
export { reactive, effect } from '@vue/reactivity'

let num: number = 1

console.log('react-compiler-healthcheck' + num)
console.log(isArray(num))