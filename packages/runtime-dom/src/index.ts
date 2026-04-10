import { createRenderer } from 'packages/runtime-core/src/renderer'
import { patchProp } from './patchProp'
import { nodeOps } from './nodeOps'
import { extend } from '@vue/shared'
const rendererOptions = extend({ patchProp }, nodeOps)
let renderer: any
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
}
export const render = (...args: any) => {
  console.log('render', args)
  ensureRenderer().render(...args)
}
