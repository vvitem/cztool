import { ipcRenderer, contextBridge } from 'electron';

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
      'fetch-qq-nickname',
      'history:add',
      'history:list',
      'history:clear',
      'history:clear-all',
      'settings:get-auto-launch',
      'settings:set-auto-launch',
      'douyin:parse',
      'system:machine-info',
      'rules:scan',
      'rules:read',
      'rules:write',
      'rules:reveal',
      'rules:open',
      'rules:compare',
      'rules:health',
      'rules:create',
      'rules:sync',
      'rules:get-project',
      'rules:clear-project',
      'rules:pick-project',
      'rules:scan-project',
      'update:get-version',
      'update:get-settings',
      'update:set-auto-check',
      'update:check',
      'update:quit-and-install',
      'unlock:get-status',
      'unlock:get-device-id',
      'unlock:verify',
      'unlock:clear',
      'unlock:open-external',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error('Invalid channel'));
  }
});

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child);
    }
  },
};

function useLoading() {
  const className = `loaders-css__square-spin`;
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
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

const { appendLoading, removeLoading } = useLoading();
window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading();
};
setTimeout(removeLoading, 4999);
