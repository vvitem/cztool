import { app, BrowserWindow, shell, ipcMain, Tray, Menu, dialog, MessageBoxOptions } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import fetch from 'node-fetch'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import AutoLaunch from 'auto-launch'
import { registerRulesIpc } from './rules'
import { registerUpdateIpc, scheduleAutoUpdateCheck } from './update'

const execAsync = promisify(exec)

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 设置 ffmpeg 路径
if (process.platform === 'win32') {
  const ffmpegPath = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg')
    : path.join(__dirname, '../../resources/ffmpeg')
  process.env.PATH = `${ffmpegPath};${process.env.PATH}`
}

// 在文件顶部添加
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// 禁用 Electron Security Warning
process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 'false'

// 配置日志级别
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_LOG_LEVEL = 'error'
}

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray = null;
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// 在 app.whenReady() 之前添加数据库初始化代码
const dbPath = path.join(app.getPath('userData'), 'data.db')
const db = new Database(dbPath)

// 创建历史记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    moduleName TEXT NOT NULL,
    appName TEXT NOT NULL,
    operationTime INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL
  );
  PRAGMA page_size = 65536;
  PRAGMA encoding = 'UTF-8';
`)

// 添加一些测试数据
const insertTestData = () => {
  const stmt = db.prepare(`
    INSERT INTO history (moduleName, appName, operationTime, content, status)
    VALUES (?, ?, ?, ?, ?)
  `)

  // 检查是否已有数据
  const { count } = db.prepare('SELECT COUNT(*) as count FROM history').get()
}

// 在开发环境下添加测试数据
if (process.env.NODE_ENV === 'development') {
  insertTestData()
}

interface HistoryRecord {
  id?: number
  moduleName: string
  appName: string
  content: string
  operationTime?: number
  status: 'success' | 'error' | 'running'
}

// 历史记录相关 IPC 处理
ipcMain.handle('history:add', async (_, record: HistoryRecord) => {
  try {
    const { moduleName, appName, content, status } = record
    
    // 添加日志以追踪内容长度
    console.log('Adding history record:')
    console.log('Content length:', content?.length)
    console.log('Content preview:', content?.substring(0, 100))
    
    const stmt = db.prepare(`
      INSERT INTO history (moduleName, appName, operationTime, content, status) 
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(moduleName, appName, Date.now(), content, status)
    
    // 验证存储的内容
    const newRecord = db.prepare('SELECT * FROM history WHERE id = ?').get(result.lastInsertRowid)
    console.log('Stored record content length:', newRecord.content?.length)
    console.log('Stored content preview:', newRecord.content?.substring(0, 100))
    
    return newRecord
  } catch (error) {
    console.error('Failed to add history:', error)
    throw new Error('添加历史记录失败')
  }
})

ipcMain.handle('history:list', async (_, params: { page: number; pageSize: number }) => {
  try {
    const { page = 1, pageSize = 10 } = params
    const offset = (page - 1) * pageSize

    // 获取总记录数
    const { total } = db.prepare('SELECT COUNT(*) as total FROM history').get()

    // 获取分页数据
    const records = db.prepare(`
      SELECT * FROM history 
      ORDER BY operationTime DESC 
      LIMIT ? OFFSET ?
    `).all(pageSize, offset)

    return {
      records,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  } catch (error) {
    console.error('Failed to get history:', error)
    throw new Error('获取历史记录失败')
  }
})

ipcMain.handle('history:clear', async (_, id: number) => {
  try {
    const stmt = db.prepare('DELETE FROM history WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  } catch (error) {
    console.error('Failed to clear history:', error)
    throw new Error('清除历史记录失败')
  }
})

ipcMain.handle('history:clear-all', async () => {
  try {
    const result = db.prepare('DELETE FROM history').run()
    return { success: true, deleted: result.changes }
  } catch (error) {
    console.error('Failed to clear all history:', error)
    throw new Error('清除全部历史记录失败')
  }
})

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    minWidth: 1000,
    minHeight: 800,
    width: 1000,
    height: 800,
    webPreferences: {
      preload,
      nodeIntegration: true,
      webSecurity: process.env.NODE_ENV !== 'development',
      devTools: process.env.NODE_ENV === 'development',
      allowRunningInsecureContent: true,
    },
    frame: false,
  })

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });

  console.log(__dirname)
  console.log(process.env.VITE_PUBLIC)

  // 创建系统托盘图标
  tray = new Tray(path.join(process.env.VITE_PUBLIC, 'logo.png'));
  tray.setToolTip('cztool')
  tray.on('double-click', () => {
    // 处理双击事件，例如显示窗口
    if (!win.isVisible()) {
      win.show();
    }
  })
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开',
      click: () => {
        win.show();
      },
    },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
    
    // 配置开发者工具
    win.webContents.on('devtools-opened', () => {
      // 延迟执行以确保 DevTools 完全加载
      setTimeout(() => {
        win?.webContents.executeJavaScript(`
          // 禁用所有 CDP 警告
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__.consoleManagedByDevTools = true;
          }
        `).catch(console.error);
      }, 1000);
    });
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
    // 禁用自动填充
    win?.webContents.executeJavaScript(`
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister())
      });
    `).catch(console.error);
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  // 设置开发者工具选项
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  win.webContents.session.setDevicePermissionHandler(() => true);

  scheduleAutoUpdateCheck(4000)
}

