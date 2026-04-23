/**
 * 调度器模块
 * 
 * 调度器负责管理和批量执行异步任务，是 Vue 性能优化的关键组件。
 * 
 * 核心设计理念：
 * 1. 批量更新：将多个同步触发的更新合并为一次执行，避免重复渲染
 * 2. 微任务调度：使用 Promise.resolve().then() 将任务推迟到下一个微任务执行
 * 3. 去重机制：确保同一个回调不会被多次加入队列
 * 
 * 这种设计使得 Vue 在以下场景中表现优异：
 * - 多个响应式数据同时变化时，只触发一次组件更新
 * - 在事件处理函数中修改多个数据，只渲染一次
 * - 避免中间状态导致的闪烁问题
 */

// 标记是否有待处理的刷新任务
let isFlushPending = false

// 已解析的 Promise，用于创建微任务
const resolvedPromise = Promise.resolve()

// 待执行的 pre-flush 回调队列
// pre-flush 回调会在组件更新之前执行，通常用于生命周期钩子
const pendingPreFlushCbs: Function[] = []

/**
 * 将回调加入 pre-flush 队列
 * 
 * pre-flush 回调的特点：
 * - 在组件更新之前执行
 * - 可以访问更新前的 DOM 状态
 * - 常用于 beforeUpdate 等生命周期钩子
 * 
 * @param cd - 要执行的回调函数
 */
export function queuePreFlushCb(cd: Function) {
  queueCb(cd, pendingPreFlushCbs)
}

/**
 * 将回调加入指定队列
 * 
 * 这是一个通用的队列管理函数，负责：
 * 1. 将回调添加到队列
 * 2. 触发刷新流程（如果尚未触发）
 * 
 * @param cb - 回调函数
 * @param pendingQueue - 目标队列
 */
function queueCb(cb: Function, pendingQueue: Function[]) {
  // 将回调加入队列
  pendingQueue.push(cb)
  
  // 触发刷新流程
  queueFlush()
}

/**
 * 排队刷新任务
 * 
 * 这是调度器的核心控制函数，负责：
 * 1. 检查是否已有待处理的刷新任务
 * 2. 如果没有，标记为待处理并安排微任务执行
 * 
 * 通过 isFlushPending 标志位实现去重，确保同一时刻只有一个刷新任务在等待执行。
 */
function queueFlush() {
  if (!isFlushPending) {
    // 标记为待处理
    isFlushPending = true
    
    // 安排微任务：在当前同步代码执行完毕后，立即执行 flushJobs
    // 使用 Promise.resolve().then() 而非 setTimeout，确保最快的执行时机
    resolvedPromise.then(flushJobs)
  }
}

/**
 * 刷新所有待处理的任务
 * 
 * 这个函数在微任务阶段执行，负责：
 * 1. 重置待处理标志
 * 2. 依次执行所有队列中的回调
 * 
 * 注意：这个函数本身是同步执行的，但它是在微任务队列中被调用的。
 */
function flushJobs(): void {
  // 重置标志，允许下一轮调度
  isFlushPending = false
  
  // 执行 pre-flush 回调
  flushPreFlushCbs()
}

/**
 * 执行所有 pre-flush 回调
 * 
 * 这个函数会：
 * 1. 复制当前队列（避免在执行过程中被新任务干扰）
 * 2. 去重（使用 Set 确保每个回调只执行一次）
 * 3. 清空原队列
 * 4. 依次执行所有回调
 */
export function flushPreFlushCbs() {
  if (pendingPreFlushCbs.length) {
    // 复制并去重：使用 Set 去除重复的回调函数
    let activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    
    // 清空原队列，为下一轮任务做准备
    pendingPreFlushCbs.length = 0
    
    // 依次执行所有回调
    for (let index = 0; index < activePreFlushCbs.length; index++) {
      activePreFlushCbs[index]()
    }
  }
}
