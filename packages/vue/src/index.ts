import { isArray } from '@vue/shared'
export { effect, reactive, ref } from '@vue/reactivity'

let num: number = 1

console.log('react-compiler-healthcheck' + num)
console.log(isArray(num))
