const doc = document
export const nodeOps = {
  insert(child: any, parent: Element, anchor?: any) {
    parent.insertBefore(child, anchor||null)
  },
  //   创建element
  createElement(tag:any):Element {
    const el = doc.createElement(tag)
    return el
  },
  setElementText(node: Element, text: string) {
    node.textContent = text
  },
}
