import React, { useState } from 'react';
import { useI18n } from '../i18n';

function LaserControls({
  connected,
  connectionType,
  setConnectionType,
  usbPorts,
  selectedPort,
  setSelectedPort,
  wifiHost,
  setWifiHost,
  wifiPort,
  setWifiPort,
  onConnect,
  onSendCommand,
  consoleOutput,
  workspaceWidth,
  workspaceHeight,
  onWorkspaceDimensionsChange,
  onSaveAllSettings
}) {
  const [command, setCommand] = useState('');
  const [tempWidth, setTempWidth] = useState(workspaceWidth);
  const [tempHeight, setTempHeight] = useState(workspaceHeight);
  const { t } = useI18n();

  const handleSendCommand = () => {
    if (command.trim()) {
      onSendCommand(command);
      setCommand('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    }
  };

  const handleDimensionsUpdate = () => {
    onWorkspaceDimensionsChange(parseInt(tempWidth), parseInt(tempHeight));
  };

  const sendQuickCommand = (cmd) => {
    onSendCommand(cmd);
  };

    const handleRefreshPorts = () => {
          const ipcRenderer = window.electron?.ipcRenderer;
          if (ipcRenderer) {
                  ipcRenderer.send('get-ports');
                }
        };

  return (
    <>
      {/* Connection Section */}
      <div className="control-section">
        <h2>
          <span className={`status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`}></span>
          {t('connection.title')}
        </h2>
        
        <div className="form-group">
          <label>{t('connection.type')}:</label>
          <select 
            value={connectionType} 
            onChange={(e) => setConnectionType(e.target.value)}
            disabled={connected}
          >
            <option value="usb">{t('usb.serial')}</option>
            <option value="wifi">{t('wifi.network')}</option>
          </select>
        </div>

        {connectionType === 'usb' ? (
          <div className="form-group">
            <label>{t('usb.port')}:</label>
<div style={{ display: 'flex', alignItems: 'center' }}>
                  <select 
              value={selectedPort} 
              onChange={(e) => setSelectedPort(e.target.value)}
              disabled={connected}
            >
            {(usbPorts || []).map(port => (                <option key={port} value={port}>{port}</option>
              ))}
            </select>
                      <button
                        className="btn-secondary"
                                    onClick={handleRefreshPorts}
                                                disabled={connected}
                                                            style={{ marginLeft: '5px', padding: '8px 12px' }}
          title={t('connection.refresh')}
                    >
                      🔄
                    </button>
                    </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>{t('wifi.host')}:</label>
              <input 
                type="text" 
                value={wifiHost} 
                onChange={(e) => setWifiHost(e.target.value)}
                disabled={connected}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="form-group">
              <label>{t('wifi.port')}:</label>
              <input 
                type="number" 
                value={wifiPort} 
                onChange={(e) => setWifiPort(e.target.value)}
                disabled={connected}
                placeholder="23"
              />
            </div>
          </>
        )}

        <button 
          className={connected ? 'btn-danger' : 'btn-primary'} 
          onClick={onConnect}
          style={{ width: '100%' }}
        >
          {connected ? t('disconnect') : t('connect')}
        </button>
      </div>

      {/* Workspace Dimensions Section */}
      <div className="control-section">
        <h2>{t('workspace_dimensions.title')}</h2>
        <div className="dimensions-group">
          <div className="form-group">
            <label>{t('workspace_dimensions.width')}:</label>
            <input 
              type="number" 
              value={tempWidth} 
              onChange={(e) => setTempWidth(e.target.value)}
              min="50"
              max="1000"
            />
          </div>
          <div className="form-group">
            <label>{t('workspace_dimensions.height')}:</label>
            <input 
              type="number" 
              value={tempHeight} 
              onChange={(e) => setTempHeight(e.target.value)}
              min="50"
              max="1000"
            />
          </div>
        </div>
        <button 
          className="btn-primary" 
          onClick={handleDimensionsUpdate}
          style={{ width: '100%', marginTop: '10px' }}
        >
          {t('workspace_dimensions.update')}
        </button>
        <button
          className="btn-secondary"
          onClick={onSaveAllSettings}
          style={{ display: 'block', margin: '8px auto 0' }}
        >
          {t('workspace_dimensions.save_all')}
        </button>
      </div>

      {/* GRBL Commands Section */}
      <div className="control-section">
        <h2>{t('grbl_commands.title')}</h2>
        
        <div className="form-group">
          <label>{t('grbl_commands.manual')}</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="text" 
              value={command} 
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!connected}
              placeholder={t('grbl_commands.placeholder')}
              style={{ flex: 1 }}
            />
            <button 
              className="btn-primary" 
              onClick={handleSendCommand}
              disabled={!connected}
            >
              {t('send')}
            </button>
          </div>
        </div>

        <div className="button-group">
          <button 
            className="btn-secondary" 
            onClick={() => sendQuickCommand('$H')}
            disabled={!connected}
          >
            {t('home')}
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => sendQuickCommand('$X')}
            disabled={!connected}
          >
            {t('unlock')}
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => sendQuickCommand('?')}
            disabled={!connected}
          >
            {t('status')}
          </button>
          <button 
            className="btn-danger" 
            onClick={() => sendQuickCommand('!')}
            disabled={!connected}
          >
            {t('stop')}
          </button>
        </div>
      </div>

      {/* Console Output Section */}
      <div className="control-section">
        <h2>{t('console_output.title')}</h2>
        <div className="console-output">
          {(consoleOutput || []).map((line, index) => (
            <div key={index} className="console-line">
              <span style={{ color: '#888' }}>[{line.timestamp}]</span> {line.message}
            </div>
                                               ))}
                      {(consoleOutput || []).length === 0 && (
            <div style={{ color: '#666' }}>{t('console_output.empty')}</div>
          )}
        </div>
      </div>
    </>
  );
}

export default LaserControls;
