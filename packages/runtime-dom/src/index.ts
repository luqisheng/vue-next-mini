import { createRenderer } from 'packages/runtime-core/src/renderer'
import { patchProp } from './patchProp'
import { nodeOps } from './nodeOps'
import { extend, isString } from '@vue/shared'
const rendererOptions = extend({ patchProp }, nodeOps)
let renderer: any
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
}
export const render = (...args: any) => {
  console.log('render', args)
  ensureRenderer().render(...args)
}
export const createApp = (...args: any) => {
  const app = ensureRenderer().createApp(...args)
  const { mount } = app
  app.mount = (containerOrSelector: Element|string) => {
    const container = normalizeContainer(containerOrSelector)
    if (!container) {
      return console.warn(
        `Invalid container: ${containerOrSelector}`,
      )
    }
    mount(container)
  }
  return app
}
function normalizeContainer(container: Element | string): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container)
    if (!res) {
      console.warn(`Failed to mount app: mount target selector returned null.`)
    }
    return res
  }
  return container
}
