/**
 * 应用创建 API 模块
 * 
 * 提供 createApp 函数的实现，这是 Vue 应用的入口点。
 * createApp 返回一个应用实例，可以挂载到 DOM 容器中。
 */
import { createVNode, VNode } from './vnode'

/**
 * 创建应用 API 工厂函数
 * 
 * 这是一个高阶函数，接收 render 函数作为参数，
 * 返回 createApp 函数。这种设计使得 createApp 可以使用
 * 特定渲染器的 render 实现（如 DOM 渲染器、SSR 渲染器等）。
 * 
 * @param render - 渲染函数
 * @returns createApp 函数
 */
export function createAppAPI(render: any) {
  /**
   * 创建 Vue 应用实例
   * 
   * 这是用户调用 createApp(Component) 时实际执行的函数。
   * 它创建一个应用对象，包含 mount 方法用于将应用挂载到 DOM。
   * 
   * @param rootComponent - 根组件（可以是组件定义或 VNode）
   * @param rootProps - 根组件的 props
   * @returns 应用实例对象
   */
  return function createApp(rootComponent: any, rootProps: any = null) {
    // 创建应用实例对象
    const app = {
      _component: rootComponent,  // 保存根组件引用
      _container: null,           // 保存容器引用
      
      /**
       * 挂载应用到 DOM 容器
       * 
       * 这是应用启动的最后一步，负责：
       * 1. 根据根组件创建 VNode
       * 2. 调用 render 函数将 VNode 渲染到容器
       * 3. 保存容器引用
       * 
       * @param container - DOM 容器元素
       * @returns 应用实例（支持链式调用）
       */
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
