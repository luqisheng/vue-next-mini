import { reactive } from "@vue/reactivity";
import { isObject } from "packages/shared/src/index";
let uid = 0
export function createComponentInstance(vnode: any) {
  const type = vnode.type
  const instance = {
    uid: uid++,
    vnode,
    type,
    subTree: null,
    effect: null,
    update: null,
    render: null
  }
  return instance
}

// setupComponent
export function setupComponent(instance: any) {
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: any) { 
    finishComponentSetup(instance)
}

export function finishComponentSetup(instance: any) { 
  const Component = instance.type
  instance.render = Component.render
  applyOptions(instance)
}

function applyOptions(instance: any) { 
  const {data:dataOptions} = instance.type
  if (dataOptions) {
    const data = dataOptions()
    if (isObject(data)) {
      instance.data = reactive(data)
    }
  }
}