# Vue Next Mini 快速参考卡片

## 🎯 核心 API 速查

### Reactivity (响应式系统)

#### reactive - 创建响应式对象

```typescript
import { reactive, effect } from '@vue/reactivity'

const state = reactive({ count: 0, name: 'Vue' })

effect(() => {
  console.log(state.count) // 自动追踪依赖
})

state.count++ // 触发更新
```

**关键点:**
- ✅ 用于对象类型
- ✅ 自动深度转换嵌套对象
- ✅ 通过 Proxy 实现
- ❌ 不能用于基本类型

---

#### ref - 创建响应式引用

```typescript
import { ref, effect } from '@vue/reactivity'

const count = ref(0)
const name = ref('Vue')

effect(() => {
  console.log(count.value) // 必须通过 .value 访问
})

count.value++ // 触发更新
```

**关键点:**
- ✅ 用于任意类型(基本类型、对象、数组)
- ✅ 通过 `.value` 访问
- ✅ 对象会自动转为 reactive
- 💡 适合模板中使用

---

#### computed - 创建计算属性

```typescript
import { ref, computed } from '@vue/reactivity'

const count = ref(0)
const doubleCount = computed(() => count.value * 2)

console.log(doubleCount.value) // 0 (首次计算)
console.log(doubleCount.value) // 0 (使用缓存,不重新计算)

count.value = 5
console.log(doubleCount.value) // 10 (重新计算)
```

**关键点:**
- ✅ 懒求值(只在访问时计算)
- ✅ 缓存机制(依赖不变时返回缓存)
- ✅ 自动追踪依赖
- 💡 适合派生状态

---

#### effect - 创建副作用

```typescript
import { reactive, effect } from '@vue/reactivity'

const state = reactive({ count: 0 })

// 基本用法
effect(() => {
  console.log('count is:', state.count)
})

// 懒执行
const e = effect(() => {
  console.log(state.count)
}, { lazy: true })

e.run() // 手动执行

// 自定义调度器
effect(() => {
  console.log(state.count)
}, {
  scheduler: () => {
    // 异步批量执行
    Promise.resolve().then(() => {
      console.log('batch update')
    })
  }
})
```

**关键点:**
- ✅ 自动追踪依赖
- ✅ 依赖变化时自动重新执行
- ✅ 支持懒执行和自定义调度器
- 💡 组件渲染的核心机制

---

### 工具函数

#### isRef - 判断是否为 Ref

```typescript
import { ref, isRef } from '@vue/reactivity'

const r = ref(0)
console.log(isRef(r)) // true

const obj = { value: 0 }
console.log(isRef(obj)) // false
```

---

#### isReactive - 判断是否为响应式对象

```typescript
import { reactive, isReactive } from '@vue/reactivity'

const state = reactive({ count: 0 })
console.log(isReactive(state)) // true

const obj = { count: 0 }
console.log(isReactive(obj)) // false
```

---

## 🔄 工作流程速查

### 依赖收集流程

```
effect(() => {
  console.log(state.count)
})
     ↓
设置 activeEffect = 当前 effect
     ↓
执行 fn(),访问 state.count
     ↓
触发 Proxy.get 拦截器
     ↓
track(state, 'count')
     ↓
从 targetMap 获取 depsMap
     ↓
从 depsMap 获取 dep (Set)
     ↓
dep.add(activeEffect)
     ↓
建立映射: state.count → effect
```

---

### 触发更新流程

```
state.count++
     ↓
触发 Proxy.set 拦截器
     ↓
trigger(state, 'count')
     ↓
从 targetMap 获取 depsMap
     ↓
从 depsMap 获取 dep (Set)
     ↓
遍历 dep 中的所有 effect
     ↓
对每个 effect:
  ├─ 有 scheduler? → 调用 scheduler()
  └─ 没有? → 直接 effect.run()
     ↓
所有依赖的 effect 重新执行
```

---

### Computed 工作流程

```
const double = computed(() => count.value * 2)
     ↓
创建 ComputedRefImpl
  - effect: ReactiveEffect(getter, scheduler)
  - _dirty: true
  - _value: undefined
  - dep: undefined
     ↓
访问 double.value
     ↓
trackRefValue(double) // 收集依赖
     ↓
检查 _dirty === true?
  ├─ Yes → 执行 effect.run()
  │         - 执行 getter
  │         - 收集 getter 中的依赖
  │         - 缓存结果到 _value
  │         - 设置 _dirty = false
  └─ No  → 直接返回 _value
     ↓
返回计算结果

━━━━━━━━━━━━━━━━━━━━━━

修改依赖: count.value++
     ↓
触发 computed 的 scheduler
     ↓
设置 _dirty = true
     ↓
triggerRefValue(double)
     ↓
通知依赖 double 的 effect

━━━━━━━━━━━━━━━━━━━━━━

再次访问 double.value
     ↓
_dirty === true,重新计算
```

