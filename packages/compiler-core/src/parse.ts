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
  // 删除标签
  //   context.source = context.source.slice(tag.length + 2)
  advance(context, match[0].length)
  let isSelfClosing = startsWith(s, '/')
  advance(context, isSelfClosing ? 2 : 1)
  return {
    type: NodeTypes.ELEMENT,
    tag,
    tagType: ElementTypes.ELEMENT,
    children: [] as any[],
    props: []
  }
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
