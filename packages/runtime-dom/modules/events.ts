// patchEvent
export function patchEvent(
  el: Element & { _vei?: Object },
  rawName: string,
  prevValue: any,
  nextValue: any
) {
  // 获取当前事件处理函数
  const invokers: any = el._vei || (el._vei = {})
  // 获取当前事件处理函数
  const existingInvoker = invokers[rawName]
  if (nextValue && existingInvoker) {
    // 存在新的事件处理函数，并且存在旧的事件处理函数
    // 更新事件处理函数
    existingInvoker.value = nextValue
  } else {
    // 否则，不存在新的事件处理函数，或者不存在旧的事件处理函数
    // 创建新的事件处理函数
    console.log('patchEvent', rawName, nextValue)
    const name = parseName(rawName)
    if (nextValue) {
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker)
    } else if (existingInvoker) {
      el.removeEventListener(name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}
function parseName(name: string) {
  let event = name.slice(2).toLowerCase()
  return event
}
function createInvoker(initiaValue: any) {
  const invoker = (e: Event) => {
    invoker.value && invoker.value(e)
  }
  invoker.value = initiaValue
  return invoker
}
