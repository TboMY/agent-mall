const SystemConfig = require('../models/SystemConfig')
const WorkbenchPipelineService = require('./WorkbenchPipelineService')

const DEFAULT_HOTLIST_REFRESH_TIMES = ['09:00', '15:00', '21:00']

// 调度器：维护两类独立任务
// 1. 热点池刷新：固定在 09:00 / 15:00 / 21:00 执行
// 2. AI选品采集：按工作台配置的 executionTime 执行
class Scheduler {
  constructor () {
    this.hotlistRefreshTimer = null
    this.collectionTimer = null
    this.lastHotlistRefreshAt = null
    this.lastCollectionAt = null
  }

  async init () {
    await this.reset()
  }

  async reset () {
    this.clear()

    try {
      const cfg = await SystemConfig.getAIWorkbenchConfig()
      await this.scheduleHotlistRefresh()
      await this.scheduleCollectionRun(cfg)
    } catch (e) {
      console.error('[Scheduler] 重置任务失败:', e)
    }
  }

  clear () {
    if (this.hotlistRefreshTimer) {
      clearTimeout(this.hotlistRefreshTimer)
      this.hotlistRefreshTimer = null
    }
    if (this.collectionTimer) {
      clearTimeout(this.collectionTimer)
      this.collectionTimer = null
    }
    if (this.lastHotlistRefreshAt || this.lastCollectionAt) {
      console.log('[Scheduler] 已清理未执行的定时任务')
    }
    this.lastHotlistRefreshAt = null
    this.lastCollectionAt = null
  }

  normalizeExecutionTimes (executionTimes, fallbackTime = '09:00') {
    const times = Array.isArray(executionTimes) ? executionTimes : [fallbackTime]
    const normalized = Array.from(new Set(
      times
        .map(value => String(value || '').trim())
        .filter(value => /^\d{2}:\d{2}$/.test(value))
    )).sort()

    return normalized.length > 0 ? normalized : ['09:00', '15:00', '21:00']
  }

  getExecutionTimes () {
    return [...DEFAULT_HOTLIST_REFRESH_TIMES]
  }

  normalizeSingleExecutionTime (executionTime, fallbackTime = '09:00') {
    const value = String(executionTime || '').trim()
    return /^\d{2}:\d{2}$/.test(value) ? value : fallbackTime
  }

  computeNextRunTime (executionTimes) {
    const now = new Date()
    const candidates = this.normalizeExecutionTimes(executionTimes).map(hhmm => {
      const [hh, mm] = String(hhmm).split(':').map(s => parseInt(s, 10) || 0)
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
    })
    const todayFuture = candidates.find(item => item.getTime() > now.getTime())
    if (todayFuture) {
      return todayFuture
    }
    const nextDay = new Date(candidates[0])
    nextDay.setDate(nextDay.getDate() + 1)
    return nextDay
  }

  async scheduleHotlistRefresh () {
    const executionTimes = this.getExecutionTimes()
    const nextTime = this.computeNextRunTime(executionTimes)
    const delayMs = Math.max(0, nextTime.getTime() - Date.now())
    this.lastHotlistRefreshAt = nextTime

    this.hotlistRefreshTimer = setTimeout(async () => {
      this.hotlistRefreshTimer = null
      await this.runHotlistRefreshSafely()
      await this.scheduleHotlistRefresh()
    }, delayMs)

    console.log(`[Scheduler] 已安排下次热点池刷新时间: ${nextTime.toLocaleString()}，今日执行点: ${executionTimes.join(', ')}`)
  }

  async scheduleCollectionRun (cfg) {
    const enabled = !!cfg?.scheduledTask?.enabled
    const executionTime = this.normalizeSingleExecutionTime(cfg?.scheduledTask?.executionTime, '09:00')

    if (!enabled) {
      console.log('[Scheduler] AI选品定时任务未启用，已跳过')
      return
    }

    const nextTime = this.computeNextRunTime([executionTime])
    const delayMs = Math.max(0, nextTime.getTime() - Date.now())
    this.lastCollectionAt = nextTime

    this.collectionTimer = setTimeout(async () => {
      this.collectionTimer = null
      await this.runCollectionSafely()
      const latestConfig = await SystemConfig.getAIWorkbenchConfig()
      await this.scheduleCollectionRun(latestConfig)
    }, delayMs)

    console.log(`[Scheduler] 已安排下次AI选品执行时间: ${nextTime.toLocaleString()}，执行点: ${executionTime}`)
  }

  async runHotlistRefreshSafely () {
    try {
      console.log('[Scheduler] 触发热点池刷新任务')
      await WorkbenchPipelineService.refreshKeywordPool()
      console.log('[Scheduler] 热点池刷新任务触发完成')
    } catch (e) {
      console.error('[Scheduler] 触发热点池刷新任务失败:', e?.response?.data || e.message)
    }
  }

  async runCollectionSafely () {
    try {
      console.log('[Scheduler] 触发AI选品定时任务')
      await WorkbenchPipelineService.runCollectionPipeline({ mode: 'scheduled' })
      console.log('[Scheduler] AI选品定时任务触发完成')
    } catch (e) {
      console.error('[Scheduler] 触发AI选品定时任务失败:', e?.response?.data || e.message)
    }
  }
}

module.exports = new Scheduler()


