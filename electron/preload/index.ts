import { ipcRenderer, contextBridge } from 'electron';
// 从 electron 模块中导入 ipcRenderer（用于在渲染进程中与主进程通信）和 contextBridge（用于在渲染进程和主进程之间安全地暴露 API）

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel: string, data: any) => {
    const validChannels = [
      'input-dialog-response',
      'minimize-window',
      'maximize-window',
      'close-window'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, func: Function) => {
    const validChannels = [
      'input-dialog-response',
      'minimize-window',
      'maximize-window',
      'close-window',
      'update:status',
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return () => {};
  },
  once: (channel: string, func: Function) => {
    const validChannels = [
      'input-dialog-response',
      'minimize-window',
      'maximize-window',
      'close-window',
      'update:status',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  },
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'show-input',
      'system:notification',
      'system:shutdown',
      'generate-short-url',
      'fetch-qq-nickname',
      'history:add',
      'history:list',
      'history:clear',
      'settings:get-auto-launch',
      'settings:set-auto-launch',
      'update:get-version',
      'update:get-settings',
      'update:set-auto-check',
      'update:check',
      'update:quit-and-install',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error('Invalid channel'));
  }
});
// 为输入对话框暴露IPC API

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    // 返回一个 Promise，用于等待文档加载完成
    if (condition.includes(document.readyState)) {
      // 如果当前文档状态在指定的条件列表中
      resolve(true);
      // 立即 resolve Promise，表示文档已加载完成
    } else {
      document.addEventListener('readystatechange', () => {
        // 如果当前文档状态不在指定的条件列表中，监听 readystatechange 事件
        if (condition.includes(document.readyState)) {
          resolve(true);
          // 当文档状态满足条件时，resolve Promise
        }
      });
    }
  });
}
// 定义一个函数，用于等待文档加载完成，接受一个参数 condition，表示文档的就绪状态，默认为 ['complete', 'interactive']

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      // 检查子元素是否已经在父元素的子元素列表中
      return parent.appendChild(child);
      // 如果不在，则将子元素添加到父元素中并返回添加后的子元素
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      // 检查子元素是否在父元素的子元素列表中
      return parent.removeChild(child);
      // 如果在，则从父元素中移除子元素并返回移除后的子元素
    }
  },
};
// 定义一个对象，包含两个方法 append 和 remove，用于安全地向父元素添加子元素和从父元素移除子元素

function useLoading() {
  const className = `loaders-css__square-spin`;
  // 定义一个类名，用于加载动画的样式
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `;
  // 定义一段 CSS 样式内容，包含动画关键帧和加载容器的样式
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');
  // 创建一个 <style> 元素和一个 <div> 元素

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;
  // 设置样式元素和加载容器元素的属性

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
      // 将加载样式和容器添加到文档中
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
      // 从文档中移除加载样式和容器
    },
  };
}
// 定义一个函数，用于创建加载动画效果，返回一个包含添加和移除加载动画方法的对象

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading();
// 调用 useLoading 函数得到添加和移除加载动画的方法
// domReady().then(appendLoading);
// 等待文档加载完成后，添加加载动画
window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading();
};
// 设置窗口的 onmessage 事件监听，当接收到消息且消息的 payload 为 'removeLoading'时，移除加载动画
setTimeout(removeLoading, 4999);
// 在 4999 毫秒后自动移除加载动画