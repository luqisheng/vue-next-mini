/**
 * 组件实例模块
 * 
 * 负责创建和管理 Vue 组件实例，包括：
 * - 组件实例的初始化
 * - setup 函数的执行和结果处理
 * - Options API（data、生命周期钩子等）的处理
 * - 运行时编译器的注册
 */
import { reactive } from '@vue/reactivity'
import { isFunction, isObject } from 'packages/shared/src/index'
import { onBeforeMount, onMounted } from './apiLifecycle'

// 全局唯一标识符计数器，用于为每个组件实例分配唯一的 uid
let uid = 0

// 运行时编译器引用，用于将模板字符串编译为渲染函数
let compile: any = null

/**
 * 创建组件实例
 * 
 * 根据 VNode 创建一个空的组件实例对象，包含组件运行所需的所有状态。
 * 此时实例尚未初始化，只是创建了基础结构。
 * 
 * @param vnode - 组件对应的虚拟节点
 * @returns 初始化的组件实例对象
 */
export function createComponentInstance(vnode: any) {
  const type = vnode.type
  
  // 创建组件实例对象，包含所有必要的属性和状态
  const instance = {
    uid: uid++,              // 唯一标识符，用于调试和追踪
    vnode,                   // 关联的虚拟节点
    type,                    // 组件定义（包含 setup、render 等）
    subTree: null,           // 组件渲染的子树（VNode）
    effect: null,            // 响应式副作用对象
    update: null,            // 更新函数
    render: null,            // 渲染函数
    isMounted: false,        // 是否已挂载标志
    bc: null,                // beforeCreate 钩子
    c: null,                 // created 钩子
    bm: null,                // beforeMount 钩子
    m: null                  // mounted 钩子
  }
  
  return instance
}

/**
 * 设置组件
 * 
 * 组件初始化的入口函数，负责：
 * 1. 处理有状态的组件（Composition API / Options API）
 * 2. 执行 setup 函数（如果存在）
 * 3. 处理 Options API 的配置
 * 
 * @param instance - 组件实例
 */
export function setupComponent(instance: any) {
  // 设置有状态的组件（相对于函数式组件）
  setupStatefulComponent(instance)
}

/**
 * 设置有状态组件
 * 
 * 处理包含 setup 函数或 Options API 的组件：
 * - 如果定义了 setup 函数，执行它并处理返回值
 * - 如果没有 setup，直接进入组件设置的完成阶段
 * 
 * @param instance - 组件实例
 */
function setupStatefulComponent(instance: any) {
  const Component = instance.type
  const { setup } = Component
  
  if (setup) {
    // 执行 setup 函数
    const setupResult = setup()
    
    // 处理 setup 的返回值
    handleSetupResult(instance, setupResult)
  } else {
    // 没有 setup 函数，直接完成组件设置
    finishComponentSetup(instance)
  }
}

/**
 * 处理 setup 函数的返回值
 * 
 * setup 函数可以返回两种类型：
 * 1. 函数：作为组件的渲染函数
 * 2. 对象：作为组件的状态，暴露给模板使用
 * 
 * @param instance - 组件实例
 * @param setupResult - setup 函数的返回值
 */
export function handleSetupResult(instance: any, setupResult: any) {
  if (isFunction(setupResult)) {
    // 如果返回的是函数，将其作为渲染函数
    instance.render = setupResult
  } else if (isObject(setupResult)) {
    // 如果返回的是对象，将其作为组件的状态
    instance.setupState = setupResult
  }
  
  // 继续完成组件设置
  finishComponentSetup(instance)
}

/**
 * 完成组件设置
 * 
 * 这是组件初始化的最后阶段，负责：
 * 1. 确保组件有渲染函数（从 setup 返回值、组件定义、或编译模板获得）
 * 2. 应用 Options API 配置（data、生命周期钩子等）
 * 
 * @param instance - 组件实例
 */
export function finishComponentSetup(instance: any) {
  const Component = instance.type
  
  // 如果还没有渲染函数，尝试从组件定义中获取或编译模板
  if (!instance.render) {
    // 如果有运行时编译器且组件定义了 template，进行编译
    if (compile && !Component.render) {
      if (Component.template) {
        const template = Component.template
        // 将模板字符串编译为渲染函数
        Component.render = compile(template)
      }
    }
    
    // 使用组件定义的渲染函数
    instance.render = Component.render
  }

  // 应用 Options API 配置
  applyOptions(instance)
}

/**
 * 注册运行时编译器
 * 
 * 允许外部传入编译器函数，用于将模板字符串编译为渲染函数。
 * 这使得 runtime-core 可以不依赖具体的编译器实现，保持模块化。
 * 
 * @param _compile - 编译器函数
 */
export function registerRuntimeCompiler(_compile: any) { 
  compile = _compile
}

/**
 * 应用 Options API 配置
 * 
 * 处理传统的 Options API 风格组件配置：
 * - data 选项：创建响应式数据
 * - 生命周期钩子：注册 beforeCreate、created、beforeMount、mounted 等
 * 
 * @param instance - 组件实例
 */
function applyOptions(instance: any) {
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted
  } = instance.type
  
  // 调用 beforeCreate 钩子
  if (beforeCreate) {
    callHook(beforeCreate, instance.data)
  }
  
  // 处理 data 选项：创建响应式数据对象
  if (dataOptions) {
    const data = dataOptions()
    if (isObject(data)) {
      // 将 data 转换为响应式对象
      instance.data = reactive(data)
    }
  }
  
  // 调用 created 钩子
  if (created) {
    callHook(created, instance.data)
  }
  
  /**
   * 注册生命周期钩子的辅助函数
   * 
   * 将 Options API 的生命周期钩子注册到 Composition API 的系统中
   * 
   * @param register - 注册函数（如 onBeforeMount）
   * @param hook - 钩子函数
   */
  function registerLifecycleHook(register: Function, hook?: Function) {
    if (hook) {
      // 将钩子函数绑定到 data 上下文，并注册
      register(hook?.bind(instance.data), instance)
    }
  }
  
  // 注册 beforeMount 和 mounted 钩子
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

/**
 * 调用钩子函数
 * 
 * 将钩子函数绑定到指定的代理对象（通常是 data），然后执行它。
 * 这样钩子函数内部可以通过 this 访问组件的数据。
 * 
 * @param hook - 钩子函数
 * @param proxy - 代理对象（通常是 data）
 */
function callHook(hook: Function, proxy: any) {
  hook.bind(proxy)()
}