app.whenReady().then(createWindow)

// 添加窗口控制事件处理
ipcMain.on('minimize-window', () => {
  if (win) {
    win.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (win) {
    win.close();
  }
});

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
  app.exit();
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

ipcMain.handle('show-message', async (_, args) => {
  const { type, title, message, width = 350, height = 250 } = args
  if (win) {
    const messageWindow = new BrowserWindow({
      parent: win,
      modal: true,
      width: width,
      height: height,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload
      },
      frame: false,
      resizable: false,
      backgroundColor: '#f5f5f5'
    })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
              background: #fff;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 15px;
            }
            .input-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .input-group label {
              font-size: 14px;
              color: #333;
            }
            .input-group input {
              padding: 8px 12px;
              border: 1px solid #dcdfe6;
              border-radius: 4px;
              font-size: 14px;
              width: 100%;
              box-sizing: border-box;
            }
            .input-group input:focus {
              outline: none;
              border-color: #409eff;
            }
            .button-group {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 10px;
            }
            .button {
              padding: 8px 15px;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            .primary {
              background: #409eff;
              color: white;
            }
            .primary:hover {
              background: #66b1ff;
            }
            .default {
              background: #f4f4f5;
              color: #606266;
            }
            .default:hover {
              background: #e9e9eb;
            }
            .result {
              display: none;
              margin-top: 15px;
              padding: 15px;
              border-radius: 4px;
              background: #f8f9fa;
            }
            .result.show {
              display: ${type === 'douyin' ? 'none' : 'block'};
            }
            .result-item {
              margin-bottom: 10px;
              font-size: 14px;
              line-height: 1.4;
            }
            .result-label {
              color: #606266;
              margin-right: 8px;
            }
            .result-value {
              color: #333;
            }
            .error-message {
              color: #f56c6c;
              font-size: 14px;
            }
            .placeholder-message {
              color: #909399;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="input-group">
              <label for="input">${message}</label>
              <input 
                type="text" 
                id="input" 
                value="" 
                placeholder="${type === 'douyin' ? '请输入视频分享链接' : '请输入QQ号'}"
              >
            </div>
            <div id="result" class="result"></div>
            <div class="button-group">
              <button id="cancelBtn" class="button default">取消</button>
              <button id="okBtn" class="button primary">${type === 'douyin' ? '获取无水印视频' : '查询'}</button>
            </div>
          </div>
          <script>
            const input = document.getElementById('input');
            const okBtn = document.getElementById('okBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const resultDiv = document.getElementById('result');
            
            // 显示初始结果区域
            if (resultDiv) {
              resultDiv.className = 'show';
            }

            async function submit() {
              if (!window.ipcRenderer) return;
　　 　 　 　
              const value = input.value.trim();
              if (type === 'default') {
                if (!/^\\d{5,11}$/.test(value)) {
                  if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">请输入正确的QQ号（5-11位数字）</div>';
                  }
                  return;
                }
              }

              okBtn.disabled = true;
              okBtn.textContent = type === 'douyin' ? '获取中...' : '查询中...';
　　 　 　 　
              if (resultDiv) {
                resultDiv.innerHTML = '<div class="placeholder-message">查询中...</div>';
              }

              try {
                if (type === 'default') {
                  const response = await fetch('https://api.xywlapi.cc/qqapi?qq=' + value);
                  const data = await response.json();
　　　　　　　
                  if (data.status === 200 && resultDiv) {
                    resultDiv.innerHTML = '<div class="result-item">' +
                      '<span class="result-label">查询状态：</span>' +
                      '<span class="result-value">' + data.message + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">QQ：</span>' +
                      '<span class="result-value">' + data.qq + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">归属地：</span>' +
                      '<span class="result-value">' + data.phonediqu + '</span>' +
                      '</div>';
                  } else if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">' + (data.message || '查询失败') + '</div>';
                  }
                } else {
                  window.ipcRenderer.invoke('submit-input', value);
                }
              } catch (error) {
                if (resultDiv) {
                  resultDiv.innerHTML = '<div class="error-message">查询失败，请稍后重试</div>';
                }
              } finally {
                okBtn.disabled = false;
                okBtn.textContent = type === 'douyin' ? '获取无水印视频' : '查询';
              }
            }

            function cancel() {
              if (window.ipcRenderer) {
                window.ipcRenderer.send('input-dialog-response', { type: 'cancel' });
              }
            }

            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', cancel);

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' && !okBtn.disabled) {
                submit();
              } else if (event.key === 'Escape') {
                cancel();
              }
            });

            input.focus();
            input.select();
          </script>
        </body>
      </html>
    `;

    const tempPath = path.join(app.getPath('temp'), 'message-dialog.html');
    await fs.writeFile(tempPath, htmlContent, 'utf8');
    await messageWindow.loadFile(tempPath);

    return new Promise((resolve) => {
      ipcMain.once('message-dialog-response', () => {
        messageWindow.close();
        fs.unlink(tempPath).catch(console.error);
        resolve(0);
      });

      messageWindow.on('closed', () => {
        resolve(0);
      });
    });
  }
  return 0;
})

ipcMain.handle('show-input', async (_, args) => {
  const { title, message, defaultValue, type = 'default' } = args
  if (win) {
    const inputWindow = new BrowserWindow({
      parent: win,
      modal: true,
      width: 350,
      height: type === 'douyin' ? 200 : 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload
      },
      frame: false,
      resizable: false,
      backgroundColor: '#f5f5f5'
    })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
              background: #fff;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 15px;
            }
            .input-group {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .input-group label {
              font-size: 14px;
              color: #333;
            }
            .input-group input {
              padding: 8px 12px;
              border: 1px solid #dcdfe6;
              border-radius: 4px;
              font-size: 14px;
              width: 100%;
              box-sizing: border-box;
            }
            .input-group input:focus {
              outline: none;
              border-color: #409eff;
            }
            .button-group {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 10px;
            }
            .button {
              padding: 8px 15px;
              border: none;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              transition: background-color 0.3s;
            }
            .primary {
              background: #409eff;
              color: white;
            }
            .primary:hover {
              background: #66b1ff;
            }
            .default {
              background: #f4f4f5;
              color: #606266;
            }
            .default:hover {
              background: #e9e9eb;
            }
            .result {
              display: none;
              margin-top: 15px;
              padding: 15px;
              border-radius: 4px;
              background: #f8f9fa;
            }
            .result.show {
              display: ${type === 'douyin' ? 'none' : 'block'};
            }
            .result-item {
              margin-bottom: 10px;
              font-size: 14px;
              line-height: 1.4;
            }
            .result-label {
              color: #606266;
              margin-right: 8px;
            }
            .result-value {
              color: #333;
            }
            .error-message {
              color: #f56c6c;
              font-size: 14px;
            }
            .placeholder-message {
              color: #909399;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="input-group">
              <label for="input">${message}</label>
              <input 
                type="text" 
                id="input" 
                value="${defaultValue}" 
                placeholder="${type === 'douyin' ? '请输入视频分享链接' : '请输入QQ号'}"
              >
            </div>
            <div id="result" class="result"></div>
            <div class="button-group">
              <button id="cancelBtn" class="button default">取消</button>
              <button id="okBtn" class="button primary">${type === 'douyin' ? '获取无水印视频' : '查询'}</button>
            </div>
          </div>
          <script>
            const input = document.getElementById('input');
            const okBtn = document.getElementById('okBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            const resultDiv = document.getElementById('result');
            
            // 显示初始结果区域
            if (resultDiv) {
              resultDiv.className = 'show';
            }

            async function submit() {
              if (!window.ipcRenderer) return;
　　 　 　 　
              const value = input.value.trim();
              if (type === 'default') {
                if (!/^\\d{5,11}$/.test(value)) {
                  if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">请输入正确的QQ号（5-11位数字）</div>';
                  }
                  return;
                }
              }

              okBtn.disabled = true;
              okBtn.textContent = type === 'douyin' ? '获取中...' : '查询中...';
　　 　 　 　
              if (resultDiv) {
                resultDiv.innerHTML = '<div class="placeholder-message">查询中...</div>';
              }

              try {
                if (type === 'default') {
                  const response = await fetch('https://api.xywlapi.cc/qqapi?qq=' + value);
                  const data = await response.json();
　　　　　　　
                  if (data.status === 200 && resultDiv) {
                    resultDiv.innerHTML = '<div class="result-item">' +
                      '<span class="result-label">查询状态：</span>' +
                      '<span class="result-value">' + data.message + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">QQ：</span>' +
                      '<span class="result-value">' + data.qq + '</span>' +
                      '</div>' +
                      '<div class="result-item">' +
                      '<span class="result-label">归属地：</span>' +
                      '<span class="result-value">' + data.phonediqu + '</span>' +
                      '</div>';
                  } else if (resultDiv) {
                    resultDiv.innerHTML = '<div class="error-message">' + (data.message || '查询失败') + '</div>';
                  }
                } else {
                  window.ipcRenderer.invoke('submit-input', value);
                }
              } catch (error) {
                if (resultDiv) {
                  resultDiv.innerHTML = '<div class="error-message">查询失败，请稍后重试</div>';
                }
              } finally {
                okBtn.disabled = false;
                okBtn.textContent = type === 'douyin' ? '获取无水印视频' : '查询';
              }
            }

            function cancel() {
              if (window.ipcRenderer) {
                window.ipcRenderer.send('input-dialog-response', { type: 'cancel' });
              }
            }

            okBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', cancel);

            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' && !okBtn.disabled) {
                submit();
              } else if (event.key === 'Escape') {
                cancel();
              }
            });

            input.focus();
            input.select();
          </script>
        </body>
      </html>
    `;

    const tempPath = path.join(app.getPath('temp'), 'input-dialog.html');
    await fs.writeFile(tempPath, htmlContent, 'utf8');
    await inputWindow.loadFile(tempPath);

    return new Promise((resolve) => {
      ipcMain.once('input-dialog-response', (_, response) => {
        inputWindow.close();
        fs.unlink(tempPath).catch(console.error);
        resolve(response.type === 'submit' ? response.value : null);
      });

      inputWindow.on('closed', () => {
        resolve(null);
      });
    });
  }
  return null;
})

