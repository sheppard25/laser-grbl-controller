const { app, BrowserWindow, ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const net = require('net');
const path = require('path');

let mainWindow;
let laserPort;
let parser;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Laser GRBL Controller'
  });
  
  mainWindow.loadURL('http://localhost:3000');
  
  // Ouvrir les DevTools en développement
  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers pour la communication avec le renderer
ipcMain.handle('list-serial-ports', async () => {
  try {
    const ports = await SerialPort.list();
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      pnpId: port.pnpId,
      vendorId: port.vendorId,
      productId: port.productId
    }));
  } catch (error) {
    console.error('Error listing serial ports:', error);
    throw error;
  }
});

ipcMain.handle('connect-serial', async (event, portPath, baudRate = 115200) => {
  try {
    if (laserPort && laserPort.isOpen) {
      laserPort.close();
    }
    
    laserPort = new SerialPort({ path: portPath, baudRate });
    parser = laserPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    parser.on('data', (data) => {
      // Unifier le canal vers grbl-data pour le renderer
      mainWindow.webContents.send('grbl-data', data);
    });
    
    return { success: true, message: 'Connected to serial port' };
  } catch (error) {
    console.error('Error connecting to serial port:', error);
    throw error;
  }
});

ipcMain.handle('disconnect-serial', async () => {
  try {
    if (laserPort && laserPort.isOpen) {
      laserPort.close();
      laserPort = null;
      parser = null;
      return { success: true, message: 'Disconnected from serial port' };
    }
    return { success: false, message: 'No port was open' };
  } catch (error) {
    console.error('Error disconnecting from serial port:', error);
    throw error;
  }
});

ipcMain.handle('send-gcode', async (event, gcode) => {
  try {
    if (!laserPort || !laserPort.isOpen) {
      throw new Error('Serial port not connected');
    }
    laserPort.write(gcode + '\n');
    return { success: true, message: 'G-code sent' };
  } catch (error) {
    console.error('Error sending G-code:', error);
    throw error;
  }
});

// WiFi/Network connection handlers
ipcMain.handle('connect-wifi', async (event, host, port = 23) => {
  return new Promise((resolve, reject) => {
    try {
      const client = net.createConnection({ host, port }, () => {
        laserPort = client;
        
        client.on('data', (data) => {
          // Unifier le canal vers grbl-data pour le renderer
          mainWindow.webContents.send('grbl-data', data.toString());
        });
        
        client.on('error', (error) => {
          console.error('Network error:', error);
          mainWindow.webContents.send('connection-error', error.message);
        });
        
        client.on('close', () => {
          mainWindow.webContents.send('connection-closed');
          laserPort = null;
        });
        
        resolve({ success: true, message: 'Connected via WiFi' });
      });
      
      client.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      console.error('Error connecting via WiFi:', error);
      reject(error);
    }
  });
});

ipcMain.handle('disconnect-wifi', async () => {
  try {
    if (laserPort && typeof laserPort.end === 'function') {
      laserPort.end();
      laserPort = null;
      return { success: true, message: 'Disconnected from WiFi' };
    }
    return { success: false, message: 'No WiFi connection was open' };
  } catch (error) {
    console.error('Error disconnecting from WiFi:', error);
    throw error;
  }
});

// Écouter les demandes de ports USB avec debugging
ipcMain.on('get-ports', async (event) => {
  console.log('[DEBUG] get-ports handler called');
  try {
    const ports = await SerialPort.list();
    console.log('[DEBUG] Total ports found by SerialPort.list():', ports.length);
    console.log('[DEBUG] All ports:', JSON.stringify(ports, null, 2));
    
    const grblVendorIds = ['2341', '1a86', '0403', '10c4', '067b'];
    
    const portsWithInfo = ports.map(port => {
      const isLikelyGRBL = grblVendorIds.some(vid => 
        port.vendorId && port.vendorId.toLowerCase() === vid
      );
      console.log(`[DEBUG] Port ${port.path}: vendorId=${port.vendorId}, isLikelyGRBL=${isLikelyGRBL}`);
      return { ...port, isLikelyGRBL };
    });
    
    portsWithInfo.sort((a, b) => (b.isLikelyGRBL ? 1 : 0) - (a.isLikelyGRBL ? 1 : 0));
    
    const portPaths = portsWithInfo.map(p => p.path);
    console.log('[DEBUG] Sending port paths to renderer:', portPaths);
    
    event.reply('ports-list', portPaths);
  } catch (error) {
    console.error('[ERROR] Error listing ports:', error);
    event.reply('ports-list', []);
  }
});

// Handler pour connecter via USB
ipcMain.on('connect-usb', async (event, portPath) => {
  try {
    // Fermer un port existant si ouvert
    if (laserPort && laserPort.isOpen) {
      laserPort.close();
      laserPort = null;
      parser = null;
    }

    // Ouvrir le nouveau port série
    laserPort = new SerialPort({ path: portPath, baudRate: 115200 });
    parser = laserPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {
      mainWindow.webContents.send('grbl-data', data);
    });

    laserPort.on('open', () => {
      mainWindow.webContents.send('connection-status', {
        connected: true,
        message: `Connected to ${portPath}`
      });
    });

    laserPort.on('error', (error) => {
      mainWindow.webContents.send('connection-status', {
        connected: false,
        message: `Error connecting: ${error.message}`
      });
    });
  } catch (error) {
    mainWindow.webContents.send('connection-status', {
      connected: false,
      message: `Error connecting: ${error.message}`
    });
  }
});

// Handler pour déconnecter
ipcMain.on('disconnect', () => {
  try {
    if (laserPort) {
      if (typeof laserPort.close === 'function') {
        laserPort.close();
      } else if (typeof laserPort.end === 'function') {
        laserPort.end();
      }
      laserPort = null;
      parser = null;
    }
    mainWindow.webContents.send('connection-status', {
      connected: false,
      message: 'Disconnected'
    });
  } catch (error) {
    console.error('Error disconnecting:', error);
    mainWindow.webContents.send('connection-status', {
      connected: false,
      message: `Disconnect error: ${error.message}`
    });
  }
});

// Handler pour envoyer une commande
ipcMain.on('send-command', (event, command) => {
  try {
    if (!laserPort) {
      throw new Error('No active connection');
    }
    // net.Socket et SerialPort supportent write
    laserPort.write(String(command) + '\n');
  } catch (error) {
    console.error('Error sending command:', error);
    mainWindow.webContents.send('grbl-data', `Error: ${error.message}`);
  }
});

// Handler pour connecter via WiFi depuis un message send
ipcMain.on('connect-wifi', (event, params) => {
  try {
    const host = params?.host;
    const port = params?.port || 23;

    const client = net.createConnection({ host, port }, () => {
      laserPort = client;
      mainWindow.webContents.send('connection-status', {
        connected: true,
        message: `Connected via WiFi ${host}:${port}`
      });
    });

    client.on('data', (data) => {
      mainWindow.webContents.send('grbl-data', data.toString());
    });

    client.on('error', (error) => {
      console.error('Network error:', error);
      mainWindow.webContents.send('connection-status', {
        connected: false,
        message: `WiFi error: ${error.message}`
      });
    });

    client.on('close', () => {
      mainWindow.webContents.send('connection-status', {
        connected: false,
        message: 'WiFi connection closed'
      });
      if (laserPort === client) {
        laserPort = null;
      }
    });
  } catch (error) {
    mainWindow.webContents.send('connection-status', {
      connected: false,
      message: `Error connecting via WiFi: ${error.message}`
    });
  }
});
