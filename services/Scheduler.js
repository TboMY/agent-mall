const axios = require('axios')
const SystemConfig = require('../models/SystemConfig')

// 简单的定时任务调度器：根据配置的每天执行时间触发一次AI分析
class Scheduler {
  constructor () {
    this.currentTimer = null
    this.lastPlannedAt = null
  }

  async init () {
    await this.reset()
  }

  async reset () {
    // 清理上一个未执行的任务
    this.clear()

    try {
      const cfg = await SystemConfig.getAIWorkbenchConfig()
      const enabled = !!cfg?.scheduledTask?.enabled
      const timeStr = cfg?.scheduledTask?.executionTime || '00:00'

      if (!enabled) {
        console.log('[Scheduler] 定时任务未启用，已跳过')
        return
      }

      const nextTime = this.computeNextRunTime(timeStr)
      const delayMs = Math.max(0, nextTime.getTime() - Date.now())
      this.lastPlannedAt = nextTime

      this.currentTimer = setTimeout(async () => {
        this.currentTimer = null
        await this.runOnceSafely()
        // 运行完成后，按配置再次计划下一次
        await this.reset()
      }, delayMs)

      console.log(`[Scheduler] 已安排下次AI分析时间: ${nextTime.toLocaleString()}`)
    } catch (e) {
      console.error('[Scheduler] 重置任务失败:', e)
    }
  }

  clear () {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer)
      this.currentTimer = null
      console.log('[Scheduler] 已清理未执行的定时任务')
    }
  }

  computeNextRunTime (hhmm) {
    const [hh, mm] = String(hhmm || '00:00').split(':').map(s => parseInt(s, 10) || 0)
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
    if (next.getTime() <= now.getTime()) {
      // 已过今天时间，安排到明天
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  async runOnceSafely () {
    try {
      const port = process.env.PORT || 3000
      const baseURL = process.env.SCHEDULER_BASE_URL || `http://localhost:${port}`
      console.log('[Scheduler] 触发AI分析(定时模式): POST /api/aweme/analyze')
      await axios.post(`${baseURL}/api/aweme/analyze`, { scheduled: true })
      console.log('[Scheduler] AI分析触发完成')
    } catch (e) {
      console.error('[Scheduler] 触发AI分析失败:', e?.response?.data || e.message)
    }
  }
}

module.exports = new Scheduler()


