/**
 * Vue Next Mini - 模板解析器 (Parser)
 * 
 * 本文件实现了编译器的第一阶段: Parse (解析)。
 * 
 * 核心功能:
 * 将模板字符串解析为抽象语法树 (AST)。
 * 
 * 解析流程:
 * ┌─────────────────┐
 * │ Template String │ (模板字符串)
 * │ "<div>...</div>"│
 * └────────┬────────┘
 *          │ baseParse()
 *          ▼
 * ┌─────────────────┐
 * │ ParserContext   │ (解析上下文,维护源码和位置)
 * └────────┬────────┘
 *          │ parseChildren()
 *          ▼
 * ┌─────────────────┐
 * │   AST Nodes     │ (递归解析子节点)
 * │                 │
 * │ • ELEMENT       │ → parseElement()
 * │ • TEXT          │ → parseText()
 * │ • INTERPOLATION │ → parseInterpolation()
 * │ • COMMENT       │ → (未实现)
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │   Root Node     │ (根节点,包含所有子节点)
 * └─────────────────┘
 * 
 * 解析策略:
 * - 递归下降解析 (Recursive Descent Parsing)
 * - 基于状态机的字符扫描
 * - 支持嵌套结构 (通过 ancestors 栈追踪)
 * 
 * @example
 * ```typescript
 * const template = '<div id="app">{{ message }}</div>'
 * const ast = baseParse(template)
 * 
 * // ast 结构:
 * {
 *   type: NodeTypes.ROOT,
 *   children: [
 *     {
 *       type: NodeTypes.ELEMENT,
 *       tag: 'div',
 *       props: [{ type: ATTRIBUTE, name: 'id', value: 'app' }],
 *       children: [
 *         {
 *           type: NodeTypes.INTERPOLATION,
 *           content: { type: SIMPLE_EXPRESSION, content: 'message' }
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

import { ElementTypes, NodeTypes } from 'packages/compiler-core/src/ast'

/**
 * 标签类型枚举
 * 
 * 用于区分开始标签和结束标签。
 */
const enum TagType {
  START,  // 开始标签,如 <div>
  END     // 结束标签,如 </div>
}

/**
 * 解析上下文接口
 * 
 * 维护解析过程中的状态信息。
 */
export interface ParserContext {
  /** 剩余待解析的源码字符串 */
  source: string
}

/**
 * 创建解析上下文
 * 
 * @param content - 模板字符串
 * @returns ParserContext 实例
 * 
 * @example
 * ```typescript
 * const context = creatParserContext('<div>Hello</div>')
 * console.log(context.source) // "<div>Hello</div>"
 * ```
 */
function creatParserContext(content: string): ParserContext {
  return {
    source: content
  }
}

/**
 * 创建根节点
 * 
 * @param children - 根节点的子节点数组
 * @returns ROOT 类型的 AST 节点
 * 
 * @example
 * ```typescript
 * const root = createRoot([elementNode1, elementNode2])
 * // { type: NodeTypes.ROOT, children: [...], loc: {} }
 * ```
 */
export function createRoot(children: any) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {}  // 位置信息 (当前简化版本为空)
  }
}

/**
 * 基础解析函数 - 编译器入口
 * 
 * 这是 Parse 阶段的主入口,负责启动整个解析流程。
 * 
 * @param content - 模板字符串
 * @returns AST 根节点
 * 
 * 工作流程:
 * 1. 创建解析上下文
 * 2. 调用 parseChildren 解析所有子节点
 * 3. 用子节点创建根节点
 * 4. 返回根节点
 * 
 * @example
 * ```typescript
 * const ast = baseParse('<div>{{ message }}</div>')
 * console.log(ast.type)        // NodeTypes.ROOT
 * console.log(ast.children)    // [ELEMENT节点]
 * ```
 */
export function baseParse(content: string) {
  // 创建解析上下文,维护源码字符串
  const context = creatParserContext(content)
  
  // 解析所有子节点 (传入空的 ancestors 栈)
  const children = parseChildren(context, [])
  
  // 用子节点创建根节点并返回
  return createRoot(children)
}

