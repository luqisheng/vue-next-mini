/**
 * Vue Next Mini - 编译器主入口
 * 
 * 本文件是 compiler-core 模块的主入口函数,整合了编译的三个阶段。
 * 
 * 编译流程总览:
 * ┌──────────────┐
 * │  Template    │ (模板字符串)
 * │  "<div>...</div>"
 * └──────┬───────┘
 *        │ baseCompile()
 *        ▼
 * ┌──────────────┐
 * │  Phase 1     │ ← baseParse()
 * │   Parse      │   模板 → AST
 * └──────┬───────┘
 *        │ AST
 *        ▼
 * ┌──────────────┐
 * │  Phase 2     │ ← transform()
 * │  Transform   │   AST → 优化后的 AST
 * └──────┬───────┘
 *        │ Transformed AST
 *        ▼
 * ┌──────────────┐
 * │  Phase 3     │ ← generate()
 * │  Codegen     │   AST → render 函数
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌──────────────┐
 * │  { code,     │ (编译结果)
 * │    ast }     │
 * └──────────────┘
 * 
 * @example
 * ```typescript
 * const template = '<div id="app">{{ message }}</div>'
 * 
 * const { code, ast } = baseCompile(template)
 * 
 * console.log(code)
 * // 输出:
 * // const _Vue = Vue
 * // return function render(_ctx, _cache) {
 * //   with (_ctx) {
 * //     const { createElementVNode: _createElementVNode, toDisplayString: _toDisplayString } = _Vue
 * //     
 * //     return _createElementVNode("div", { id: "app" }, [
 * //       _toDisplayString(message)
 * //     ])
 * //   }
 * // }
 * ```
 */

import { baseParse } from 'packages/compiler-core/src/parse'
import { transform } from 'packages/compiler-core/src/transform'
import { extend } from 'packages/shared/src/index'
import { transformElement } from 'packages/compiler-core/src/transforms/transformElement'
import { transformText } from 'packages/compiler-core/src/transforms/transformText'
import { generate } from 'packages/compiler-core/src/codegen'
import { transformIf } from 'packages/compiler-core/src/transforms/vif'

/**
 * 基础编译函数
 * 
 * 这是编译器的主入口,执行完整的编译流程。
 * 
 * @param template - 模板字符串
 * @param options - 编译选项 (可选)
 * @param options.nodeTransforms - 额外的节点转换插件
 * @returns 编译结果 { code, ast }
 *   - code: 生成的 render 函数字符串
 *   - ast: 转换后的 AST (供调试和分析)
 * 
 * 编译步骤详解:
 * 
 * 1. Parse (解析阶段):
 *    - 调用 baseParse(template)
 *    - 将模板字符串解析为 AST
 *    - AST 包含节点类型、属性、子节点等信息
 * 
 * 2. Transform (转换阶段):
 *    - 调用 transform(ast, options)
 *    - 应用节点转换插件:
 *      * transformElement: 处理元素节点,生成 codegenNode
 *      * transformText: 合并相邻文本节点
 *      * transformIf: 处理 v-if 指令
 *    - 优化 AST,添加代码生成所需的信息
 * 
 * 3. Codegen (代码生成阶段):
 *    - 调用 generate(ast)
 *    - 遍历 AST,生成 JavaScript 代码
 *    - 返回 render 函数字符串
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const result = baseCompile('<div>Hello</div>')
 * console.log(result.code)
 * 
 * // 自定义转换插件
 * const result = baseCompile('<div v-if="show">Content</div>', {
 *   nodeTransforms: [
 *     transformElement,
 *     transformText,
 *     transformIf,
 *     myCustomTransform  // 自定义插件
 *   ]
 * })
 * ```
 * 
 * 默认使用的转换插件:
 * 1. transformElement: 必需,处理所有元素节点
 * 2. transformText: 优化,合并文本节点
 * 3. transformIf: 支持 v-if 指令
 * 
 * 如何扩展?
 * - 添加自定义 nodeTransforms
 * - 实现新的指令转换 (v-for, v-on 等)
 * - 添加优化插件 (静态提升、预字符串化等)
 */
export function baseCompile(template: string, options: any = {}) {
  // ========== Phase 1: Parse ==========
  // 将模板字符串解析为 AST
  const ast = baseParse(template)
  
  // ========== Phase 2: Transform ==========
  // 转换和优化 AST
  transform(
    ast,
    // 合并用户提供的选项和默认配置
    extend(options, {
      // 默认的节点转换插件
      nodeTransforms: [
        transformElement,  // 处理元素节点
        transformText,     // 合并文本节点
        transformIf        // 处理 v-if 指令
      ]
    })
  )
  
  // 调试:打印转换后的 AST
  console.log(ast)
  
  // ========== Phase 3: Codegen ==========
  // 生成 render 函数代码
  return generate(ast)
}