// 解析主磁盘用量（本机侧栏）
async function getPrimaryDiskUsage() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:value'
      )
      const freeMatch = stdout.match(/FreeSpace=(\d+)/)
      const sizeMatch = stdout.match(/Size=(\d+)/)
      const free = Number(freeMatch?.[1] || 0)
      const total = Number(sizeMatch?.[1] || 0)
      if (!total) return null
      return {
        mount: 'C:',
        total,
        free,
        used: Math.max(0, total - free),
      }
    }

    // macOS / Linux：优先用户数据卷，再回退根分区
    const targets =
      process.platform === 'darwin'
        ? ['/System/Volumes/Data', '/']
        : ['/']

    for (const target of targets) {
      try {
        const { stdout } = await execAsync(`df -kP "${target}"`)
        const lines = stdout.trim().split('\n')
        if (lines.length < 2) continue
        const parts = lines[lines.length - 1].trim().split(/\s+/)
        if (parts.length < 6) continue
        const totalKb = Number(parts[1])
        const usedKb = Number(parts[2])
        const freeKb = Number(parts[3])
        if (!totalKb) continue
        return {
          mount: parts[5] || target,
          total: totalKb * 1024,
          used: usedKb * 1024,
          free: freeKb * 1024,
        }
      } catch {
        // try next target
      }
    }
    return null
  } catch (error) {
    console.error('Failed to read disk usage:', error)
    return null
  }
}