/**
 * 解析子节点列表
 * 
 * 这是解析的核心循环,不断从源码中提取节点,直到遇到结束条件。
 * 
 * @param context - 解析上下文
 * @param ancestors - 祖先节点栈 (用于检测结束标签匹配)
 * @returns 解析出的节点数组
 * 
 * 解析循环逻辑:
 * 1. 检查是否到达结束条件 (isEnd)
 * 2. 根据源码开头判断节点类型:
 *    - 以 '{{' 开头 → 插值节点
 *    - 以 '<' 开头且后跟字母 → 元素节点
 *    - 其他情况 → 文本节点
 * 3. 调用对应的解析函数
 * 4. 将节点添加到结果数组
 * 5. 重复步骤 1-4
 * 
 * 为什么需要 ancestors 栈?
 * - 追踪嵌套的元素层级
 * - 检测结束标签是否匹配
 * - 例如: <div><span></div> 能检测到错误
 * 
 * @example
 * ```typescript
 * // 模板: <div><span>text</span></div>
 * 
 * // 第一次调用: ancestors = []
 * // → 解析 div 元素
 * //   → 递归调用 parseChildren, ancestors = [div]
 * //     → 解析 span 元素
 * //       → 递归调用 parseChildren, ancestors = [div, span]
 * //         → 解析 text 文本
 * //         → 遇到 </span>, isEnd 返回 true
 * //       → 返回 [text节点]
 * //     → span.children = [text节点]
 * //     → 遇到 </div>, isEnd 返回 true
 * //   → 返回 [span节点]
 * // → div.children = [span节点]
 * ```
 */
function parseChildren(context: ParserContext, ancestors: any) {
  const nodes: any[] = []
  
  // 循环解析,直到到达结束条件
  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: any
    
    // 判断节点类型
    
    // 1. 插值节点: {{ expression }}
    if (startsWith(s, '{{')) {
      node = parseInterpolation(context)
    }
    // 2. 元素节点: <tag> 或 <tag />
    else if (startsWith(s, '<')) {
      // 检查 '<' 后面是否是字母 (排除注释 <!-- 和指令 <? 等)
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors)
      }
    }
    
    // 3. 文本节点: 普通文本内容
    if (!node) {
      node = parseText(context)
    }
    
    // 将解析出的节点添加到结果数组
    pushNode(nodes, node)
  }
  
  return nodes
}

/**
 * 解析元素节点
 * 
 * 处理完整的元素,包括开始标签、子节点和结束标签。
 * 
 * @param context - 解析上下文
 * @param ancestors - 祖先节点栈
 * @returns ELEMENT 类型的 AST 节点
 * 
 * 工作流程:
 * 1. 解析开始标签 (parseTag)
 * 2. 将当前元素压入 ancestors 栈
 * 3. 递归解析子节点 (parseChildren)
 * 4. 从 ancestors 栈弹出当前元素
 * 5. 将子节点赋值给 element.children
 * 6. 解析并验证结束标签
 * 7. 返回元素节点
 * 
 * @example
 * ```typescript
 * // 模板: <div id="app">Hello</div>
 * 
 * // 1. parseTag(START) → { tag: 'div', props: [...] }
 * // 2. ancestors.push(div)
 * // 3. parseChildren() → [TEXT节点 "Hello"]
 * // 4. ancestors.pop()
 * // 5. element.children = [TEXT节点]
 * // 6. parseTag(END) → 消耗 </div>
 * // 7. 返回完整元素节点
 * ```
 * 
 * 错误处理:
 * - 如果缺少结束标签,抛出错误
 * - 例如: <div>content (没有 </div>)
 */
// parseElement
function parseElement(context: ParserContext, ancestors: any) {
  // 解析开始标签,获取标签名和属性
  const element = parseTag(context, TagType.START)
  
  // 将当前元素压入祖先栈,用于后续的子节点解析
  ancestors.push(element)
  
  // 递归解析子节点
  // 此时 ancestors 包含当前元素,isEnd 能正确检测结束标签
  const children = parseChildren(context, ancestors)
  
  // 子节点解析完毕,从祖先栈弹出
  ancestors.pop()
  
  // 将子节点赋值给元素
  element.children = children
  
  // 检查并解析结束标签
  if (startsWithEndTagOpen(context.source, element.tag)) {
    // 结束标签匹配,消耗它
    parseTag(context, TagType.END)
  } else {
    // 结束标签不匹配或缺失,抛出错误
    throw new Error(`缺少结束标签:${element.tag}`)
  }
  
  return element
}

