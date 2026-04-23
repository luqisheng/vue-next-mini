/**
 * Vue Next Mini - AST (抽象语法树) 节点定义
 * 
 * 本文件定义了编译器中使用的各种 AST 节点类型和创建函数。
 * AST 是编译器的核心数据结构,模板解析后会生成 AST 树。
 * 
 * 编译流程:
 * 1. Parse (解析): 模板字符串 → AST
 * 2. Transform (转换): AST → 优化后的 AST
 * 3. Codegen (代码生成): AST → render 函数字符串
 * 
 * AST 节点分类:
 * - 模板节点: ROOT, ELEMENT, TEXT, COMMENT, INTERPOLATION 等
 * - 表达式节点: SIMPLE_EXPRESSION, COMPOUND_EXPRESSION
 * - 指令节点: ATTRIBUTE, DIRECTIVE
 * - 结构节点: IF, IF_BRANCH, FOR
 * - 代码生成节点: VNODE_CALL, JS_CALL_EXPRESSION 等
 */

import { isString } from '@vue/shared'
import { CREATE_ELEMENT_VNODE } from './runtimeHelpers'

/**
 * AST 节点类型枚举
 * 
 * 定义了所有可能的 AST 节点类型,用于在编译过程中识别和处理不同类型的节点。
 * 
 * 分类说明:
 * 
 * 1. 基础模板节点:
 *    - ROOT: 根节点,整个模板的根
 *    - ELEMENT: 元素节点,如 <div>, <span>
 *    - TEXT: 文本节点,纯文本内容
 *    - COMMENT: 注释节点,<!-- comment -->
 *    - INTERPOLATION: 插值节点,{{ expression }}
 * 
 * 2. 表达式节点:
 *    - SIMPLE_EXPRESSION: 简单表达式,如变量名、字面量
 *    - COMPOUND_EXPRESSION: 复合表达式,多个表达式的组合
 * 
 * 3. 属性节点:
 *    - ATTRIBUTE: 普通属性,id="app"
 *    - DIRECTIVE: 指令,v-if, v-for, @click 等
 * 
 * 4. 结构容器节点:
 *    - IF: v-if 条件渲染
 *    - IF_BRANCH: v-if 的分支
 *    - FOR: v-for 列表渲染
 *    - TEXT_CALL: 文本调用
 * 
 * 5. 代码生成节点 (CodeGen):
 *    - VNODE_CALL: 虚拟节点调用,生成 createElementVNode
 *    - JS_CALL_EXPRESSION: JavaScript 函数调用
 *    - JS_OBJECT_EXPRESSION: JavaScript 对象表达式
 *    - JS_PROPERTY: 对象属性
 *    - JS_ARRAY_EXPRESSION: 数组表达式
 *    - JS_FUNCTION_EXPRESSION: 函数表达式
 *    - JS_CONDITIONAL_EXPRESSION: 条件表达式 (三元运算符)
 *    - JS_CACHE_EXPRESSION: 缓存表达式
 * 
 * 6. SSR 代码生成节点:
 *    - JS_BLOCK_STATEMENT: 块语句
 *    - JS_TEMPLATE_LITERAL: 模板字符串
 *    - JS_IF_STATEMENT: if 语句
 *    - JS_ASSIGNMENT_EXPRESSION: 赋值表达式
 *    - JS_SEQUENCE_EXPRESSION: 序列表达式
 *    - JS_RETURN_STATEMENT: return 语句
 */
export enum NodeTypes {
  ROOT,                    // 根节点
  ELEMENT,                 // 元素节点
  TEXT,                    // 文本节点
  COMMENT,                 // 注释节点
  SIMPLE_EXPRESSION,       // 简单表达式
  INTERPOLATION,           // 插值节点 {{ }}
  ATTRIBUTE,               // 属性节点
  DIRECTIVE,               // 指令节点
  
  // containers (容器节点)
  COMPOUND_EXPRESSION,     // 复合表达式
  IF,                      // v-if 条件
  IF_BRANCH,               // v-if 分支
  FOR,                     // v-for 循环
  TEXT_CALL,               // 文本调用
  
  // codegen (代码生成节点)
  VNODE_CALL,              // 虚拟节点调用
  JS_CALL_EXPRESSION,      // JS 函数调用
  JS_OBJECT_EXPRESSION,    // JS 对象表达式
  JS_PROPERTY,             // JS 对象属性
  JS_ARRAY_EXPRESSION,     // JS 数组表达式
  JS_FUNCTION_EXPRESSION,  // JS 函数表达式
  JS_CONDITIONAL_EXPRESSION, // JS 条件表达式
  JS_CACHE_EXPRESSION,     // JS 缓存表达式

  // ssr codegen (服务端渲染代码生成)
  JS_BLOCK_STATEMENT,      // 块语句
  JS_TEMPLATE_LITERAL,     // 模板字符串
  JS_IF_STATEMENT,         // if 语句
  JS_ASSIGNMENT_EXPRESSION, // 赋值表达式
  JS_SEQUENCE_EXPRESSION,  // 序列表达式
  JS_RETURN_STATEMENT      // return 语句
}

/**
 * 元素类型枚举
 * 
 * 用于区分不同类型的元素节点。
 */
export enum ElementTypes {
  ELEMENT,    // 普通 HTML 元素,如 div, span
  COMPONENT,  // Vue 组件
  SLOT,       // 插槽
  TEMPLATE    // template 标签
}

