import { baseParse } from 'packages/compiler-core/src/parse'
import { transform } from 'packages/compiler-core/src/transform'
import { extend } from 'packages/shared/src/index'
import { transformElement } from 'packages/compiler-core/src/transforms/transformElement'
import { transformText } from 'packages/compiler-core/src/transforms/transformText'
import { generate } from 'packages/compiler-core/src/codegen'
export function baseCompile(template: string, options: any = {}) {
  const ast = baseParse(template)
  console.log(JSON.stringify(ast))
  transform(
    ast,
    extend(options, { nodeTransforms: [transformElement, transformText] })
  )
  console.log(ast)
  return generate(ast)
}