/**
 * 解析标签 (开始或结束)
 * 
 * 解析标签的名称、属性和自闭合标记。
 * 
 * @param context - 解析上下文
 * @param type - 标签类型 (START 或 END)
 * @returns ELEMENT 类型的 AST 节点 (仅包含标签信息,children 为空)
 * 
 * 正则表达式说明:
 * - /^<\/?([a-z][^\t\r\n\f />]*)/i
 *   - ^<\/? : 匹配 < 或 </
 *   - ([a-z][^\t\r\n\f />]*) : 捕获组,标签名
 *     - [a-z] : 首字符必须是字母
 *     - [^\t\r\n\f />]* : 后续字符不能是空白或 /> 
 *   - /i : 忽略大小写
 * 
 * 工作流程:
 * 1. 使用正则匹配标签名
 * 2. 前进指针,跳过已匹配的标签名
 * 3. 跳过空白字符
 * 4. 解析属性 (仅开始标签)
 * 5. 检查是否自闭合 (/>)
 * 6. 前进指针,跳过 > 或 />
 * 7. 返回元素节点
 * 
 * @example
 * ```typescript
 * // 开始标签: <div id="app">
 * // → tag: 'div', props: [{ name: 'id', value: 'app' }]
 * 
 * // 结束标签: </div>
 * // → tag: 'div', props: []
 * 
 * // 自闭合标签: <img />
 * // → tag: 'img', props: [], isSelfClosing: true
 * ```
 */
// parseTag
function parseTag(context: ParserContext, type: TagType) {
  const s = context.source
  
  // 使用正则匹配标签名
  const match: any = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(s)
  const tag = match[1]
  
  // 前进指针,跳过标签名 (包括 < 或 </)
  advance(context, match[0].length)
  
  // 跳过标签名后的空白字符
  // 例如: <div   id="app"> 中的空格
  advanceSpaces(context)
  
  // 解析属性和指令 (仅开始标签需要)
  let props = parseAttributes(context, type)
  
  // 检查是否自闭合标签
  // 注意: 这里检查的是当前位置是否有 '/',但实际应该在属性解析后检查
  let isSelfClosing = startsWith(s, '/')
  
  // 前进指针,跳过 '>' 或 '/>'
  advance(context, isSelfClosing ? 2 : 1)
  
  // 返回元素节点
  return {
    type: NodeTypes.ELEMENT,
    tag,                    // 标签名
    tagType: ElementTypes.ELEMENT,  // 元素类型 (普通 HTML 元素)
    children: [] as any[],  // 子节点 (稍后由 parseElement 填充)
    props                   // 属性列表
  }
}

/**
 * 跳过空白字符
 * 
 * 前进指针,跳过连续的空白字符 (空格、制表符、换行等)。
 * 
 * @param context - 解析上下文
 * 
 * 正则说明:
 * - /^[\t\r\n\f ]+/ : 匹配一个或多个空白字符
 *   - \t : 制表符
 *   - \r : 回车符
 *   - \n : 换行符
 *   - \f : 换页符
 *   - 空格
 * 
 * @example
 * ```typescript
 * // context.source = "   <div>"
 * advanceSpaces(context)
 * // context.source = "<div>"
 * ```
 */
function advanceSpaces(context: ParserContext): void {
  let s = context.source
  
  // 匹配开头的空白字符
  const match = /^[\t\r\n\f ]+/.exec(s)
  
  if (match) {
    // 如果有空白,前进相应长度
    advance(context, match[0].length)
  }
}

/**
 * 解析属性列表
 * 
 * 解析标签中的所有属性和指令,直到遇到 '>' 或 '/>' 或 '</'。
 * 
 * @param context - 解析上下文
 * @param type - 标签类型 (仅 START 标签会收集属性)
 * @returns 属性数组
 * 
 * 循环条件:
 * - 源码不为空
 * - 下一个字符不是 '>' (标签结束)
 * - 下一个字符不是 '</' (下一个元素的开始)
 * 
 * 工作流程:
 * 1. 循环解析单个属性
 * 2. 如果是开始标签,将属性加入数组
 * 3. 跳过空白字符
 * 4. 重复步骤 1-3
 * 
 * @example
 * ```typescript
 * // 标签: <div id="app" class="container" @click="handleClick">
 * 
 * // 解析出的 props:
 * [
 *   { type: ATTRIBUTE, name: 'id', value: 'app' },
 *   { type: ATTRIBUTE, name: 'class', value: 'container' },
 *   { type: DIRECTIVE, name: 'on', exp: 'click', ... }
 * ]
 * ```
 */
