import React, { useState, useEffect } from 'react';
import { useI18n } from './i18n';
import './App.css';
import Workspace from './components/Workspace';
import LaserControls from './components/LaserControls';
import FileImport from './components/FileImport';
import { parseStatusResponse } from './utils/grbl';

// Vérifier si nous sommes dans Electron
const ipcRenderer = window.electron?.ipcRenderer || {
  on: () => {},
  send: () => {},
  removeAllListeners: () => {}
};

function App() {
  const { lang, toggleLang } = useI18n();
  const [connected, setConnected] = useState(false);
  const [connectionType, setConnectionType] = useState('usb');
  const [usbPorts, setUsbPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [wifiHost, setWifiHost] = useState('192.168.1.100');
  const [wifiPort, setWifiPort] = useState('23');
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [workspaceWidth, setWorkspaceWidth] = useState(300);
  const [workspaceHeight, setWorkspaceHeight] = useState(300);
  const [importedFiles, setImportedFiles] = useState([]);
  const [workPosition, setWorkPosition] = useState(null);

  useEffect(() => {
    // Restore persisted workspace dimensions
    try {
      const raw = localStorage.getItem('workspace.dimensions');
      if (raw) {
        const dims = JSON.parse(raw);
        if (dims && typeof dims.width === 'number' && typeof dims.height === 'number') {
          setWorkspaceWidth(dims.width);
          setWorkspaceHeight(dims.height);
        }
      }
    } catch {}

    // Listen for connection status updates (preload strips the event argument)
    ipcRenderer.on('connection-status', (status) => {
      if (status && typeof status === 'object') {
        setConnected(Boolean(status.connected));
        addConsoleMessage(status.message);
      }
    });

    // Listen for GRBL data
    ipcRenderer.on('grbl-data', (data) => {
      if (typeof data !== 'undefined') {
        addConsoleMessage(`Received: ${data}`);
        try {
          const status = parseStatusResponse(String(data));
          if (status) {
            const pos = (status.workCoordinate && typeof status.workCoordinate.x === 'number')
              ? status.workCoordinate
              : (status.position && typeof status.position.x === 'number')
                ? status.position
                : null;
            if (pos) setWorkPosition(pos);
          }
        } catch {}
      }
    });

    // Setup listener FIRST before sending request
    ipcRenderer.on('ports-list', (ports) => {
      console.log('[REACT DEBUG] Setting up ports-list listener');
      console.log('[REACT DEBUG] Received ports-list:', ports);
      const list = Array.isArray(ports) ? ports : [];
      setUsbPorts(list);
      if (list.length > 0 && !selectedPort) {
        setSelectedPort(list[0]);
      }
    });

    // NOW send the request
    console.log('[REACT DEBUG] Sending get-ports request');
    ipcRenderer.send('get-ports');

    // Cleanup function
    return () => {
      ipcRenderer.removeAllListeners('connection-status');
      ipcRenderer.removeAllListeners('grbl-data');
      ipcRenderer.removeAllListeners('ports-list');
    };
  }, []);

  // Poll GRBL status periodically when connected to update live position
  useEffect(() => {
    let statusTimer = null;
    if (connected) {
      statusTimer = setInterval(() => {
        ipcRenderer.send('send-command', '?');
      }, 250);
    }
    return () => {
      if (statusTimer) clearInterval(statusTimer);
    };
  }, [connected]);

  const addConsoleMessage = (message) => {
    setConsoleOutput(prev => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), message }
    ]);
  };

  const handleConnect = () => {
    if (connected) {
      ipcRenderer.send('disconnect');
      setConnected(false);
      addConsoleMessage('Disconnected');
    } else {
      if (connectionType === 'usb') {
        ipcRenderer.send('connect-usb', selectedPort);
      } else {
        ipcRenderer.send('connect-wifi', { host: wifiHost, port: parseInt(wifiPort) });
      }
    }
  };

  const handleSendCommand = (command) => {
    if (connected && command.trim()) {
      ipcRenderer.send('send-command', command);
      addConsoleMessage(`Sent: ${command}`);
    }
  };

  const handleFileImport = (files) => {
    setImportedFiles(prev => [...prev, ...files]);
    addConsoleMessage(`Imported ${files.length} file(s)`);
  };

  const handleWorkspaceDimensionsChange = (width, height) => {
    setWorkspaceWidth(width);
    setWorkspaceHeight(height);
  };

  const handleSaveAllSettings = () => {
    try {
      localStorage.setItem('workspace.dimensions', JSON.stringify({ width: workspaceWidth, height: workspaceHeight }));
    } catch {}
    // Ask Workspace to persist current draggable panel positions
    try {
      window.dispatchEvent(new Event('save-panel-positions'));
    } catch {}
    addConsoleMessage('Settings saved');
  };

  return (
    <div className="App">
      <div className="app-header">
        <h1 className="multicolor-title" style={{ margin: 0 }}>SHEPP Laser</h1>
        <button
          className="btn-secondary header-lang-toggle"
          onClick={toggleLang}
          title={lang === 'fr' ? 'Basculer en anglais' : 'Switch to French'}
        >
          {lang === 'fr' ? 'FR' : 'EN'}
        </button>
      </div>
      <div className="app-content">
        <div className="left-panel">
          <LaserControls
            connected={connected}
            connectionType={connectionType}
            setConnectionType={setConnectionType}
            usbPorts={usbPorts}
            selectedPort={selectedPort}
            setSelectedPort={setSelectedPort}
            wifiHost={wifiHost}
            setWifiHost={setWifiHost}
            wifiPort={wifiPort}
            setWifiPort={setWifiPort}
            onConnect={handleConnect}
            onSendCommand={handleSendCommand}
          consoleOutput={consoleOutput}
          workspaceWidth={workspaceWidth}
          workspaceHeight={workspaceHeight}
          onWorkspaceDimensionsChange={handleWorkspaceDimensionsChange}
          onSaveAllSettings={handleSaveAllSettings}
        />
          <FileImport
            onFileImport={handleFileImport}
            importedFiles={importedFiles}
          />
        </div>
        <div className="right-panel">
          <Workspace
            width={workspaceWidth}
            height={workspaceHeight}
            files={importedFiles}
            setFiles={setImportedFiles}
            connected={connected}
            workPosition={workPosition}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
