# Vue Next Mini 架构流程图

## 📋 目录
1. [整体架构图](#整体架构图)
2. [响应式系统流程](#响应式系统流程)
3. [渲染器工作流程](#渲染器工作流程)
4. [编译器工作流程](#编译器工作流程)
5. [组件生命周期流程](#组件生命周期流程)
6. [Diff 算法流程](#diff-算法流程)

---

## 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue 应用入口 (createApp)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Runtime Core                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Renderer   │◄──►│  Component   │◄──►│   VNode      │  │
│  │  (渲染引擎)   │    │  (组件管理)   │    │ (虚拟节点)    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │  Scheduler   │ (调度器 - 批量更新、异步队列)               │
│  └──────────────┘                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌────────────────┐   ┌────────────────┐
│  Runtime DOM   │   │ Compiler Core  │
│  (DOM 操作层)   │   │  (模板编译器)   │
│                │   │                │
│ • nodeOps      │   │ • Parse (解析)  │
│ • patchProp    │   │ • Transform    │
│ • modules/     │   │ • Codegen      │
└────────┬───────┘   └────────┬───────┘
         │                    │
         └────────┬───────────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Reactivity System                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ reactive │  │   ref    │  │ computed │  │  effect  │   │
│  │ (Proxy)  │  │ (包装器)  │  │ (计算属性) │  │(副作用)  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴─────────────┴─────────────┘           │
│                     │                                       │
│                     ▼                                       │
│            ┌────────────────┐                               │
│            │  Dep & Track   │ (依赖收集与触发)               │
│            └────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 响应式系统流程

### 1. reactive 创建流程

```
用户调用 reactive(obj)
         │
         ▼
┌─────────────────────┐
│ createReactiveObject │
│ 1. 检查缓存          │
│ 2. 创建 Proxy        │
│ 3. 存入缓存          │
└────────┬────────────┘
         │
         ▼
   返回 Proxy 对象
         │
         ▼
  访问属性时触发 get
         │
         ▼
┌─────────────────────┐
│   track(target,key)  │
│ 1. 获取 depsMap      │
│ 2. 获取 dep (Set)    │
│ 3. 添加 activeEffect │
└─────────────────────┘
         │
         ▼
  修改属性时触发 set
         │
         ▼
┌─────────────────────┐
│  trigger(target,key) │
│ 1. 获取 depsMap      │
│ 2. 获取 dep (Set)    │
│ 3. 执行所有 effect   │
└─────────────────────┘
```

### 2. effect 依赖收集流程

```typescript
// 示例代码
const state = reactive({ count: 0 })

effect(() => {
  console.log(state.count) // 访问时收集依赖
})

state.count++ // 修改时触发更新
```

**执行流程:**

```
effect(fn) 被调用
    │
    ▼
创建 ReactiveEffect 实例
    │
    ▼
立即执行 effect.run()
    │
    ▼
设置 activeEffect = 当前 effect
    │
    ▼
执行 fn() → 访问 state.count
    │
    ▼
触发 Proxy.get 拦截器
    │
    ▼
调用 track(state, 'count')
    │
    ▼
从 targetMap 获取 depsMap
    │
    ▼
从 depsMap 获取 dep (Set)
    │
    ▼
将 activeEffect 添加到 dep
    │
    ▼
建立反向引用: effect.deps.push(dep)
    │
    ▼
fn 执行完毕,返回结果

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

当 state.count++ 时:
    │
    ▼
触发 Proxy.set 拦截器
    │
    ▼
调用 trigger(state, 'count')
    │
    ▼
从 targetMap 获取 depsMap
    │
    ▼
从 depsMap 获取 dep (Set)
    │
    ▼
遍历 dep 中的所有 effect
    │
    ▼
对每个 effect:
  ├─ 有 scheduler? 
  │   ├─ 是 → 调用 scheduler()
  │   └─ 否 → 直接 effect.run()
  └─ 重新执行 fn,更新视图
```

### 3. ref 实现流程

```
ref(value)
    │
    ▼
创建 RefImpl 实例
    │
    ├── _rawValue: 原始值
    ├── _value: toReactive(value) (如果是对象则转为 reactive)
    ├── dep: Set (依赖集合)
    └── __v_isRef: true
    │
    ▼
访问 ref.value 时:
    │
    ├── 调用 trackRefValue(ref)
    ├── 将 activeEffect 添加到 ref.dep
    └── 返回 ref._value
    │
    ▼
设置 ref.value = newValue 时:
    │
    ├── 检查 hasChanged(newValue, _rawValue)
    ├── 更新 _rawValue 和 _value
    └── 调用 triggerRefValue(ref)
        └── 执行 ref.dep 中所有 effect
```

### 4. computed 懒求值流程

```
computed(() => state.count * 2)
    │
    ▼
创建 ComputedRefImpl 实例
    │
    ├── effect: ReactiveEffect(getter, scheduler)
    ├── _dirty: true (需要重新计算)
    ├── _value: undefined (缓存值)
    └── dep: Set (依赖此 computed 的 effect)
    │
    ▼
scheduler 逻辑:
    └── 当依赖变化时:
        ├── 如果 !_dirty → 标记 _dirty = true
        └── 触发 triggerRefValue(this)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

首次访问 computed.value:
    │
    ▼
调用 trackRefValue(this)
    │
    ▼
检查 _dirty === true?
    │
    ├── 是 → 执行 effect.run()
    │         ├── 执行 getter 函数
    │         ├── 收集 getter 中的依赖
    │         └── 返回计算结果
    │         └── 设置 _dirty = false
    │
    └── 否 → 直接返回缓存的 _value

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

依赖变化时 (state.count++):
    │
    ▼
触发 computed 的 scheduler
    │
    ▼
设置 _dirty = true
    │
    ▼
触发依赖此 computed 的其他 effect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

再次访问 computed.value:
    │
    ▼
检查 _dirty === true?
    │
    ├── 是 → 重新计算 (同上)
    └── 否 → 返回缓存值 (不重新计算)
```

---

## 渲染器工作流程

### 1. render 主流程

```
render(vnode, container)
    │
    ▼
patch(oldVNode, newVNode, container)
    │
    ├── oldVNode === null? (首次渲染)
    │   └── 是 → mountElement / mountComponent
    │
    └── oldVNode !== null? (更新)
        └── 是 → patchElement / updateComponent
```

### 2. 元素挂载流程 (mountElement)

```
mountElement(vnode, container)
    │
    ▼
1. hostCreateElement(vnode.type)
   创建真实 DOM 元素
    │
    ▼
2. vnode.el = el
   保存 DOM 引用到 vnode
    │
    ▼
3. 处理 children:
   ├─ TEXT_CHILDREN → hostSetElementText(el, children)
   └─ ARRAY_CHILDREN → mountChildren(children, el)
       └── 递归调用 patch(null, child, el)
    │
    ▼
4. 处理 props:
   └── 遍历 props,调用 hostPatchProp(el, key, null, value)
    │
    ▼
5. hostInsert(el, container)
   插入到父容器
```

### 3. 元素更新流程 (patchElement)

```
patchElement(oldVNode, newVNode)
    │
    ▼
1. newVNode.el = oldVNode.el
   复用 DOM 节点
    │
    ▼
2. patchProps(el, oldProps, newProps)
   ├─ 遍历 newProps,更新变化的属性
   └─ 遍历 oldProps,删除不存在的属性
    │
    ▼
3. patchChildren(oldVNode, newVNode, el)
   ├─ text → text: 直接替换文本
   ├─ array → array: 执行 diff 算法
   ├─ text → array: 清空文本,挂载数组
   └─ array → text: 卸载数组,设置文本
```

### 4. Diff 算法流程 (patchKeyedChildren)

```
patchKeyedChildren(oldChildren, newChildren, container)
    │
    ▼
步骤1: 从前向后同步
    while (i <= oldEnd && i <= newEnd) {
      if (isSameVNodeType(old[i], new[i])) {
        patch(old[i], new[i])
        i++
      } else break
    }
    │
    ▼
步骤2: 从后向前同步
    while (i <= oldEnd && i <= newEnd) {
      if (isSameVNodeType(old[oldEnd], new[newEnd])) {
        patch(old[oldEnd], new[newEnd])
        oldEnd--
        newEnd--
      } else break
    }
    │
    ▼
步骤3: 判断剩余情况
    ├─ i > oldEnd (新节点多)
    │   └── 挂载多余的新节点
    │
    ├─ i > newEnd (旧节点多)
    │   └── 卸载多余的旧节点
    │
    └─ 中间乱序 (未知序列)
        └── 执行 LIS 优化算法
```

### 5. LIS 优化算法详解

```
处理未知序列 (s1 ~ oldEnd, s2 ~ newEnd):
    │
    ▼
步骤1: 创建 key → newIndex 映射表
    for (j = s2; j <= newEnd; j++) {
      keyToNewIndexMap.set(newChildren[j].key, j)
    }
    │
    ▼
步骤2: 遍历旧节点,进行更新或卸载
    for (j = s1; j <= oldEnd; j++) {
      通过 key 查找对应的新节点索引
      ├─ 找不到 → unmount(old[j])
      └─ 找到 → 
          ├── 记录 newIndexToOldIndexMap[newIndex - s2] = j + 1
          ├── 判断顺序是否变化 (moved 标志)
          └── patch(old[j], new[newIndex])
    }
    │
    ▼
步骤3: 计算最长递增子序列 (LIS)
    const increasingSeq = moved ? getSequence(newIndexToOldIndexMap) : []
    │
    ▼
步骤4: 从后向前遍历新节点,执行挂载或移动
    for (k = toBePatched - 1; k >= 0; k--) {
      if (newIndexToOldIndexMap[k] === 0) {
        // 新节点,需要挂载
        patch(null, newChildren[s2 + k], container, anchor)
      } else if (moved) {
        if (k 不在 LIS 中) {
          // 需要移动位置
          move(newChildren[s2 + k], container, anchor)
        }
      }
    }
```

**LIS 算法示例:**

```
假设 newIndexToOldIndexMap = [5, 3, 4, 0, 1]
                          (0表示新节点)

getSequence 返回: [1, 2, 4] (索引)
对应的值: [3, 4, 1]

解释:
- 索引 1, 2, 4 对应的旧节点顺序是正确的 (3 < 4, 但 1 < 4 所以不是完全递增)
- 实际上应该是 [3, 4] 或 [1] 等递增序列
- LIS 中的节点保持相对顺序,不需要移动
- 不在 LIS 中的节点需要移动到正确位置
```

---

## 编译器工作流程

### 1. 编译三阶段

```
baseCompile(template)
    │
    ▼
┌─────────────────────────────────┐
│  Phase 1: Parse (解析)           │
│  模板字符串 → AST (抽象语法树)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Phase 2: Transform (转换)       │
│  AST → 优化后的 AST               │
│  • transformElement              │
│  • transformText                 │
│  • transformIf (v-if)            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Phase 3: Codegen (代码生成)     │
│  AST → render 函数字符串          │
└─────────────────────────────────┘
```

### 2. Parse 解析流程

```
baseParse(template)
    │
    ▼
parseChildren(context, ancestors)
    │
    ├── 循环直到 isEnd(context, ancestors)
    │   │
    │   ├── 以 '{{' 开头?
    │   │   └── parseInterpolation() → 插值节点
    │   │
    │   ├── 以 '<' 开头且后面是字母?
    │   │   └── parseElement() → 元素节点
    │   │       │
    │   │       ├── parseTag(START) → 开始标签
    │   │       │   └── parseAttributes() → 解析属性和指令
    │   │       │
    │   │       ├── parseChildren() → 递归解析子节点
    │   │       │
    │   │       └── parseTag(END) → 结束标签
    │   │
    │   └── 其他情况
    │       └── parseText() → 文本节点
    │
    ▼
返回 Root 节点
    └── type: ROOT
        └── children: [所有解析的子节点]
```

**AST 节点类型:**

```typescript
// 根节点
{ type: NodeTypes.ROOT, children: [...] }

// 元素节点
{
  type: NodeTypes.ELEMENT,
  tag: 'div',
  tagType: ElementTypes.ELEMENT,
  props: [
    { type: ATTRIBUTE, name: 'id', value: 'app' },
    { type: DIRECTIVE, name: 'if', exp: 'show' }
  ],
  children: [...]
}

// 文本节点
{ type: NodeTypes.TEXT, content: 'Hello' }

// 插值节点
{
  type: NodeTypes.INTERPOLATION,
  content: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content: 'message',
    isStatic: false
  }
}
```

### 3. Transform 转换流程

```
transform(ast, options)
    │
    ├── 遍历 AST 树 (traverseNode)
    │   │
    │   ├── 对每个节点应用 nodeTransforms
    │   │   ├── transformElement: 处理元素节点
    │   │   │   ├── 分析 props
    │   │   │   ├── 处理 v-if/v-for
    │   │   │   └── 生成代码辅助信息
    │   │   │
    │   │   ├── transformText: 处理文本节点
    │   │   │   └── 合并连续文本节点
    │   │   │
    │   │   └── transformIf: 处理 v-if 指令
    │   │       └── 转换为条件渲染代码
    │   │
    │   └── 递归处理子节点
    │
    ▼
返回转换后的 AST
```

### 4. Codegen 代码生成流程

```
generate(ast)
    │
    ▼
生成 render 函数字符串
    │
    ├── 生成函数头: `function render(_ctx) {`
    │
    ├── 生成函数体:
    │   ├── 根据节点类型生成对应代码
    │   ├── 元素节点 → createElementVNode(...)
    │   ├── 文本节点 → createTextVNode(...)
    │   ├── 插值节点 → toDisplayString(_ctx.xxx)
    │   └── v-if → _ctx.show ? ... : ...
    │
    └── 生成函数尾: `}`
    │
    ▼
返回 { code: '...', ast }
```

**生成示例:**

```javascript
// 模板
<div id="app">{{ message }}</div>

// 生成的 render 函数
function render(_ctx) {
  return createElementVNode("div", { id: "app" }, [
    createTextVNode(toDisplayString(_ctx.message), 1 /* TEXT */)
  ])
}
```

---

## 组件生命周期流程

### 1. 组件挂载流程

```
mountComponent(initialVNode, container)
    │
    ▼
1. createComponentInstance(initialVNode)
   创建组件实例
    │
    ├── instance = {
    │   vnode: initialVNode,
    │   type: componentType,
    │   props: {},
    │   setupState: {},
    │   isMounted: false,
    │   subTree: null,
    │   effect: null,
    │   update: null,
    │   bm: beforeMount hook,
    │   m: mounted hook
    │ }
    │
    ▼
2. setupComponent(instance)
   初始化组件
    │
    ├── 解析 props
    ├── 执行 setup() 函数
    ├── 处理返回值 (setupState)
    └── 创建 render 函数
    │
    ▼
3. setupRenderEffect(instance, container)
   设置渲染 effect
    │
    ├── 创建 componentUpdateFn
    │   │
    │   ├── 首次渲染 (!isMounted):
    │   │   ├── 调用 bm (beforeMount)
    │   │   ├── renderComponentRoot(instance) → subTree
    │   │   ├── patch(null, subTree, container)
    │   │   ├── 调用 m (mounted)
    │   │   └── isMounted = true
    │   │
    │   └── 更新渲染 (isMounted):
    │       ├── 获取 next vnode
    │       ├── renderComponentRoot(instance) → nextTree
    │       ├── patch(prevTree, nextTree, container)
    │       └── 更新 el 引用
    │
    ├── 创建 ReactiveEffect(componentUpdateFn, scheduler)
    │   └── scheduler: queuePreFlushCb(update)
    │
    └── 立即执行 update() → effect.run()
```

### 2. 组件更新流程

```
响应式数据变化
    │
    ▼
触发 effect.scheduler()
    │
    ▼
queuePreFlushCb(update)
    │
    ▼
加入微任务队列 (Promise.resolve().then)
    │
    ▼
执行 update() → effect.run()
    │
    ▼
执行 componentUpdateFn
    │
    ├── isMounted === true
    │
    ├── renderComponentRoot(instance)
    │   └── 调用 render 函数,生成新的 subTree
    │
    ├── patch(prevTree, nextTree, container)
    │   └── 执行 diff 算法,更新 DOM
    │
    └── 更新 vnode.el 引用
```

### 3. 生命周期钩子执行顺序

```
首次挂载:
  beforeCreate → created → beforeMount → mounted

更新:
  beforeUpdate → updated

卸载:
  beforeUnmount → unmounted
```

---

## 完整数据流示例

### 示例: 计数器应用

```vue
<template>
  <div>
    <p>{{ count }}</p>
    <button @click="increment">+1</button>
  </div>
</template>

<script>
export default {
  setup() {
    const count = ref(0)
    
    function increment() {
      count.value++
    }
    
    return { count, increment }
  }
}
</script>
```

**完整执行流程:**

```
1. 编译阶段 (Compiler)
   ┌────────────────────────────────────┐
   │ 模板字符串                           │
   │ "<div><p>{{ count }}</p>...</div>"  │
   └────────────┬───────────────────────┘
                │ baseCompile()
                ▼
   ┌────────────────────────────────────┐
   │ Parse                              │
   │ 生成 AST                            │
   └────────────┬───────────────────────┘
                │ transform()
                ▼
   ┌────────────────────────────────────┐
   │ Transform                          │
   │ 优化 AST,添加代码生成信息            │
   └────────────┬───────────────────────┘
                │ generate()
                ▼
   ┌────────────────────────────────────┐
   │ Codegen                            │
   │ 生成 render 函数字符串               │
   └────────────────────────────────────┘

2. 创建应用 (Runtime)
   ┌────────────────────────────────────┐
   │ createApp(App)                     │
   └────────────┬───────────────────────┘
                │ mount('#app')
                ▼
   ┌────────────────────────────────────┐
   │ render(vnode, container)           │
   └────────────┬───────────────────────┘
                │ patch(null, vnode, container)
                ▼
   ┌────────────────────────────────────┐
   │ mountComponent                      │
   │ 1. 创建组件实例                      │
   │ 2. 执行 setup()                     │
   │    - 创建 ref(0)                    │
   │    - 返回 { count, increment }      │
   │ 3. 设置渲染 effect                  │
   └────────────┬───────────────────────┘
                │ effect.run()
                ▼
   ┌────────────────────────────────────┐
   │ componentUpdateFn (首次渲染)        │
   │ 1. 调用 beforeMount                 │
   │ 2. renderComponentRoot()            │
   │    - 执行 render 函数               │
   │    - 访问 count.value → track       │
   │    - 生成 subTree (VNode 树)        │
   │ 3. patch(null, subTree, container)  │
   │    - mountElement('div')            │
   │    - mountElement('p')              │
   │    - mountText(count.value)         │
   │    - mountElement('button')         │
   │ 4. 调用 mounted                     │
   └────────────────────────────────────┘

3. 用户交互 (点击按钮)
   ┌────────────────────────────────────┐
   │ 点击 button                         │
   │ 触发 increment()                    │
   └────────────┬───────────────────────┘
                │ count.value++
                ▼
   ┌────────────────────────────────────┐
   │ ref setter                         │
   │ 1. 检查值是否变化                    │
   │ 2. 更新 _rawValue 和 _value         │
   │ 3. triggerRefValue(ref)            │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ triggerEffects(ref.dep)            │
   │ 遍历所有依赖 count 的 effect        │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ effect.scheduler()                 │
   │ queuePreFlushCb(update)            │
   │ 加入微任务队列                      │
   └────────────┬───────────────────────┘
                │ Promise.resolve().then
                ▼
   ┌────────────────────────────────────┐
   │ update() → effect.run()            │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │ componentUpdateFn (更新渲染)        │
   │ 1. 调用 beforeUpdate                │
   │ 2. renderComponentRoot()            │
   │    - 执行 render 函数               │
   │    - 访问 count.value → track       │
   │    - 生成新的 subTree               │
   │ 3. patch(prevTree, nextTree)        │
   │    - patchElement('p')              │
   │    - patchText('0' → '1')           │
   │ 4. 调用 updated                     │
   └────────────────────────────────────┘
```

---

## 关键数据结构

### 1. targetMap (依赖关系图)

```typescript
targetMap (WeakMap)
  └─ reactiveObj → depsMap (Map)
       ├─ 'count' → dep (Set)
       │    ├─ effect1 (组件渲染 effect)
       │    └─ effect2 (watch effect)
       └─ 'name' → dep (Set)
            └─ effect1

// 结构示意
WeakMap {
  reactiveObj => Map {
    'count' => Set { effect1, effect2 },
    'name' => Set { effect1 }
  }
}
```

### 2. VNode 结构

```typescript
interface VNode {
  type: string | Component  // 元素类型或组件
  props: Record<string, any> | null  // 属性
  children: string | VNode[] | null  // 子节点
  shapeFlag: number  // 形状标志 (ELEMENT, COMPONENT, TEXT_CHILDREN, etc.)
  key: string | number | null  // key
  el: HTMLElement | null  // 对应的真实 DOM
  component?: ComponentInstance  // 组件实例 (如果是组件节点)
  // ...
}
```

### 3. Component Instance 结构

```typescript
interface ComponentInstance {
  vnode: VNode  // 当前 vnode
  type: Component  // 组件定义
  props: Record<string, any>  // 解析后的 props
  setupState: any  // setup 返回值
  render: Function  // 渲染函数
  subTree: VNode  // 渲染的子树
  effect: ReactiveEffect  // 渲染 effect
  update: Function  // 更新函数
  isMounted: boolean  // 是否已挂载
  container: any  // 容器
  anchor: any  // 锚点
  // 生命周期钩子
  bm?: Function  // beforeMount
  m?: Function  // mounted
  bu?: Function  // beforeUpdate
  u?: Function  // updated
}
```

---

## 性能优化策略

### 1. 响应式优化

- **缓存机制**: reactive 对象使用 WeakMap 缓存,避免重复代理
- **懒求值**: computed 只有在访问时才计算,且有缓存
- **精确追踪**: 只追踪实际访问的属性,而非整个对象

### 2. 渲染优化

- **虚拟 DOM**: 减少直接 DOM 操作
- **Diff 算法**: 
  - 前后指针优化 (同层比较)
  - LIS 算法 (最少移动次数)
  - Keyed 节点优化
- **批量更新**: scheduler 将多次更新合并为一次

### 3. 编译器优化

- **静态提升**: 静态节点只创建一次
- **预字符串化**: 连续静态文本合并
- **补丁标志**: 标记动态内容,跳过静态部分

---

## 总结

Vue Next Mini 实现了 Vue 3 的核心功能:

1. **响应式系统**: 基于 Proxy + Effect + Dep 的依赖追踪机制
2. **虚拟 DOM**: 高效的 diff 算法和 DOM 更新策略
3. **组件系统**: 完整的生命周期管理和状态管理
4. **模板编译**: 三阶段编译流程 (Parse → Transform → Codegen)

这个精简版本保留了核心架构,非常适合学习 Vue 3 的设计思想和实现原理。
