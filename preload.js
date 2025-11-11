const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels
      const validChannels = [
        'grbl-connect',
        'grbl-disconnect',
        'grbl-send-command',
        'grbl-import-file',
        'grbl-start-job',
        'grbl-stop-job',
        'grbl-pause-job',
        'grbl-resume-job',
        'grbl-home',
        'grbl-unlock',
        'grbl-reset',
            'get-ports',
            'connect-usb',
            'connect-wifi',
            'disconnect',
            'send-command',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = [
        'connection-status',
        'grbl-response',
        'grbl-error',
        'grbl-status',
        'job-progress',
        'console-output',
            'ports-list',
            'grbl-data'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => {
          // Special handling for ports-list to ensure we always pass an array
          if (channel === 'ports-list') {
            const ports = args[0];
            func(Array.isArray(ports) ? ports : []);
          } else {
            func(...args);
          }
        });
      }
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