// parseAttributes
function parseAttributes(context: ParserContext, type: TagType) {
  const props: any[] = []
  const attributeNames: any = new Set()  // 用于检测重复属性 (当前未使用)
  
  // 循环解析属性,直到遇到标签结束
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '</')
  ) {
    // 解析单个属性
    const attr = parseAttribute(context, attributeNames)
    
    // 只有开始标签才收集属性
    if (type === TagType.START) {
      props.push(attr)
    }
    
    // 跳过属性后的空白字符
    advanceSpaces(context)
  }
  
  return props
}

/**
 * 解析单个属性或指令
 * 
 * 解析属性的名称和值,并区分普通属性和指令。
 * 
 * @param context - 解析上下文
 * @param nameSet - 属性名集合 (用于检测重复,当前未使用)
 * @returns ATTRIBUTE 或 DIRECTIVE 类型的节点
 * 
 * 解析步骤:
 * 1. 匹配属性名 (不能以空白、/、>、= 开头)
 * 2. 前进指针,跳过属性名
 * 3. 检查是否有 '=' (表示有值)
 * 4. 如果有值,解析属性值
 * 5. 判断是指令还是普通属性
 * 6. 返回对应的节点
 * 
 * 指令识别规则:
 * - v- 开头: v-if, v-for, v-bind 等
 * - : 开头: v-bind 的简写
 * - @ 开头: v-on 的简写
 * - . 开头: 修饰符 (当前未完全支持)
 * - # 开头: v-slot 的简写
 * 
 * @example
 * ```typescript
 * // 普通属性: id="app"
 * // → { type: ATTRIBUTE, name: 'id', value: { content: 'app' } }
 * 
 * // 指令: v-if="show"
 * // → { type: DIRECTIVE, name: 'if', exp: { content: 'show' } }
 * 
 * // 简写指令: @click="handle"
 * // → { type: DIRECTIVE, name: undefined, ... } (当前实现有bug)
 * ```
 * 
 * TODO: 
 * - 修复 @ 和 : 简写指令的解析
 * - 支持修饰符 (.stop, .prevent 等)
 * - 检测重复属性
 */
function parseAttribute(context: ParserContext, nameSet: Set<string>) {
  // 匹配属性名
  // [^\t\r\n\f />] : 首字符不能是空白、/、>
  // [^\t\r\n\f />=]* : 后续字符不能是空白、/、>、=
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  const name = match[0]
  
  console.log(name)  // 调试日志
  
  // 记录属性名 (用于检测重复)
  nameSet.add(name)
  
  // 前进指针,跳过属性名
  advance(context, name.length)
  
  let value: any = null
  
  // 检查是否有 '=' (表示属性有值)
  if (/^[\t\r\n\f />]*=/.test(context.source)) {
    // 跳过 '=' 前的空白
    advanceSpaces(context)
    // 跳过 '='
    advance(context, 1)
    // 跳过 '=' 后的空白
    advanceSpaces(context)
    // 解析属性值
    value = parseAttributeValue(context)
  }
  
  // 判断是否为指令
  // v- 开头,或 :, @, ., # 开头
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    // 解析指令名称
    // 这个正则有bug,应该分别处理 v-, :, @ 等情况
    const match =
      /(?:^v-([A-Za-z0-9-]+)(?::([^}]*))?|(?::[^:]+)?(?<!^)@([^}]*))/.exec(
        name
      )!
    let dirName = match[1]
    
    // 返回指令节点
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,  // 指令表达式总是动态的
        loc: {}
      },
      art: undefined,      // arguments (当前未使用)
      modifiers: undefined, // 修饰符 (当前未使用)
      loc: {}
    }
  }
  
  // 返回普通属性节点
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: {}
    },
    loc: {}
  }
}

/**
 * 解析属性值
 * 
 * 解析引号包裹的属性值。
 * 
 * @param context - 解析上下文
 * @returns 包含 content 和 isQuoted 的对象
 * 
 * 解析步骤:
 * 1. 获取开头的引号 (' 或 ")
 * 2. 跳过引号
 * 3. 查找闭合引号的位置
 * 4. 提取引号之间的内容
 * 5. 跳过闭合引号
 * 6. 返回内容
 * 
 * @example
 * ```typescript
 * // context.source = '"app">'
 * // → { content: 'app', isQuoted: true }
 * 
 * // context.source = "'container'>"
 * // → { content: 'container', isQuoted: true }
 * ```
 * 
 * TODO:
 * - 处理未闭合引号的情况 (当前 endIndex === -1 时有bug)
 * - 支持无引号的属性值 (HTML5 允许)
 */
