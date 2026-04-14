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
export function baseParse(content: string) {
  const context = creatParserContext(content)
  const children = parseChildren(context, [])
  console.log(content)
  console.log(children,'1111111111111111111111111111')
  return {}
}
function parseChildren(context: ParserContext, ancestors: any) {
  const nodes: any[] = []
  while (!isEnd(context, ancestors)) {
    const s = context.source
    let node: any
    if (s.startsWith('{{')) {
      node = parseInterpolation(context)
    } else if (s.startsWith('<')) {
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
    TagType: ElementTypes.ELEMENT,
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
  return rawContext
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
  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  )
  // 删除{{}}中间的内容
  context.source = context.source.slice(openDelimiter.length, closeIndex)
  return {
    type: 2,
    content: {
      type: 3,
      content: context.source.slice(0, closeIndex)
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
