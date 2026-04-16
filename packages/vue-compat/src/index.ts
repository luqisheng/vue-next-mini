import { compile } from '@vue/compiler-core'
import { registerRuntimeCompiler } from 'packages/runtime-core/src/component'
function compileToFunctions(template: string, options?: any) {
  const { code } = compile(template, options)
  const render = new Function(code)()
  return render
}
registerRuntimeCompiler(compileToFunctions)

export { compileToFunctions as compile }
