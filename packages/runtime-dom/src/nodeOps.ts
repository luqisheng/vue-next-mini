const doc = document
export const nodeOps = {
  insert(child: any, parent: Element, anchor?: any) {
    parent.insertBefore(child, anchor || null)
  },
  remove(child: any) {
    if (child && child.parentNode) {
      child.parentNode.removeChild(child)
    }
  },
  //   创建element
  createElement(tag: any): Element {
    const el = doc.createElement(tag)
    return el
  },
  setElementText(node: Element, text: string) {
    node.textContent = text
  },
  createText(text: string): Text {
    return doc.createTextNode(text)
  },
  setText(node: Element, text: string) {
    node.nodeValue = text
  },
}