---

## 📊 数据结构速查

### targetMap (全局依赖映射表)

```typescript
targetMap: WeakMap<object, Map<string | symbol, Set<ReactiveEffect>>>

// 示例结构
WeakMap {
  reactiveObj => Map {
    'count' => Set([effect1, effect2]),
    'name' => Set([effect1])
  },
  anotherObj => Map {
    'value' => Set([effect3])
  }
}
```

---

### ReactiveEffect

```typescript
class ReactiveEffect {
  fn: () => T              // 副作用函数
  scheduler?: () => void   // 调度器
  deps: Dep[]              // 依赖的 dep 集合
  computed?: ComputedRefImpl // 关联的 computed(如果有)
  
  run() {                  // 执行副作用函数
    activeEffect = this
    return this.fn()
  }
  
  stop() {}                // 停止 effect
}
```

---

### Ref

```typescript
interface Ref<T> {
  value: T                 // 访问器属性(getter/setter)
  __v_isRef: true          // 标识
  dep?: Dep                // 依赖集合
}

class RefImpl<T> implements Ref<T> {
  private _value: T        // 响应式处理后的值
  private _rawValue: T     // 原始值
  public __v_isRef = true
  public dep?: Dep
  
  get value() {
    trackRefValue(this)
    return this._value
  }
  
  set value(newValue) {
    if (hasChanged(newValue, this._rawValue)) {
      this._rawValue = newValue
      this._value = toReactive(newValue)
      triggerRefValue(this)
    }
  }
}
```

---

### ComputedRefImpl

```typescript
class ComputedRefImpl<T> {
  public dep?: Dep                    // 依赖此 computed 的 effect
  public _value!: T                   // 缓存的计算结果
  public readonly effect: ReactiveEffect<T>
  public readonly __v_isRef = true
  private _dirty = true               // 是否需要重新计算
  
  constructor(getter) {
    this.effect = new ReactiveEffect(
      getter,
      () => {                         // scheduler
        if (!this._dirty) {
          this._dirty = true
          triggerRefValue(this)
        }
      }
    )
    this.effect.computed = this
  }
  
  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }
}
```

---

## 🎨 对比表格

### reactive vs ref

| 特性 | reactive | ref |
|------|----------|-----|
| 适用类型 | 对象(Array, Object, Map, Set) | 任意类型 |
| 访问方式 | 直接访问属性 | 通过 `.value` |
| 实现方式 | Proxy | getter/setter |
| 嵌套对象 | 自动递归转换 | 需要手动 reactive |
| 解构 | ❌ 会丢失响应性 | ✅ 安全 |
| 模板使用 | 需要展开 `{...state}` | 直接使用 `{{ count }}` |

**最佳实践:**
- 对象类型 → 优先使用 `reactive`
- 基本类型 → 使用 `ref`
- 需要在模板中单独使用 → 使用 `ref`
- 多个相关属性 → 使用 `reactive`

---

### effect vs computed

| 特性 | effect | computed |
|------|--------|----------|
| 返回值 | 无(或忽略) | 有(缓存) |
| 执行时机 | 依赖变化时立即执行 | 访问时才执行(懒) |
| 缓存 | ❌ 无 | ✅ 有 |
| 用途 | 副作用(日志、DOM更新) | 派生状态 |
| 可写性 | N/A | 只读(默认) |

**最佳实践:**
- 需要执行副作用 → 使用 `effect`
- 需要计算派生值 → 使用 `computed`
- 避免在模板中进行复杂计算 → 用 `computed`

---

## ⚡ 性能优化要点

### 1. 缓存策略

```typescript
// ✅ 好: 使用 computed 缓存计算结果
const doubleCount = computed(() => count.value * 2)

// ❌ 差: 每次访问都重新计算
function getDoubleCount() {
  return count.value * 2
}
```

---

### 2. 避免不必要的更新

```typescript
// ✅ 好: hasChanged 检查
set value(newValue) {
  if (hasChanged(newValue, this._rawValue)) {
    // 只有真正变化才触发更新
  }
}

// ❌ 差: 每次都触发更新
set value(newValue) {
  this._rawValue = newValue
  triggerRefValue(this) // 即使值没变也触发
}
```

---

### 3. 批量更新

