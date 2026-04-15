import { baseParse } from 'packages/compiler-core/src/parse'
import { transform } from 'packages/compiler-core/src/transform'
import { extend } from 'packages/shared/src/index'
import { transformElement } from 'packages/compiler-core/src/transforms/transformElement'
import { transformText } from 'packages/compiler-core/src/transforms/transformText'
import { generate } from 'packages/compiler-core/src/codegen'
import { transformIf } from 'packages/compiler-core/src/transforms/vif'
export function baseCompile(template: string, options: any = {}) {
  const ast = baseParse(template)
  transform(
    ast,
    extend(options, {
      nodeTransforms: [transformElement, transformText, transformIf]
    })
  )
  console.log(ast)
  return generate(ast)
}