// parseAttributeValue
function parseAttributeValue(context: ParserContext) {
  let content: any = ''
  
  // 获取开头的引号
  const quote = context.source[0]
  
  // 跳过引号
  advance(context, 1)
  
  // 查找闭合引号的位置
  const endIndex = context.source.indexOf(quote)
  
  if (endIndex === -1) {
    // 未找到闭合引号 (异常情况)
    // TODO: 这里应该有更好的错误处理
    content = parseTextData(context, content.source.length)
  } else {
    // 提取引号之间的内容
    content = parseTextData(context, endIndex)
    // 跳过闭合引号
    advance(context, 1)
  }
  
  return { content, isQuoted: quote === `'`, loc: {} }
}

/**
 * 解析文本节点
 * 
 * 解析纯文本内容,直到遇到 '<' 或 '{{'。
 * 
 * @param context - 解析上下文
 * @returns TEXT 类型的 AST 节点
 * 
 * 解析策略:
 * 1. 查找最近的结束标记 ('<' 或 '{{')
 * 2. 提取从开头到结束标记之间的文本
 * 3. 返回文本节点
 * 
 * 为什么要查找 '<' 和 '{{'?
 * - '<' 表示下一个元素或指令的开始
 * - '{{' 表示插值表达式的开始
 * - 文本应该在遇到这些标记时结束
 * 
 * @example
 * ```typescript
 * // context.source = 'Hello <div>'
 * // → { type: TEXT, content: 'Hello ' }
 * 
 * // context.source = 'Welcome {{ name }}!'
 * // → { type: TEXT, content: 'Welcome ' }
 * ```
 */
function parseText(context: ParserContext) {
  // 默认结束位置是源码末尾
  let endIndex = context.source.length
  
  // 可能的结束标记
  let endTokens = ['<', '{{']
  
  // 查找最近的结束标记
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i])
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }
  
  // 提取文本内容
  const rawContext = parseTextData(context, endIndex)
  
  return {
    type: NodeTypes.TEXT,
    content: rawContext
  }
}

/**
 * 解析指定长度的文本数据
 * 
 * 这是一个底层工具函数,被 parseText 和 parseAttributeValue 调用。
 * 
 * @param context - 解析上下文
 * @param length - 要提取的字符数
 * @returns 提取的文本内容
 * 
 * 工作流程:
 * 1. 从源码开头截取指定长度的文本
 * 2. 前进指针,跳过已提取的文本
 * 3. 返回提取的文本
 * 
 * @example
 * ```typescript
 * // context.source = 'Hello World'
 * const text = parseTextData(context, 5)
 * // text = 'Hello'
 * // context.source = ' World'
 * ```
 */
export function parseTextData(context: ParserContext, length: number) {
  // 截取指定长度的文本
  const rawText = context.source.slice(0, length)
  
  // 前进指针
  advance(context, length)
  
  return rawText
}

/**
 * 将节点添加到数组
 * 
 * 防御性函数,确保只添加非空节点。
 * 
 * @param nodes - 节点数组
 * @param node - 要添加的节点
 */
function pushNode(nodes: any[], node: any) {
  if (node) {
    nodes.push(node)
  }
}

/**
 * 检查是否到达解析结束条件
 * 
 * 判断是否应该停止解析子节点。
 * 
 * @param context - 解析上下文
 * @param ancestors - 祖先节点栈
 * @returns 是否应该结束解析
 * 
 * 结束条件:
 * 1. 源码已耗尽 (!s)
 * 2. 遇到结束标签,且与某个祖先元素匹配
 * 
 * 工作原理:
 * 1. 检查源码是否以 '</' 开头
 * 2. 如果是,遍历祖先栈
 * 3. 检查结束标签是否与某个祖先元素匹配
 * 4. 如果匹配,返回 true (应该结束)
 * 
 * @example
 * ```typescript
 * // ancestors = [div, span]
 * // context.source = '</span>'
 * // → 匹配 span,返回 true
 * 
 * // context.source = '</div>'
 * // → 匹配 div,返回 true
 * 
 * // context.source = 'more text'
 * // → 没有 '</',返回 false
 * ```
 */