// 本机信息（侧栏展示）
ipcMain.handle('system:machine-info', async () => {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const cpus = os.cpus()
  const platformLabels: Record<string, string> = {
    darwin: 'macOS',
    win32: 'Windows',
    linux: 'Linux',
  }
  const disk = await getPrimaryDiskUsage()

  return {
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: process.platform,
    platformLabel: platformLabels[process.platform] || process.platform,
    arch: os.arch(),
    release: os.release(),
    cpuModel: (cpus[0]?.model || '').replace(/\s+/g, ' ').trim(),
    cpuCores: cpus.length,
    totalMem,
    freeMem,
    usedMem: totalMem - freeMem,
    disk,
  }
})

registerRulesIpc()
registerUpdateIpc(() => win)

// 自动启动相关处理
const autoLauncher = new AutoLaunch({
  name: 'CZTool',
  path: process.execPath,
  isHidden: false
})

ipcMain.handle('settings:get-auto-launch', async () => {
  try {
    return await autoLauncher.isEnabled()
  } catch (error) {
    console.error('Failed to get auto launch status:', error)
    return false
  }
})

ipcMain.handle('settings:set-auto-launch', async (_, enable: boolean) => {
  try {
    if (enable) {
      await autoLauncher.enable()
    } else {
      await autoLauncher.disable()
    }
    return true
  } catch (error) {
    console.error('Failed to set auto launch:', error)
    return false
  }
})

