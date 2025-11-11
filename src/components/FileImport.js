import React, { useRef, useState } from 'react';
import { useI18n } from '../i18n';

function FileImport({ onFileImport }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useI18n();

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    const processedFiles = [];

    files.forEach((file) => {
      const fileType = file.type;
      
      if (fileType.startsWith('image/')) {
        // Process image files
        const reader = new FileReader();
        reader.onload = (e) => {
          processedFiles.push({
            name: file.name,
            type: 'image',
            preview: e.target.result,
            x: 50,
            y: 50,
            scale: 1
          });

          if (processedFiles.length === files.length) {
            onFileImport(processedFiles);
          }
        };
        reader.readAsDataURL(file);
      } else if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        // Process SVG files
        const reader = new FileReader();
        reader.onload = (e) => {
          processedFiles.push({
            name: file.name,
            type: 'svg',
            content: e.target.result,
            x: 50,
            y: 50,
            scale: 1
          });

          if (processedFiles.length === files.length) {
            onFileImport(processedFiles);
          }
        };
        reader.readAsText(file);
      } else {
        // Unsupported file type
        alert(`${t('import.unsupported')}: ${file.name}`);
      }
    });
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div
      className={`file-import-panel ${isDragging ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.svg"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>{t('import.title')}</h3>
        <p style={{ color: '#888' }}>
          {isDragging
            ? t('import.drop_here')
            : t('import.click_or_drag')}
        </p>
        <p style={{ color: '#666', fontSize: '12px', marginTop: '10px' }}>
          {t('import.supported')}
        </p>
      </div>
    </div>
  );
}

export default FileImport;