function isEnd(context: ParserContext, ancestors: any) {
  const s = context.source
  
  // 检查是否以 '</' 开头 (可能是结束标签)
  if (startsWith(s, '</')) {
    // 遍历祖先栈,从内到外查找匹配
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const tag = ancestors[i].tag
      
      // 检查结束标签是否与当前祖先匹配
      if (startsWithEndTagOpen(s, tag)) {
        return true
      }
    }
  }
  
  // 如果源码耗尽,也应该结束
  return !s
}

/**
 * 检查是否以特定标签的结束标签开头
 * 
 * @param source - 源码字符串
 * @param tag - 标签名
 * @returns 是否匹配
 * 
 * @example
 * ```typescript
 * startsWithEndTagOpen('</div>', 'div')  // true
 * startsWithEndTagOpen('</span>', 'div') // false
 * startsWithEndTagOpen('<div>', 'div')   // false
 * ```
 */
// startsWithEndTagOpen
function startsWithEndTagOpen(source: string, tag: string) {
  // 检查是否以 '</' 开头,且后面的内容与标签名匹配
  return startsWith(source, '</') && source.slice(2, 2 + tag.length) === tag
}

/**
 * 解析插值表达式
 * 
 * 解析 {{ expression }} 格式的插值。
 * 
 * @param context - 解析上下文
 * @returns INTERPOLATION 类型的 AST 节点
 * 
 * 解析步骤:
 * 1. 跳过开头的 '{{'
 * 2. 查找闭合的 '}}'
 * 3. 提取中间的内容
 * 4. 去除首尾空白 (trim)
 * 5. 跳过闭合的 '}}'
 * 6. 返回插值节点
 * 
 * @example
 * ```typescript
 * // context.source = '{{ message }}'
 * // → {
 * //   type: INTERPOLATION,
 * //   content: {
 * //     type: SIMPLE_EXPRESSION,
 * //     content: 'message',
 * //     isStatic: false
 * //   }
 * // }
 * 
 * // context.source = '{{ count + 1 }}'
 * // → content.content = 'count + 1'
 * ```
 * 
 * 为什么需要 trim?
 * - 用户可能写成 {{  message  }}
 * - trim 后得到 'message',更干净
 * - 避免不必要的空白影响代码生成
 */
// parseInterpolation
function parseInterpolation(context: ParserContext) {
  const openDelimiter = '{{'
  const closeDelimiter = '}}'
  
  // 跳过开头的 '{{'
  advance(context, openDelimiter.length)
  
  // 查找闭合的 '}}'
  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length  // 从 '{{' 之后开始查找
  )
  
  // 提取内容 (包含可能的空白)
  const preTrimContent = parseTextData(context, closeIndex)
  
  // 去除首尾空白
  const content = preTrimContent.trim()
  
  // 跳过闭合的 '}}'
  advance(context, closeDelimiter.length)
  
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,  // 插值表达式总是动态的
      content
    }
  }
}

/**
 * 检查字符串是否以特定前缀开头
 * 
 * 包装 String.startsWith 方法,提供更语义化的接口。
 * 
 * @param s - 源字符串
 * @param search - 要搜索的前缀
 * @returns 是否以该前缀开头
 * 
 * @example
 * ```typescript
 * startsWith('Hello World', 'Hello')  // true
 * startsWith('Hello World', 'World')  // false
 * ```
 */
// startsWith
function startsWith(s: string, search: string) {
  return s.startsWith(search)
}

/**
 * 前进解析指针
 * 
 * 这是解析器的核心操作,通过切片源码来模拟指针移动。
 * 
 * @param context - 解析上下文
 * @param numberOfCharacters - 要前进的字符数
 * 
 * 工作原理:
 * - 将 context.source 切片,去掉前 N 个字符
 * - 相当于指针向前移动了 N 个位置
 * 
 * @example
 * ```typescript
 * // context.source = 'Hello World'
 * advance(context, 5)
 * // context.source = ' World'
 * 
 * advance(context, 1)
 * // context.source = 'World'
 * ```
 * 
 * 为什么这样设计?
 * - 简单直观,不需要维护额外的指针变量
 * - 不可变数据,避免副作用
 * - 每次 advance 后,context.source 总是剩余待解析的部分
 */
function advance(context: ParserContext, numberOfCharacters: number) {
  // 切片源码,跳过指定数量的字符
  context.source = context.source.slice(numberOfCharacters)
}
