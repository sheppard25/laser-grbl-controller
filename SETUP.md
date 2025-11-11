# Guide de Configuration - Laser GRBL Controller

## Structure du Projet

Créez la structure suivante dans votre projet local :

```
laser-grbl-controller/
├── public/
│   └── index.html
├── src/
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   ├── components/
│   │   ├── Workspace.js
│   │   ├── LaserControls.js
│   │   └── FileImport.js
│   └── utils/
│       └── grbl.js
├── main.js
├── package.json (déjà créé)
├── .gitignore
└── README.md
```

## Installation

1. **Cloner le repository**
```bash
git clone https://github.com/sheppard25/laser-grbl-controller.git
cd laser-grbl-controller
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Démarrer l'application**
```bash
npm run dev
```

## Fichiers Sources

Voici le code complet pour chaque fichier :

### 1. main.js (Electron Main Process)

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const net = require('net');

let mainWindow;
let laserPort;
let parser;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:3000');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Lister les ports USB disponibles
ipcMain.handle('list-ports', async () => {
  const ports = await SerialPort.list();
  return ports;
});

// Connexion USB
ipcMain.on('connect-usb', (event, portName, baudRate) => {
  try {
    laserPort = new SerialPort(portName, { baudRate: parseInt(baudRate) });
    parser = laserPort.pipe(new Readline({ delimiter: '\n' }));

    laserPort.on('open', () => {
      event.reply('connection-status', { status: 'connected', type: 'USB' });
    });

    parser.on('data', data => {
      event.reply('grbl-data', data.toString());
    });

    laserPort.on('error', err => {
      event.reply('connection-status', { status: 'error', message: err.message });
    });
  } catch (error) {
    event.reply('connection-status', { status: 'error', message: error.message });
  }
});

// Connexion WiFi
ipcMain.on('connect-wifi', (event, host, port) => {
  try {
    laserPort = net.createConnection({ host, port: parseInt(port) });

    laserPort.on('connect', () => {
      event.reply('connection-status', { status: 'connected', type: 'WiFi' });
    });

    laserPort.on('data', data => {
      event.reply('grbl-data', data.toString());
    });

    laserPort.on('error', err => {
      event.reply('connection-status', { status: 'error', message: err.message });
    });
  } catch (error) {
    event.reply('connection-status', { status: 'error', message: error.message });
  }
});

// Envoyer des commandes GRBL
ipcMain.on('send-gcode', (event, command) => {
  if (laserPort && laserPort.writable) {
    laserPort.write(command + '\n');
  }
});

// Déconnexion
ipcMain.on('disconnect', () => {
  if (laserPort) {
    laserPort.close();
    laserPort = null;
  }
```

---

## 📚 TOUS LES FICHIERS SOURCE REACT

Voici le code complet pour tous les fichiers React :

### 2. src/index.js

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 3. src/App.js

```javascript
import React, { useState, useEffect } from 'react';
import './App.css';
import Workspace from './components/Workspace';
import LaserControls from './components/LaserControls';
import FileImport from './components/FileImport';

const { ipcRenderer } = window.require('electron');

function App() {
  const [connection, setConnection] = useState({ status: 'disconnected' });
  const [grblData, setGrblData] = useState([]);
  const [workspaceDim, setWorkspaceDim] = useState({ width: 300, height: 200 });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    // Écouter les événements Electron
    ipcRenderer.on('connection-status', (event, status) => {
      setConnection(status);
    });

    ipcRenderer.on('grbl-data', (event, data) => {
      setGrblData(prev => [...prev, data].slice(-50)); // Garder les 50 derniers
    });

    return () => {
      ipcRenderer.removeAllListeners('connection-status');
      ipcRenderer.removeAllListeners('grbl-data');
    };
  }, []);

  const handleFileImport = (file) => {
    setFiles([...files, { ...file, id: Date.now() }]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚡ Laser GRBL Controller</h1>
        <div className="connection-status" style={{ 
          color: connection.status === 'connected' ? '#4caf50' : '#f44336' 
        }}>
          {connection.status === 'connected' ? '✓ Connecté' : '✗ Déconnecté'}
          {connection.type && ` (${connection.type})`}
        </div>
      </header>

      <div className="main-container">
        <div className="left-panel">
          <LaserControls 
            connection={connection}
            onConnect={(type, params) => {
              if (type === 'usb') {
                ipcRenderer.send('connect-usb', params.port, params.baudRate);
              } else {
                ipcRenderer.send('connect-wifi', params.host, params.port);
              }
            }}
            onDisconnect={() => ipcRenderer.send('disconnect')}
            onSendCommand={(cmd) => ipcRenderer.send('send-gcode', cmd)}
          />
          
          <div className="grbl-console">
            <h3>Console GRBL</h3>
            <div className="console-output">
              {grblData.map((line, idx) => (
                <div key={idx} className="console-line">{line}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="right-panel">
          <FileImport onImport={handleFileImport} />
          <Workspace
            dim={workspaceDim}
            files={files}
            onDimChange={setWorkspaceDim}
            onFilesChange={setFiles}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
```
});
```
