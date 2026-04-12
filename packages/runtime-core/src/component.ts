import { reactive } from '@vue/reactivity'
import { isObject } from 'packages/shared/src/index'
import { onBeforeMount, onMounted } from './apiLifecycle'
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
    render: null,
    isMounted: false,
    bc: null,
    c: null,
    bm: null,
    m: null
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
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted
  } = instance.type
  if (beforeCreate) {
    callHook(beforeCreate)
  }
  if (dataOptions) {
    const data = dataOptions()
    if (isObject(data)) {
      instance.data = reactive(data)
    }
  }
  if (created) {
    callHook(created)
  }
  function registerLifecycleHook(register: Function, hook?: Function) {
    if (hook) {
      register(hook, instance)
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}
function callHook(hook: Function) {
  hook()
}
