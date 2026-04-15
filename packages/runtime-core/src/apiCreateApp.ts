import { createVNode, VNode } from './vnode'

export function createAppAPI(render: any) {
  return function createApp(rootComponent: any, rootProps: any = null) {
    const app = {
      _component: rootComponent,
      _container: null,
      mount(container: any) {
        // 根据根组件类型创建 VNode
        let vnode: VNode
        if (rootComponent && typeof rootComponent === 'object' && 'type' in rootComponent) {
          // 如果根组件已经是 VNode，直接复用
          vnode = rootComponent
        } else {
          // 否则创建组件 VNode
          vnode = createVNode(rootComponent, rootProps, null)
        }

        // 渲染 VNode 到容器
        render(vnode, container)
        
        // 保存容器引用
        app._container = container
        
        return app
      }
    }
    return app
  }
}