/**
 * 创建虚拟节点调用节点 (VNode Call)
 * 
 * 这个函数用于在代码生成阶段创建 VNODE_CALL 类型的节点,
 * 最终会被转换为 createElementVNode(...) 调用。
 * 
 * @param context - 转换上下文,用于注册 helper
 * @param tag - 标签名或组件名
 * @param props - 属性对象 (可选)
 * @param children - 子节点 (可选)
 * @returns VNODE_CALL 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createVNodeCall(context, 'div', { id: 'app' }, ['Hello'])
 * 
 * // 生成的代码
 * createElementVNode("div", { id: "app" }, ["Hello"])
 * ```
 * 
 * 工作流程:
 * 1. 如果提供了 context,注册 CREATE_ELEMENT_VNODE helper
 * 2. 返回 VNODE_CALL 节点,包含 tag, props, children
 * 3. 在 codegen 阶段,这个节点会被转换为函数调用
 */
export function createVNodeCall(
  context: any,
  tag: any,
  props?: any,
  children?: any
) {
  if (context) {
    // 注册 helper,确保在生成的代码中会导入这个函数
    context.helper(CREATE_ELEMENT_VNODE)
  }
  
  // 返回 VNODE_CALL 节点
  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props,
    children
  }
}

/**
 * 创建条件表达式节点
 * 
 * 用于生成 JavaScript 三元运算符表达式: test ? consequent : alternate
 * 主要用于 v-if/v-else 的代码生成。
 * 
 * @param test - 条件表达式
 * @param consequent - 条件为真时的表达式
 * @param alternate - 条件为假时的表达式
 * @param newlines - 是否添加换行 (默认 true)
 * @returns JS_CONDITIONAL_EXPRESSION 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createConditionalExpression(
 *   'show',           // test
 *   'createElementVNode("div")',  // consequent
 *   'null'            // alternate
 * )
 * 
 * // 生成的代码
 * show
 *   ? createElementVNode("div")
 *   : null
 * ```
 */
export function createConditionalExpression(
  test: any,
  consequent: any,
  alternate: any,
  newlines = true
) {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newlines
  }
}

/**
 * 创建函数调用表达式节点
 * 
 * 用于生成 JavaScript 函数调用: callee(arg1, arg2, ...)
 * 
 * @param callee - 被调用的函数 (可以是字符串或 symbol)
 * @param args - 参数列表 (可选,默认为空数组)
 * @returns JS_CALL_EXPRESSION 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createCallExpression('console.log', ['"Hello"'])
 * 
 * // 生成的代码
 * console.log("Hello")
 * ```
 */
export function createCallExpression(callee: any, args: any = []) {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc: {},           // 位置信息 (当前简化版本为空)
    callee,            // 被调用的函数
    arguments: args    // 参数列表
  }
}

/**
 * 创建对象表达式节点
 * 
 * 用于生成 JavaScript 对象: { prop1: value1, prop2: value2 }
 * 主要用于元素属性的代码生成。
 * 
 * @param properties - 属性列表 (可选,默认为空数组)
 * @returns JS_OBJECT_EXPRESSION 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createObjectExpression([
 *   createObjectProperty('id', createSimpleExpression('app', true)),
 *   createObjectProperty('class', createSimpleExpression('container', true))
 * ])
 * 
 * // 生成的代码
 * { id: "app", class: "container" }
 * ```
 */
export function createObjectExpression(properties: any = []) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc: {},
    properties
  }
}

/**
 * 创建简单表达式节点
 * 
 * 这是最常用的表达式节点类型,用于表示简单的标识符、字面量等。
 * 
 * @param content - 表达式内容 (字符串)
 * @param isStatic - 是否为静态表达式
 *   - true: 静态内容,不会被响应式追踪,生成时会被 JSON.stringify
 *   - false: 动态内容,需要响应式追踪,直接输出
 * @returns SIMPLE_EXPRESSION 节点
 * 
 * @example
 * ```typescript
 * // 静态表达式
 * createSimpleExpression('app', true)
 * // 生成: "app" (带引号)
 * 
 * // 动态表达式
 * createSimpleExpression('count', false)
 * // 生成: count (不带引号,会从 _ctx 中获取)
 * ```
 * 
 * 为什么需要 isStatic 标记?
 * - 静态内容可以直接序列化,不需要从上下文中查找
 * - 动态内容需要从 _ctx 中获取,支持响应式更新
 * - 性能优化:静态内容可以缓存和提升
 */
// createSimpleExpression
export function createSimpleExpression(content: any, isStatic: boolean) {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc: {},           // 位置信息
    isStatic,          // 是否静态
    content            // 表达式内容
  }
}

/**
 * 创建对象属性节点
 * 
 * 用于生成对象的键值对: key: value
 * 是 createObjectExpression 的子节点。
 * 
 * @param key - 属性名 (可以是字符串或表达式节点)
 * @param value - 属性值 (表达式节点)
 * @returns JS_PROPERTY 节点
 * 
 * @example
 * ```typescript
 * // 输入
 * createObjectProperty('id', createSimpleExpression('app', true))
 * 
 * // 生成的代码
 * id: "app"
 * ```
 * 
 * 处理逻辑:
 * - 如果 key 是字符串,自动转换为静态的 SIMPLE_EXPRESSION
 * - 如果 key 已经是表达式节点,直接使用
 * - value 保持原样,由调用者决定类型
 */
export function createObjectProperty(key: any, value: any) {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc: {},
    // 如果 key 是字符串,转换为静态表达式;否则直接使用
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value
  }
}
