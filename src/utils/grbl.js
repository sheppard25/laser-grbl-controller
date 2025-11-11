// GRBL utility functions for command generation and parsing

// Common GRBL commands
export const GRBL_COMMANDS = {
  HOME: '$H',
  STATUS: '?',
  RESET: '\x18', // Ctrl-X
  STOP: '!',
  RESUME: '~',
  UNLOCK: '$X',
  SETTINGS: '$$',
  PARAMETERS: '$#',
  PARSER_STATE: '$G',
  BUILD_INFO: '$I',
  STARTUP_BLOCKS: '$N'
};

// Generate move commands
export const generateMoveCommand = (x, y, z, feedRate, mode = 'G1') => {
  let command = mode;
  if (x !== undefined) command += ` X${x.toFixed(3)}`;
  if (y !== undefined) command += ` Y${y.toFixed(3)}`;
  if (z !== undefined) command += ` Z${z.toFixed(3)}`;
  if (feedRate !== undefined) command += ` F${feedRate}`;
  return command;
};

// Generate arc commands
export const generateArcCommand = (x, y, i, j, clockwise = true) => {
  const command = clockwise ? 'G2' : 'G3';
  return `${command} X${x.toFixed(3)} Y${y.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`;
};

// Set laser power (M3/M4/M5)
export const setLaserPower = (power, mode = 'M3') => {
  if (power === 0 || mode === 'M5') {
    return 'M5'; // Turn off laser
  }
  return `${mode} S${power}`; // M3 (constant) or M4 (dynamic)
};

// Set work coordinate system
export const setWorkCoordinateSystem = (system = 1) => {
  return `G${53 + system}`; // G54-G59
};

// Zero work coordinates
export const zeroWorkCoordinates = (axes = 'XYZ') => {
  let command = 'G10 L20 P0';
  if (axes.includes('X')) command += ' X0';
  if (axes.includes('Y')) command += ' Y0';
  if (axes.includes('Z')) command += ' Z0';
  return command;
};

// Set feed rate
export const setFeedRate = (rate) => {
  return `F${rate}`;
};

// Parse GRBL status response
export const parseStatusResponse = (response) => {
  const statusMatch = response.match(/<(\w+)\|([^>]+)>/);
  if (!statusMatch) return null;

  const state = statusMatch[1];
  const parts = statusMatch[2].split('|');
  
  const status = {
    state: state,
    position: {},
    workCoordinate: {},
    feedRate: null,
    spindle: null
  };

  parts.forEach(part => {
    if (part.startsWith('MPos:')) {
      const coords = part.substring(5).split(',');
      status.position = {
        x: parseFloat(coords[0]),
        y: parseFloat(coords[1]),
        z: parseFloat(coords[2])
      };
    } else if (part.startsWith('WPos:')) {
      const coords = part.substring(5).split(',');
      status.workCoordinate = {
        x: parseFloat(coords[0]),
        y: parseFloat(coords[1]),
        z: parseFloat(coords[2])
      };
    } else if (part.startsWith('F:')) {
      status.feedRate = parseFloat(part.substring(2));
    } else if (part.startsWith('S:')) {
      status.spindle = parseFloat(part.substring(2));
    }
  });

  return status;
};

// Parse GRBL error messages
export const parseErrorMessage = (response) => {
  const errorMatch = response.match(/error:(\d+)/);
  if (!errorMatch) return null;

  const errorCode = parseInt(errorMatch[1]);
  const errorMessages = {
    1: 'G-code words consist of a letter and a value',
    2: 'Numeric value format is not valid',
    3: 'Grbl $ system command was not recognized',
    4: 'Negative value received for an expected positive value',
    5: 'Homing cycle failure',
    6: 'Minimum step pulse time must be greater than 3usec',
    7: 'EEPROM read failed',
    8: 'Grbl $ command cannot be used unless Grbl is IDLE',
    9: 'G-code locked out during alarm or jog state',
    10: 'Soft limits cannot be enabled without homing',
    11: 'Max characters per line exceeded',
    12: '$ setting value exceeds the maximum step rate supported',
    13: 'Safety door detected as opened',
    14: 'Build info or startup line exceeded EEPROM line length limit',
    15: 'Jog target exceeds machine travel',
    20: 'Unsupported or invalid g-code command',
    21: 'More than one g-code command from same modal group',
    22: 'Feed rate has not yet been set or is undefined',
    23: 'G-code command requires an integer value',
    24: 'Two G-code commands that both require XYZ axis words',
    25: 'A G-code word was repeated in the block',
    26: 'A G-code command implicitly or explicitly requires XYZ axis words',
    27: 'N line number value is not within the valid range',
    28: 'A G-code command was sent but is missing some important P or L value',
    29: 'Grbl supports six work coordinate systems G54-G59',
    30: 'The G53 G-code command requires either G0 or G1'
  };

  return {
    code: errorCode,
    message: errorMessages[errorCode] || 'Unknown error'
  };
};

// Validate G-code line
export const validateGCodeLine = (line) => {
  // Remove comments
  const cleanLine = line.replace(/\([^)]*\)/g, '').trim();
  if (cleanLine.length === 0) return { valid: true };

  // Check for valid G-code format
  const validPattern = /^[GM]\d+/i;
  if (!validPattern.test(cleanLine) && !cleanLine.startsWith('$')) {
    return {
      valid: false,
      error: 'Invalid G-code format'
    };
  }

  return { valid: true };
};

// Convert mm to inches
export const mmToInches = (mm) => {
  return mm / 25.4;
};

// Convert inches to mm
export const inchesToMm = (inches) => {
  return inches * 25.4;
};

export default {
  GRBL_COMMANDS,
  generateMoveCommand,
  generateArcCommand,
  setLaserPower,
  setWorkCoordinateSystem,
  zeroWorkCoordinates,
  setFeedRate,
  parseStatusResponse,
  parseErrorMessage,
  validateGCodeLine,
  mmToInches,
  inchesToMm
};