```typescript
// ✅ 好: 使用 scheduler 批量更新
effect(() => {
  console.log(state.count)
}, {
  scheduler: () => {
    // 异步批量执行
    queueJob(update)
  }
})

// ❌ 差: 同步多次更新
state.count++ // 触发更新 1
state.count++ // 触发更新 2
state.count++ // 触发更新 3
```

---

### 4. 懒求值

```typescript
// ✅ 好: computed 懒求值
const expensive = computed(() => {
  // 复杂计算
  return heavyComputation()
})
// 只有在访问时才计算

// ❌ 差: effect 立即执行
effect(() => {
  // 复杂计算
  const result = heavyComputation()
})
// 依赖变化时立即重新计算
```

---

## 🐛 常见陷阱

### 1. 解构丢失响应性

```typescript
// ❌ 错误
const state = reactive({ count: 0 })
const { count } = state // 丢失响应性
effect(() => {
  console.log(count) // 不会追踪依赖
})

// ✅ 正确
const state = reactive({ count: 0 })
effect(() => {
  console.log(state.count) // 正确追踪
})

// ✅ 或者使用 ref
const count = ref(0)
effect(() => {
  console.log(count.value) // 正确追踪
})
```

---

### 2. 忘记访问 .value

```typescript
// ❌ 错误
const count = ref(0)
effect(() => {
  console.log(count) // Ref 对象,不是值
})

// ✅ 正确
const count = ref(0)
effect(() => {
  console.log(count.value) // 正确的值
})
```

---

### 3. Computed 中产生副作用

```typescript
// ❌ 错误
const doubleCount = computed(() => {
  console.log('calculating') // 副作用!
  return count.value * 2
})

// ✅ 正确
const doubleCount = computed(() => {
  return count.value * 2 // 纯函数
})

effect(() => {
  console.log('calculating') // 副作用放在 effect 中
  console.log(doubleCount.value)
})
```

---

### 4. 循环依赖

```typescript
// ❌ 错误: 可能导致无限循环
const a = ref(0)
const b = computed(() => a.value + 1)

effect(() => {
  a.value = b.value // effect 中修改依赖的数据
})

// ✅ 正确: 避免在 effect 中修改依赖的数据
effect(() => {
  console.log(b.value) // 只读,不修改
})
```

---

## 📚 学习资源

### 官方文档
- Vue 3 官方文档: https://cn.vuejs.org/
- Reactivity API: https://cn.vuejs.org/api/reactivity-core.html

### 源码阅读顺序
1. reactivity/effect.ts - 依赖追踪核心
2. reactivity/reactive.ts - Proxy 代理
3. reactivity/ref.ts - 值包装
4. reactivity/computed.ts - 计算属性
5. runtime-core/renderer.ts - 渲染引擎
6. compiler-core/parse.ts - 模板解析

### 调试技巧
```typescript
// 1. 打印 targetMap 查看依赖关系
console.log('targetMap:', targetMap)

// 2. 打印 effect.deps 查看依赖的 dep
const e = effect(() => {
  console.log(state.count)
})
console.log('effect deps:', e.deps)

// 3. 打印 ref.dep 查看依赖的 effect
const count = ref(0)
effect(() => {
  console.log(count.value)
})
console.log('ref dep:', count.dep)

// 4. 使用 debugger 断点
effect(() => {
  debugger // 在依赖收集时暂停
  console.log(state.count)
})
```

---

## 🎓 面试常见问题

### Q1: Vue 3 响应式原理是什么?

**A:** 
- 使用 Proxy 替代 Object.defineProperty
- 通过 track 收集依赖,trigger 触发更新
- 使用 WeakMap 缓存避免内存泄漏
- 支持 Map、Set 等新数据结构

---

### Q2: reactive 和 ref 的区别?

**A:**
- reactive 用于对象,ref 用于任意类型
- reactive 直接访问属性,ref 需要 .value
- reactive 基于 Proxy,ref 基于 getter/setter
- reactive 解构会丢失响应性,ref 不会

---

### Q3: computed 如何实现缓存?

**A:**
- 使用 _dirty 标志位
- 首次访问或依赖变化时 _dirty = true,执行计算
- 计算后 _dirty = false,后续访问直接返回缓存
- 依赖变化时通过 scheduler 标记 _dirty = true

---

### Q4: 为什么使用 WeakMap?

**A:**
- 避免内存泄漏:key 被回收时,value 自动回收
- 可以以对象为 key
- 适合存储对象相关的元数据

---

### Q5: effect 的 scheduler 有什么用?

**A:**
- 控制 effect 重新执行的时机
- 实现异步批量更新
- computed 用它来标记 dirty 而非立即执行
- watch 用它来防抖或节流

---

**祝学习顺利! 🚀**