// 抖音解析
ipcMain.handle('douyin:parse', async (_event, url: string) => {
  try {
    const response = await fetch('https://dd.oihome.dpdns.org/api/parse', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        'x-grey-version': 'YBQ',
        Referer: 'https://dd.oihome.dpdns.org/',
      },
      body: JSON.stringify({
        url,
        mobile: false,
        timeout: 30,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error parsing douyin url:', error)
    throw error
  }
})

// QQ昵称查询处理函数
ipcMain.handle('fetch-qq-nickname', async (_event, qq: string) => {
  try {
    const https = require('https');
    const url = `https://v.api.aa1.cn/api/qqnicheng/index.php?qq=${qq}&type=json`;
    console.log('Fetching QQ nickname for:', qq);
    console.log('Request URL:', url);

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        rejectUnauthorized: false,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (res: any) => {
        let data = '';
        console.log('Response status:', res.statusCode);
        console.log('Response headers:', res.headers);

        if (res.statusCode !== 200) {
          console.error('HTTP Error:', res.statusCode);
          reject(new Error(`HTTP Error: ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk: any) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log('Raw response data:', data);
          try {
            const jsonMatch = data.match(/(\{\"code\":.*\})/);
            if (!jsonMatch) {
              console.error('No JSON data found in response');
              console.error('Raw data:', data);
              resolve({ code: 500, error: 'No JSON data found in response' });
              return;
            }

            const jsonStr = jsonMatch[1];
            console.log('Extracted JSON:', jsonStr);
            const jsonData = JSON.parse(jsonStr);
            console.log('Parsed JSON data:', jsonData);
            resolve(jsonData);
          } catch (error) {
            console.error('Parse error:', error);
            console.error('Raw data:', data);
            resolve({ code: 500, error: 'Invalid JSON response' });
          }
        });
      });

      req.on('error', (error: Error) => {
        console.error('Request error:', error);
        resolve({ code: 500, error: error.message });
      });

      req.setTimeout(5000, () => {
        console.error('Request timeout');
        req.destroy();
        resolve({ code: 500, error: 'Request timeout' });
      });

      req.end();
    });
  } catch (error) {
    console.error('Error fetching QQ nickname:', error);
    return { code: 500, error: error.message };
  }
});
