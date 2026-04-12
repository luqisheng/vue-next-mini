import {LifecycleHooks} from './lifecycle'
export const createHook=(lifecycle:LifecycleHooks)=>{
  return (hook:any,target:any)=>{
    injectHook(lifecycle,hook,target)
  }
}

export const injectHook=(type:LifecycleHooks,hook:Function,target:any)=>{
  if (target) {
    target[type] = hook
    return hook
  }
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
