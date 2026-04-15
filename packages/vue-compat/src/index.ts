import { compile } from '@vue/compiler-core'
function compileToFunctions(template: string, options?: any) {
  const { code } = compile(template, options)
  const render = new Function(code)()
  return render
}

export { compileToFunctions as compile }
