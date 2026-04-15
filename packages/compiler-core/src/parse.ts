import { ElementTypes, NodeTypes } from 'packages/compiler-core/src/ast'

const enum TagType {
  START,
  END
}
export interface ParserContext {
  source: string
}
function creatParserContext(content: string): ParserContext {
  return {
    source: content
  }
}
export function createRoot(children: any) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {}
  }
}
export function baseParse(content: string) {
  const context = creatParserContext(content)
  const children = parseChildren(context, [])
  return createRoot(children)
}
function parseChildren(context: ParserContext, ancestors: any) {
  const nodes: any[] = []
  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: any
    if (startsWith(s, '{{')) {
      node = parseInterpolation(context)
    } else if (startsWith(s, '<')) {
      if (/[a-z]/i.test(s[1])) {
        node = parseElement(context, ancestors)
      }
    }
    if (!node) {
      node = parseText(context)
    }
    pushNode(nodes, node)
  }
  return nodes
}
// parseElement
function parseElement(context: ParserContext, ancestors: any) {
  const element = parseTag(context, TagType.START)
  ancestors.push(element)
  const children = parseChildren(context, ancestors)
  ancestors.pop()
  element.children = children
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.END)
  } else {
    throw new Error(`缺少结束标签:${element.tag}`)
  }
  return element
}
// parseTag
function parseTag(context: ParserContext, type: TagType) {
  const s = context.source
  const match: any = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(s)
  const tag = match[1]
  advance(context, match[0].length)
  // 属性和指令的处理
  advanceSpaces(context)
  let props = parseAttributes(context,type)
  let isSelfClosing = startsWith(s, '/')
  advance(context, isSelfClosing ? 2 : 1)
  return {
    type: NodeTypes.ELEMENT,
    tag,
    tagType: ElementTypes.ELEMENT,
    children: [] as any[],
    props
  }
}

function advanceSpaces(context: ParserContext): void {
  let s = context.source
  const match = /^[\t\r\n\f ]+/.exec(s)
  if (match) {
    advance(context, match[0].length)
  }
}

// parseAttributes
function parseAttributes(context: ParserContext, type: TagType) {
  const props: any[] = []
  const attributeNames: any = new Set()
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '</')
  ) {
    const attr = parseAttribute(context, attributeNames)
    if (type === TagType.START) {
      props.push(attr)
    }
    advanceSpaces(context)
  }
  return props
}
function parseAttribute(context: ParserContext, nameSet: Set<string>) {
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  const name = match[0]
  console.log(name)
  nameSet.add(name)
  advance(context, name.length)
  let value: any = null
  if (/^[\t\r\n\f />]*=/.test(context.source)) {
    advanceSpaces(context)
    advance(context, 1)
    advanceSpaces(context)
    value = parseAttributeValue(context)
  }
  // v-directive
  if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      /(?:^v-([A-Za-z0-9-]+)(?::([^}]*))?|(?::[^:]+)?(?<!^)@([^}]*))/.exec(
        name
      )!
    let dirName = match[1]
    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        loc: {}
      },
      art: undefined,
      modifiers: undefined,
      loc: {}
    }
  }
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
// parseAttributeValue
function parseAttributeValue(context: ParserContext) {
  let content: any = ''
  const quote = context.source[0]
  advance(context, 1)
  const endIndex = context.source.indexOf(quote)
  if (endIndex === -1) {
    content = parseTextData(context, content.source.length)
  } else {
    content = parseTextData(context, endIndex)
    advance(context, 1)
  }
  return { content, isQuoted: quote === `'`, loc: {} }
}
function parseText(context: ParserContext) {
  let endIndex = context.source.length
  let endTokens = ['<', '{{']
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i])
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }
  const rawContext = parseTextData(context, endIndex)
  return {
    type: NodeTypes.TEXT,
    content: rawContext
  }
}
export function parseTextData(context: ParserContext, length: number) {
  const rawText = context.source.slice(0, length)
  advance(context, length)
  return rawText
}

function pushNode(nodes: any[], node: any) {
  if (node) {
    nodes.push(node)
  }
}

function isEnd(context: ParserContext, ancestors: any) {
  const s = context.source
  if (startsWith(s, '</')) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const tag = ancestors[i].tag
      if (startsWithEndTagOpen(s, tag)) {
        return true
      }
    }
  }
  return !s
}
// startsWithEndTagOpen
function startsWithEndTagOpen(source: string, tag: string) {
  return startsWith(source, '</') && source.slice(2, 2 + tag.length) === tag
}
// parseInterpolation
function parseInterpolation(context: ParserContext) {
  const openDelimiter = '{{'
  const closeDelimiter = '}}'
  advance(context, openDelimiter.length)
  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  )
  const preTrimContent = parseTextData(context, closeIndex)
  const content = preTrimContent.trim()
  advance(context, closeDelimiter.length)
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content
    }
  }
}

// startsWith
function startsWith(s: string, search: string) {
  return s.startsWith(search)
}

function advance(context: ParserContext, numberOfCharacters: number) {
  context.source = context.source.slice(numberOfCharacters)
}
