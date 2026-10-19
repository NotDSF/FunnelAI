const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld("electron", {
  send: (data) => ipcRenderer.send("message", data),
  onReply: (callback) => ipcRenderer.on("reply", (event, data) => callback(data)),
  getAccountData: () => ipcRenderer.invoke("account"),
  getDeviceName: () => ipcRenderer.invoke("device"),
  getLastSync: () => ipcRenderer.invoke("synctime"),
  getConfigs: () => ipcRenderer.invoke("getconfigs"),
  getModels: () => ipcRenderer.invoke("models"),
  getPort: () => ipcRenderer.invoke("PORT"),
  getStatus: (ID) => ipcRenderer.invoke("GET_BROWSER_STATUS", ID),
  getDevices: () => ipcRenderer.invoke("getdevices")
});