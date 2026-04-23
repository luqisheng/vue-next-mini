/**
 * runtime-dom 入口文件
 * 
 * 该模块负责 DOM 平台的渲染器实现，主要功能包括:
 * 1. 创建基于 DOM 的渲染器实例
 * 2. 提供 render() API 用于渲染虚拟 DOM 到真实 DOM
 * 3. 提供 createApp() API 用于创建应用实例并处理挂载逻辑
 */

import { createRenderer } from 'packages/runtime-core/src/renderer'
import { patchProp } from './patchProp'
import { nodeOps } from './nodeOps'
import { extend, isString } from '@vue/shared'

// 合并 DOM 操作方法和属性更新方法，形成完整的渲染器配置选项
// nodeOps 提供节点操作（创建、插入、删除等）
// patchProp 提供属性更新策略
const rendererOptions = extend({ patchProp }, nodeOps)

// 渲染器实例缓存，确保单例模式
let renderer: any

/**
 * 确保渲染器已创建（单例模式）
 * @returns 渲染器实例
 * 
 * 设计意图：
 * - 避免重复创建渲染器实例，节省内存
 * - 首次调用时创建，后续直接返回缓存实例
 */
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
}

/**
 * 渲染函数 - 将虚拟 DOM 渲染到容器中
 * 
 * @param args - 渲染参数（vnode, container, isSVG?）
 * 
 * 工作流程：
 * 1. 获取或创建渲染器实例
 * 2. 调用渲染器的 render 方法进行实际渲染
 * 
 * 注意：这是底层 API，通常不直接使用，而是通过 createApp().mount() 使用
 */
export const render = (...args: any) => {
  console.log('render', args)
  ensureRenderer().render(...args)
}

/**
 * 创建应用实例
 * 
 * @param args - 应用配置参数（根组件, props?）
 * @returns 应用实例对象
 * 
 * 核心功能：
 * 1. 创建渲染器并初始化应用
 * 2. 重写 mount 方法，支持 CSS 选择器和 DOM 元素两种挂载方式
 * 3. 提供容器有效性检查和错误提示
 * 
 * 使用示例：
 * ```typescript
 * const app = createApp(AppComponent)
 * app.mount('#app')  // 支持 CSS 选择器
 * app.mount(document.getElementById('app'))  // 支持 DOM 元素
 * ```
 */
export const createApp = (...args: any) => {
  // 创建应用实例
  const app = ensureRenderer().createApp(...args)
  
  // 保存原始 mount 方法
  const { mount } = app
  
  // 重写 mount 方法，增强容器处理能力
  app.mount = (containerOrSelector: Element|string) => {
    // 标准化容器：将 CSS 选择器转换为 DOM 元素
    const container = normalizeContainer(containerOrSelector)
    
    // 容器有效性检查
    if (!container) {
      return console.warn(
        `Invalid container: ${containerOrSelector}`,
      )
    }
    
    // 调用原始 mount 方法进行实际挂载
    mount(container)
  }
  
  return app
}

/**
 * 标准化容器 - 将 CSS 选择器或 DOM 元素统一转换为 DOM 元素
 * 
 * @param container - CSS 选择器字符串或 DOM 元素
 * @returns DOM 元素或 null（如果选择器未匹配到元素）
 * 
 * 处理逻辑：
 * 1. 如果是字符串，视为 CSS 选择器，使用 document.querySelector 查找元素
 * 2. 如果查找失败，输出警告信息
 * 3. 如果已经是 DOM 元素，直接返回
 * 
 * 设计意图：
 * - 提供灵活的挂载方式，开发者可以使用 '#app' 或 document.getElementById('app')
 * - 统一的错误处理，当容器不存在时给出明确提示
 */
function normalizeContainer(container: Element | string): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container)
    if (!res) {
      console.warn(`Failed to mount app: mount target selector returned null.`)
    }
    return res
  }
  return container
}
