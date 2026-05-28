const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

function firstExistingPath(paths = []) {
  for (const item of paths) {
    if (!item) continue;
    try {
      if (fs.existsSync(item)) {
        return item;
      }
    } catch (_) {
      // ignore invalid candidate paths
    }
  }
  return null;
}

function resolveFromWhere() {
  try {
    const result = spawnSync('where.exe', ['claude'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    });
    const stdout = String(result.stdout || '').trim();
    if (!stdout) return null;
    const lines = stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    for (const line of lines) {
      if (/claude\.exe$/i.test(line) && fs.existsSync(line)) {
        return line;
      }
      if (/claude\.(ps1|cmd|bat)$/i.test(line) && fs.existsSync(line)) {
        const baseDir = path.dirname(line);
        const exeCandidate = path.join(baseDir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
        if (fs.existsSync(exeCandidate)) {
          return exeCandidate;
        }
      }
    }
  } catch (_) {
    // ignore lookup failure
  }
  return null;
}

class ClaudeCodeRunner {
  constructor(options = {}) {
    this.model = String(options.model || 'sonnet').trim();
    this.timeoutMs = Number(options.timeoutMs || 300000);
    this.cwd = options.cwd || process.cwd();
    this.maxBudgetUsd = options.maxBudgetUsd;
    this.executablePath = this.resolveExecutablePath(options.executablePath);
  }

  resolveExecutablePath(explicitPath) {
    const candidates = [
      explicitPath,
      process.env.CLAUDE_CODE_EXECUTABLE_PATH,
      process.env.CLAUDE_CODE_PATH,
      process.env.NVM_SYMLINK
        ? path.join(process.env.NVM_SYMLINK, 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
        : null,
      process.env.APPDATA
        ? path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
        : null
    ];
    return firstExistingPath(candidates) || resolveFromWhere() || 'claude';
  }

  buildArgs({ prompt, schema, timeoutMs = null, model = null }) {
    const args = [
      '-p',
      '--model', String(model || this.model),
      '--output-format', 'json',
      '--json-schema', JSON.stringify(schema),
      '--permission-mode', 'bypassPermissions',
      '--setting-sources', 'user'
    ];

    if (Number.isFinite(Number(this.maxBudgetUsd)) && Number(this.maxBudgetUsd) > 0) {
      args.push('--max-budget-usd', String(this.maxBudgetUsd));
    }

    args.push(prompt);
    return args;
  }

  async runStructuredPrompt({ prompt, schema, timeoutMs = null, model = null } = {}) {
    if (!prompt) {
      throw new Error('Claude prompt is required');
    }
    if (!schema || typeof schema !== 'object') {
      throw new Error('Claude structured output schema is required');
    }

    const spawnTimeout = Number(timeoutMs || this.timeoutMs);
    const args = this.buildArgs({ prompt, schema, timeoutMs: spawnTimeout, model });
    const resolvedModel = String(model || this.model);
    console.log(`[claude-runner] start executable=${this.executablePath} model=${resolvedModel} timeoutMs=${spawnTimeout}`);

    return await new Promise((resolve, reject) => {
      const child = spawn(this.executablePath, args, {
        cwd: this.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        child.kill('SIGTERM');
        console.error(`[claude-runner] timeout model=${resolvedModel} timeoutMs=${spawnTimeout}`);
        reject(new Error(`claude command timed out after ${spawnTimeout}ms`));
      }, spawnTimeout);

      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      child.on('error', error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        console.error(`[claude-runner] process error model=${resolvedModel} error=${error.message}`);
        reject(error);
      });

      child.on('close', code => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        console.log(`[claude-runner] process closed model=${resolvedModel} code=${code}`);

        if (code !== 0) {
          const message = stderr.trim() || stdout.trim() || `claude exited with code ${code}`;
          console.error(`[claude-runner] failed model=${resolvedModel} message=${message.slice(0, 300)}`);
          reject(new Error(message));
          return;
        }

        try {
          const raw = JSON.parse(stdout.trim());
          const structured = raw.structured_output
            || (raw.result ? JSON.parse(raw.result) : null);
          if (!structured) {
            throw new Error('missing structured_output');
          }
          console.log(`[claude-runner] success model=${resolvedModel} sessionId=${raw.session_id || '-'} durationMs=${raw.duration_ms || '-'} cost=${raw.total_cost_usd || 0}`);
          resolve({
            raw,
            structured
          });
        } catch (error) {
          console.error(`[claude-runner] parse failed model=${resolvedModel} error=${error.message}`);
          reject(new Error(`failed to parse claude output: ${error.message}`));
        }
      });
    });
  }
}

module.exports = ClaudeCodeRunner;
