import React, { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import Draggable from 'react-draggable';
// import { generateMoveCommand } from '../utils/grbl';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Vérifier si nous sommes dans Electron
const ipcRenderer = window.electron?.ipcRenderer || { send: () => {} };

function Workspace({ width, height, files, setFiles, connected, workPosition }) {
  const canvasRef = useRef(null);
  const [gridSpacing] = useState(10); // base grid spacing (units)
  const [step, setStep] = useState(10); // jog step in mm
  const [feedRate, setFeedRate] = useState(2000); // feed rate for jog (default 2000)
  const [selectedIndex, setSelectedIndex] = useState(null);
  const nodeRefs = useRef([]);
  const manualPanelRef = useRef(null);
  const filesPanelRef = useRef(null);
  const laserPanelRef = useRef(null);
  const overlayRef = useRef(null);
  const { t } = useI18n();

  const SCALE_FACTOR = 2.0; // enlarge grid (x2)
  const TICK_SPACING = 20; // axis graduation every 20 units
  const AXIS_MARGIN_TOP = 24; // space above grid for top axis (ticks + labels)
  const AXIS_MARGIN_RIGHT = 36; // space to the right of grid for right axis
  const LASER_MAX_S = 1000; // max S value for laser power
  const SAFETY_MM = 2; // safety offset from edges before drawing shapes
  const POS_STORAGE_KEYS = {
    manual: 'panelPos.manual',
    files: 'panelPos.files',
    laser: 'panelPos.laser',
  };
  const SETTINGS_STORAGE_KEYS = {
    power: 'laser.power',
    feed: 'laser.feedRate',
  };

  const [manualPos, setManualPos] = useState({ x: Math.round(width * SCALE_FACTOR) - 300, y: AXIS_MARGIN_TOP + 30 });
  const [filesPos, setFilesPos] = useState({ x: Math.round(width * SCALE_FACTOR) - 300, y: AXIS_MARGIN_TOP + 280 });
  const [laserPos, setLaserPos] = useState({ x: Math.round(width * SCALE_FACTOR) - 300, y: AXIS_MARGIN_TOP + 520 });

  const [laserPower, setLaserPower] = useState(10); // percentage 0-100
  const [laserOn, setLaserOn] = useState(false);

  const savePanelPositions = () => {
    try {
      localStorage.setItem(POS_STORAGE_KEYS.manual, JSON.stringify(manualPos));
      localStorage.setItem(POS_STORAGE_KEYS.files, JSON.stringify(filesPos));
      localStorage.setItem(POS_STORAGE_KEYS.laser, JSON.stringify(laserPos));
      localStorage.setItem(SETTINGS_STORAGE_KEYS.power, JSON.stringify(laserPower));
      localStorage.setItem(SETTINGS_STORAGE_KEYS.feed, JSON.stringify(feedRate));
    } catch {}
  };

  // Draw grid on canvas
  const drawGrid = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Apply scaling to canvas size
    const scaledWidth = Math.round(width * SCALE_FACTOR);
    const scaledHeight = Math.round(height * SCALE_FACTOR);
    canvas.width = scaledWidth + AXIS_MARGIN_RIGHT;
    canvas.height = scaledHeight + AXIS_MARGIN_TOP;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid style
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 0.5;
    const gridPx = gridSpacing * SCALE_FACTOR; // spacing in mm mapped to pixels

    // Draw vertical lines
    for (let x = 0; x <= scaledWidth; x += gridPx) {
      ctx.beginPath();
      ctx.moveTo(x, AXIS_MARGIN_TOP);
      ctx.lineTo(x, AXIS_MARGIN_TOP + scaledHeight);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= scaledHeight; y += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, AXIS_MARGIN_TOP + y);
      ctx.lineTo(scaledWidth, AXIS_MARGIN_TOP + y);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#764ba2';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, AXIS_MARGIN_TOP, scaledWidth, scaledHeight);

    // Axis graduations (mm): origin (0,0) at top-right
    ctx.fillStyle = '#eee';
    ctx.font = '12px Arial';

    // Top axis (X) outside grid, ticks every 20 mm, increasing from right to left
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    const tickLength = 6;
    const tickPx = TICK_SPACING * SCALE_FACTOR;
    const maxXTicks = Math.floor(width / TICK_SPACING);
    for (let i = 0; i <= maxXTicks; i++) {
      const x = scaledWidth - i * tickPx;
      // tick (outside, above grid)
      ctx.beginPath();
      ctx.moveTo(x, AXIS_MARGIN_TOP - tickLength);
      ctx.lineTo(x, AXIS_MARGIN_TOP);
      ctx.stroke();
      // label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(i * TICK_SPACING), x, AXIS_MARGIN_TOP - tickLength - 2);
    }

    // Right axis (Y) outside grid, ticks every 20 mm, increasing from top to bottom
    const maxYTicks = Math.floor(height / TICK_SPACING);
    for (let j = 0; j <= maxYTicks; j++) {
      const y = AXIS_MARGIN_TOP + j * tickPx;
      // tick (outside, to the right of grid)
      ctx.beginPath();
      ctx.moveTo(scaledWidth, y);
      ctx.lineTo(scaledWidth + tickLength, y);
      ctx.stroke();
      // label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(j * TICK_SPACING), scaledWidth + tickLength + 4, y);
    }

    // Dimension label (bottom-left) in mm
    ctx.fillText(`${width} x ${height} mm`, 10, AXIS_MARGIN_TOP + scaledHeight - 10);
  };

  React.useEffect(() => {
    drawGrid();
  }, [width, height]);

  // Ensure floating panels remain within the workspace when dimensions change
  React.useEffect(() => {
    const overlayEl = overlayRef.current;
    const maxX = (overlayEl?.clientWidth || window.innerWidth) - 10;
    const maxY = (overlayEl?.clientHeight || window.innerHeight) - 10;
    setManualPos((p) => ({ x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) }));
    setFilesPos((p) => ({ x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) }));
    setLaserPos((p) => ({ x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) }));
  }, [width, height]);

  // Restore panel positions from localStorage
  React.useEffect(() => {
    try {
      const parsePos = (raw) => {
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
        return null;
      };
      const m = parsePos(localStorage.getItem(POS_STORAGE_KEYS.manual));
      const f = parsePos(localStorage.getItem(POS_STORAGE_KEYS.files));
      const l = parsePos(localStorage.getItem(POS_STORAGE_KEYS.laser));
      if (m) setManualPos(m);
      if (f) setFilesPos(f);
      if (l) setLaserPos(l);
      // Restore laser settings (power and feed rate)
      const powRaw = localStorage.getItem(SETTINGS_STORAGE_KEYS.power);
      const feedRaw = localStorage.getItem(SETTINGS_STORAGE_KEYS.feed);
      if (powRaw) {
        const p = JSON.parse(powRaw);
        if (typeof p === 'number' && !Number.isNaN(p)) setLaserPower(p);
      }
      if (feedRaw) {
        const fr = JSON.parse(feedRaw);
        if (typeof fr === 'number' && !Number.isNaN(fr)) setFeedRate(fr);
      }
    } catch {}
  }, []);

  // Persist panel positions
  React.useEffect(() => {
    try { localStorage.setItem(POS_STORAGE_KEYS.manual, JSON.stringify(manualPos)); } catch {}
  }, [manualPos]);
  React.useEffect(() => {
    try { localStorage.setItem(POS_STORAGE_KEYS.files, JSON.stringify(filesPos)); } catch {}
  }, [filesPos]);
  React.useEffect(() => {
    try { localStorage.setItem(POS_STORAGE_KEYS.laser, JSON.stringify(laserPos)); } catch {}
  }, [laserPos]);

  // Listen for global save request to persist current panel positions
  React.useEffect(() => {
    const handler = () => savePanelPositions();
    window.addEventListener('save-panel-positions', handler);
    return () => window.removeEventListener('save-panel-positions', handler);
  }, [manualPos, filesPos, laserPos]);

  // Persist sliders when they change so they’re restored on next launch
  React.useEffect(() => {
    try { localStorage.setItem(SETTINGS_STORAGE_KEYS.power, JSON.stringify(laserPower)); } catch {}
  }, [laserPower]);
  React.useEffect(() => {
    try { localStorage.setItem(SETTINGS_STORAGE_KEYS.feed, JSON.stringify(feedRate)); } catch {}
  }, [feedRate]);

  const updateFilePosition = (index, x, y) => {
    const updated = [...(files || [])];
    if (!updated[index]) return;
    updated[index] = { ...updated[index], x, y };
    setFiles(updated);
  };

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const sendCommands = (cmds = []) => {
    cmds.forEach((c) => ipcRenderer.send('send-command', c));
  };

  const currentS = () => Math.round((laserPower / 100) * LASER_MAX_S);

  const handleLaserToggle = (nextState) => {
    if (!connected) return;
    if (nextState) {
      // In laser mode ($32=1), emission occurs only during motion.
      // Use an ultra‑court déplacement relatif aller‑retour pour “amorcer” sans changer la position finale.
      const F = feedRate || FEED_DEFAULT;
      sendCommands([
        'G91',
        `M3 S${currentS()}`,
        `G1 X0.01 F${F}`,
        'G1 X-0.01',
        'G90',
      ]);
    } else {
      sendCommands(['M5']);
    }
    setLaserOn(nextState);
  };

  const FEED_DEFAULT = 800;

  const runShapeSquare = (size = 20) => {
    if (!connected) return;
    const F = feedRate || FEED_DEFAULT;
    const cmds = [
      'G91',
      `M3 S${currentS()}`,
      `G1 X${size} F${F}`,
      `G1 Y${size} F${F}`,
      `G1 X-${size} F${F}`,
      `G1 Y-${size} F${F}`,
      'M5',
      'G90',
      'G0 X0 Y0',
    ];
    sendCommands(cmds);
  };

  const runShapeCircle = (diameter = 20) => {
    if (!connected) return;
    const F = feedRate || FEED_DEFAULT;
    const r = diameter / 2;
    const cmds = ['G91'];
    // Safety offset away from edges, then move to start point on circle
    cmds.push(`G0 X${(r + SAFETY_MM).toFixed(3)} Y${(r + SAFETY_MM).toFixed(3)}`);
    cmds.push(`G0 X${r.toFixed(3)} Y0`);
    // Turn laser on, draw two 180° arcs clockwise to complete the circle
    cmds.push(`M3 S${currentS()}`);
    // First semicircle: to (-r, 0) with center offset I=-r, J=0
    cmds.push(`G2 X-${diameter.toFixed(3)} Y0 I-${r.toFixed(3)} J0 F${F}`);
    // Second semicircle: back to (r, 0) with center offset I=${r}, J=0
    cmds.push(`G2 X${diameter.toFixed(3)} Y0 I${r.toFixed(3)} J0 F${F}`);
    // Laser off and back to absolute
    cmds.push('M5', 'G90', 'G0 X0 Y0');
    sendCommands(cmds);
  };

  const runShapeStar = (diameter = 20) => {
    if (!connected) return;
    const F = feedRate || FEED_DEFAULT;
    const rOuter = diameter / 2;
    const rInner = rOuter * 0.5;
    const points = [];
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      points.push({ x: rOuter * Math.cos(outerAngle), y: rOuter * Math.sin(outerAngle) });
      points.push({ x: rInner * Math.cos(innerAngle), y: rInner * Math.sin(innerAngle) });
    }
    const cmds = ['G91'];
    // Safety offset away from edges
    cmds.push(`G0 X${(rOuter + SAFETY_MM).toFixed(3)} Y${(rOuter + SAFETY_MM).toFixed(3)}`);
    // Move to first point with rapid (laser off)
    cmds.push(`G0 X${points[0].x.toFixed(3)} Y${points[0].y.toFixed(3)}`);
    // Turn laser on just before drawing
    cmds.push(`M3 S${currentS()}`);
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      cmds.push(`G1 X${dx.toFixed(3)} Y${dy.toFixed(3)} F${F}`);
    }
    // close shape
    const dxClose = points[0].x - points[points.length - 1].x;
    const dyClose = points[0].y - points[points.length - 1].y;
    cmds.push(`G1 X${dxClose.toFixed(3)} Y${dyClose.toFixed(3)} F${F}`);
    cmds.push('M5', 'G90', 'G0 X0 Y0');
    sendCommands(cmds);
  };

  const moveToCenter = () => {
    if (!connected) return;
    const cx = (width / 2).toFixed(3);
    const cy = (height / 2).toFixed(3);
    sendCommands([`G90`, `G0 X${cx} Y${cy}`]);
  };

  const runShapeGrid = (size = 20, stepMM = 5) => {
    if (!connected) return;
    const F = feedRate || FEED_DEFAULT;
    const cmds = ['G91', `M3 S${currentS()}`];
    // Draw vertical lines
    for (let x = 0; x <= size; x += stepMM) {
      cmds.push(`G0 X${x === 0 ? 0 : stepMM} Y0`);
      cmds.push(`G1 Y${size} F${F}`);
      cmds.push(`G0 Y-${size}`);
    }
    // Move back to left
    cmds.push(`G0 X-${size}`);
    // Draw horizontal lines
    for (let y = 0; y <= size; y += stepMM) {
      cmds.push(`G0 Y${y === 0 ? 0 : stepMM}`);
      cmds.push(`G1 X${size} F${F}`);
      cmds.push(`G0 X-${size}`);
    }
    cmds.push('M5', 'G90', 'G0 X0 Y0');
    sendCommands(cmds);
  };
  const zoomFile = (index, delta) => {
    const updated = [...(files || [])];
    if (!updated[index]) return;
    const current = updated[index];
    const nextScale = clamp((current.scale || 1) + delta, 0.1, 10);
    updated[index] = { ...current, scale: nextScale };
    setFiles(updated);
  };

  const deleteFile = (index) => {
    const updated = (files || []).filter((_, i) => i !== index);
    setFiles(updated);
    if (selectedIndex === index) setSelectedIndex(null);
  };

  // Send a real-time jog using GRBL $J in relative mode with feed rate
  const sendJog = (dx = 0, dy = 0) => {
    if (!connected) return;
    // Invert both axes directions to match user expectation
    const invertX = true;
    const invertY = true;

    const ix = invertX ? -dx : dx;
    const iy = invertY ? -dy : dy;

    const axes = [];
    if (ix) axes.push(`X${ix.toFixed(3)}`);
    if (iy) axes.push(`Y${iy.toFixed(3)}`);
    if (axes.length === 0) return;
    const cmd = `$J=G91 ${axes.join(' ')} F${feedRate}`;
    ipcRenderer.send('send-command', cmd);
  };

  return (
    <div className="workspace-container">
      <h2>{t('workspace.title')}</h2>
      <TransformWrapper
        initialScale={1}
        initialPositionX={0}
        initialPositionY={0}
        minScale={1}
        maxScale={1}
        wheel={{ disabled: true }}
        pinch={{ disabled: true }}
        panning={{ disabled: true }}
        doubleClick={{ disabled: true }}
      >
        {() => (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: '24px', width: '100%' }}>
            <div style={{ flex: 'none' }}>
              <TransformComponent>
                <div 
                  className="workspace-canvas"
                  style={{ position: 'relative', width: `${Math.round(width * SCALE_FACTOR) + AXIS_MARGIN_RIGHT}px`, height: `${Math.round(height * SCALE_FACTOR) + AXIS_MARGIN_TOP}px`, marginTop: '1cm' }}
                >
                  <canvas
                    ref={canvasRef}
                    width={Math.round(width * SCALE_FACTOR) + AXIS_MARGIN_RIGHT}
                    height={Math.round(height * SCALE_FACTOR) + AXIS_MARGIN_TOP}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                  {/* Real laser position dot (WPos) */}
                  {workPosition && typeof workPosition.x === 'number' && typeof workPosition.y === 'number' && (
                    (() => {
                      const scaledWidth = Math.round(width * SCALE_FACTOR);
                      const scaledHeight = Math.round(height * SCALE_FACTOR);
                      const px = clamp(scaledWidth - workPosition.x * SCALE_FACTOR, 0, scaledWidth);
                      const py = clamp(AXIS_MARGIN_TOP + workPosition.y * SCALE_FACTOR, AXIS_MARGIN_TOP, AXIS_MARGIN_TOP + scaledHeight);
                      return (
                        <div
                          title={`WPos X:${workPosition.x.toFixed(2)} Y:${workPosition.y.toFixed(2)}`}
                          style={{
                            position: 'absolute',
                            left: `${px - 4}px`,
                            top: `${py - 4}px`,
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#00bfff',
                            boxShadow: '0 0 10px rgba(0,191,255,0.95), 0 0 2px rgba(0,191,255,0.75)',
                            zIndex: 20,
                            pointerEvents: 'none'
                          }}
                        />
                      );
                    })()
                  )}
                  {(files || []).map((file, index) => {
                    if (!nodeRefs.current[index]) nodeRefs.current[index] = React.createRef();
                    const scale = file.scale || 1;
                    const isSelected = selectedIndex === index;
                    return (
                      <Draggable
                        key={index}
                        nodeRef={nodeRefs.current[index]}
                        bounds="parent"
                        position={{ x: file.x || 50, y: file.y || 50 }}
                        onStop={(e, data) => updateFilePosition(index, data.x, data.y)}
                      >
                        <div
                          ref={nodeRefs.current[index]}
                          onMouseDown={() => setSelectedIndex(index)}
                          onWheel={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const delta = e.deltaY < 0 ? +0.1 : -0.1;
                            zoomFile(index, delta);
                          }}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            cursor: 'move',
                            border: isSelected ? '1px solid rgba(255,255,255,0.7)' : 'none',
                            padding: 0,
                            backgroundColor: 'transparent',
                            color: '#eee',
                            transformOrigin: 'top left'
                          }}
                        >
                          {file.type === 'image' && (
                            <img 
                              src={file.preview} 
                              alt={file.name}
                              style={{ width: '100px', height: '100px', objectFit: 'contain', transform: `scale(${scale})` }}
                            />
                          )}
                        </div>
                      </Draggable>
                    );
                  })}

                </div>
              </TransformComponent>
            </div>

            {/* Overlay for draggable panels across the whole workspace area */}
            <div
              ref={overlayRef}
              className="workspace-overlay"
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 60 }}
            >
              {/* Draggable Manual Move Panel */}
              <Draggable
                nodeRef={manualPanelRef}
                bounds="parent"
                handle=".panel-drag-handle"
                position={manualPos}
                onStop={(e, data) => setManualPos({ x: data.x, y: data.y })}
              >
                <div
                  ref={manualPanelRef}
                  className="control-section draggable-panel"
                  style={{ position: 'absolute', width: '300px', zIndex: 50, pointerEvents: 'auto' }}
                >
                  <div className="panel-drag-handle" style={{ cursor: 'grab' }}>
                    <h2>{t('manual_move.title')}</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 60px)', gap: '8px', marginBottom: '12px' }}>
                    {[1,5,10,50].map(s => (
                      <button
                        key={s}
                        className={s === step ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => setStep(s)}
                        style={{ width: '60px', height: '32px', marginLeft: 0, padding: '6px 6px' }}
                      >
                        {s} {t('step.unit')}
                      </button>
                    ))}
                  </div>
                  <div className="form-group" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ margin: 0, whiteSpace: 'nowrap' }}>{t('feed_rate.label')}:</label>
                    <input
                      type="number"
                      value={feedRate}
                      onChange={(e) => setFeedRate(parseInt(e.target.value) || 0)}
                      min="1"
                      max="5000"
                      style={{ width: '120px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gridTemplateRows: 'repeat(3, 56px)', gap: '10px', justifyContent: 'center' }}>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(-step, step)}>↖</button>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(0, step)}>▲ Y+</button>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(step, step)}>↗</button>

                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(-step, 0)}>◀ X-</button>
                    <button className="btn-secondary" style={{ marginLeft: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={!connected} onClick={() => ipcRenderer.send('send-command', '$H')}>{t('home')}</button>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(step, 0)}>X+ ▶</button>

                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(-step, -step)}>↙</button>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(0, -step)}>Y- ▼</button>
                    <button className="btn-primary" style={{ marginLeft: 0 }} disabled={!connected} onClick={() => sendJog(step, -step)}>↘</button>
                  </div>

                  {!connected && (
                    <div style={{ marginTop: '8px', color: '#888', fontSize: '12px' }}>{t('jog.hint')}</div>
                  )}
                </div>
              </Draggable>

              {/* Draggable Files Panel */}
              <Draggable
                nodeRef={filesPanelRef}
                bounds="parent"
                handle=".panel-drag-handle"
                position={filesPos}
                onStop={(e, data) => setFilesPos({ x: data.x, y: data.y })}
              >
                <div
                  ref={filesPanelRef}
                  className="control-section draggable-panel"
                  style={{ position: 'absolute', width: '300px', zIndex: 50, pointerEvents: 'auto' }}
                >
                  <div className="panel-drag-handle" style={{ cursor: 'grab' }}>
                    <h2>{t('files.title')}</h2>
                  </div>
                  {(files || []).length === 0 && (
                    <div style={{ color: '#888', fontSize: '12px' }}>{t('files.empty')}</div>
                  )}
                  {(files || []).map((file, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '6px 0', borderBottom: '1px solid #333' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{file.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button className="btn-secondary" onClick={() => setSelectedIndex(index)} style={{ padding: '4px 8px', marginLeft: 0 }}>{t('files.select')}</button>
                        <button className="btn-secondary" onClick={() => zoomFile(index, +0.1)} style={{ padding: '4px 8px', marginLeft: 0 }}>{t('files.zoom_in')}</button>
                        <button className="btn-secondary" onClick={() => zoomFile(index, -0.1)} style={{ padding: '4px 8px', marginLeft: 0 }}>{t('files.zoom_out')}</button>
                        <button className="btn-danger" onClick={() => deleteFile(index)} style={{ padding: '4px 8px', marginLeft: 0 }}>{t('files.delete')}</button>
                      </div>
                    </div>
                  ))}
                  {(files || []).length > 0 && (
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>{t('files.hint')}</div>
                  )}
                </div>
              </Draggable>

              {/* Draggable Laser Test Panel */}
              <Draggable
                nodeRef={laserPanelRef}
                bounds="parent"
                handle=".panel-drag-handle"
                position={laserPos}
                onStop={(e, data) => setLaserPos({ x: data.x, y: data.y })}
              >
                <div
                  ref={laserPanelRef}
                  className="control-section draggable-panel"
                  style={{ position: 'absolute', width: '320px', zIndex: 55, pointerEvents: 'auto' }}
                >
                  <div className="panel-drag-handle" style={{ cursor: 'grab' }}>
                    <h2>{t('laser_test.title')}</h2>
                  </div>

                  {/* Speed (feed rate) slider */}
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ margin: 0 }}>{t('laser_test.speed')}:</label>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="50"
                      value={feedRate}
                      onChange={(e) => setFeedRate(parseInt(e.target.value) || 0)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: '70px', textAlign: 'right' }}>{feedRate} F</span>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ margin: 0 }}>{t('laser_test.power')}:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={laserPower}
                      onChange={(e) => setLaserPower(parseInt(e.target.value) || 0)}
                      disabled={!connected}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: '54px', textAlign: 'right' }}>{laserPower}%</span>
                  </div>

                  <div className="button-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button
                      className={laserOn ? 'btn-secondary' : 'btn-primary'}
                      onClick={() => handleLaserToggle(true)}
                      disabled={!connected}
                      style={{ marginLeft: 0 }}
                    >
                      {t('laser_test.on')}
                    </button>
                    <button
                      className={!laserOn ? 'btn-secondary' : 'btn-danger'}
                      onClick={() => handleLaserToggle(false)}
                      disabled={!connected}
                      style={{ marginLeft: 0 }}
                    >
                      {t('laser_test.off')}
                    </button>
                  </div>

                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <button className="btn-secondary" disabled={!connected} style={{ marginLeft: 0 }} onClick={() => runShapeSquare(20)}>{t('laser_test.square')}</button>
                    <button className="btn-secondary" disabled={!connected} style={{ marginLeft: 0 }} onClick={() => runShapeCircle(20)}>{t('laser_test.circle')}</button>
                    <button className="btn-secondary" disabled={!connected} style={{ marginLeft: 0 }} onClick={() => runShapeStar(24)}>{t('laser_test.star')}</button>
                    <button className="btn-secondary" disabled={!connected} style={{ marginLeft: 0 }} onClick={() => runShapeGrid(25, 5)}>{t('laser_test.grid')}</button>
                    <button className="btn-primary" disabled={!connected} style={{ marginLeft: 0 }} onClick={moveToCenter}>{t('laser_test.center')}</button>
                  </div>
                </div>
              </Draggable>
            </div>
          </div>
        )}
      </TransformWrapper>
    </div>
  );
}

export default Workspace;
