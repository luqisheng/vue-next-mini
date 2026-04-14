import { baseParse } from "packages/compiler-core/src/parse";
export function baseCompile(template: string, options: any) {
  const ast = baseParse(template)
  // const { transform } = options || {}
  // transform(ast, options)
  console.log(ast)
  return {}
}

