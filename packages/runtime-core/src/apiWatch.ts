import { EMPTY_OBJ,hasChanged,isObject } from '@vue/shared'
import { isReactive, ReactiveEffect } from '@vue/reactivity'
import { queuePreFlushCb } from './scheduler'
export interface WatchOptions<Immediate = boolean> {
  immediate?: Immediate
  deep?: boolean
}
export function watch(source: any, cb: Function, options?: WatchOptions) {
  return doWatch(source, cb, options)
}

function doWatch(
  source: any,
  cb: Function,
  { immediate, deep }: WatchOptions = EMPTY_OBJ
) {
  let getter: () => any
  if (isReactive(source)) {
    getter = () => source
    deep = true
  } else {
    getter = () => {}
  }
  if (cb && deep) {
    // TODO: deep watch
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }
  
  let oldValue: any
  const job = () => {
    if (cb) {
      const newValue = effect.run()
      if (deep || hasChanged(newValue, oldValue)) {
        cb(newValue, oldValue)
        oldValue = newValue
      }
    }
  }
  
  let scheduler = () => queuePreFlushCb(job)
  const effect = new ReactiveEffect(getter, scheduler)
  
  if (cb) {
    if (immediate) {
      job()
    } else {
      oldValue = effect.run()
    }
  } else {
    effect.run()
  }
  
  return () => {
    effect.stop()
  }
}

// traverse
function traverse(value: unknown, seen: Set<any> = new Set()) {
  if (!isObject(value) || seen.has(value)) {
    return value
  }
  seen.add(value)
  
  for (const key in value as object) {
    traverse((value as any)[key], seen)
  }
  return value
}
