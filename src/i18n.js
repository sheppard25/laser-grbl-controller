import React, { createContext, useContext, useMemo, useState } from 'react';

const I18nContext = createContext({
  lang: 'fr',
  t: (key) => key,
  toggleLang: () => {},
  setLang: () => {},
});

const DICT = {
  en: {
    'connection.title': 'Connection',
    'connection.type': 'Connection Type',
    'usb.serial': 'USB Serial',
    'wifi.network': 'WiFi/Network',
    'usb.port': 'USB Port',
    'connect': 'Connect',
    'disconnect': 'Disconnect',
    'workspace_dimensions.title': 'Workspace Dimensions',
    'workspace_dimensions.width': 'Width (mm)',
    'workspace_dimensions.height': 'Height (mm)',
    'workspace_dimensions.update': 'Update Dimensions',
    'workspace_dimensions.save_all': 'Save all (dimensions + windows)',
    'grbl_commands.title': 'GRBL Commands',
    'grbl_commands.manual': 'Manual Command:',
    'grbl_commands.placeholder': 'Enter GRBL command, e.g. $H, $X, $$',
    'send': 'Send',
    'home': 'Home',
    'unlock': 'Unlock',
    'status': 'Status',
    'stop': 'Stop',
    'console_output.title': 'Console Output',
    'console_output.empty': 'No messages yet…',
    'workspace.title': 'Workspace',
    'zoom_in': 'Zoom In',
    'zoom_out': 'Zoom Out',
    'reset': 'Reset',
    'manual_move.title': 'Manual Jog',
    'feed_rate.label': 'Feed rate (F)',
    'step.unit': 'mm',
    'jog.hint': 'Connect to enable jog.',
    'files.title': 'Files on grid',
    'files.empty': 'No imported files.',
    'files.select': 'Select',
    'files.zoom_in': 'Zoom +',
    'files.zoom_out': 'Zoom -',
    'files.delete': 'Delete',
    'files.hint': 'Hint: drag files directly on the grid to move them.',
    'import.title': 'Import Files',
    'import.drop_here': 'Drop files here…',
    'import.click_or_drag': 'Click or drag files here to import',
    'import.supported': 'Supported: Images (PNG, JPG, GIF) and SVG files',
    'connection.refresh': 'Refresh port list',
    'wifi.host': 'Host/IP',
    'wifi.port': 'Port',
    'import.unsupported': 'Unsupported file type',
    'laser_test.title': 'Laser Tests',
    'laser_test.power': 'Power',
    'laser_test.on': 'Laser ON',
    'laser_test.off': 'Laser OFF',
    'laser_test.square': 'Square',
    'laser_test.circle': 'Circle',
    'laser_test.star': 'Star',
    'laser_test.grid': 'Grid',
    'laser_test.center': 'Move to center',
    'laser_test.speed': 'Speed (F)',
  },
  fr: {
    'connection.title': 'Connexion',
    'connection.type': 'Type de connexion',
    'usb.serial': 'USB Série',
    'wifi.network': 'WiFi/Réseau',
    'usb.port': 'Port USB',
    'connect': 'Se connecter',
    'disconnect': 'Se déconnecter',
    'workspace_dimensions.title': 'Dimensions de l’espace de travail',
    'workspace_dimensions.width': 'Largeur (mm)',
    'workspace_dimensions.height': 'Hauteur (mm)',
    'workspace_dimensions.update': 'Mettre à jour',
    'workspace_dimensions.save_all': 'Sauvegarder tout (dimensions + fenêtres)',
    'grbl_commands.title': 'Commandes GRBL',
    'grbl_commands.manual': 'Commande manuelle :',
    'grbl_commands.placeholder': 'Saisir une commande GRBL, ex. $H, $X, $$',
    'send': 'Envoyer',
    'home': 'Origine',
    'unlock': 'Déverrouiller',
    'status': 'Statut',
    'stop': 'Arrêter',
    'console_output.title': 'Sortie console',
    'console_output.empty': 'Aucun message pour le moment…',
    'workspace.title': 'Grille',
    'zoom_in': 'Zoom +',
    'zoom_out': 'Zoom -',
    'reset': 'Réinitialiser',
    'manual_move.title': 'Déplacement manuel',
    'feed_rate.label': 'Vitesse d’avance (F)',
    'step.unit': 'mm',
    'jog.hint': 'Connectez-vous pour activer le jog.',
    'files.title': 'Fichiers sur la grille',
    'files.empty': 'Aucun fichier importé.',
    'files.select': 'Sélectionner',
    'files.zoom_in': 'Zoom +',
    'files.zoom_out': 'Zoom -',
    'files.delete': 'Supprimer',
    'files.hint': 'Astuce : glissez les fichiers directement sur la grille pour les déplacer.',
    'import.title': 'Importer des fichiers',
    'import.drop_here': 'Déposez des fichiers ici…',
    'import.click_or_drag': 'Cliquez ou glissez des fichiers ici pour importer',
    'import.supported': 'Pris en charge : images (PNG, JPG, GIF) et fichiers SVG',
    'connection.refresh': 'Actualiser la liste des ports',
    'wifi.host': 'Hôte/IP',
    'wifi.port': 'Port',
    'import.unsupported': 'Type de fichier non pris en charge',
    'laser_test.title': 'Tests Laser',
    'laser_test.power': 'Puissance',
    'laser_test.on': 'Allumer',
    'laser_test.off': 'Éteindre',
    'laser_test.square': 'Carré',
    'laser_test.circle': 'Cercle',
    'laser_test.star': 'Étoile',
    'laser_test.grid': 'Grille',
    'laser_test.center': 'Aller au centre',
    'laser_test.speed': 'Vitesse (F)',
  },
};

export function I18nProvider({ children, defaultLang = 'fr' }) {
  const [lang, setLang] = useState(defaultLang);

  const value = useMemo(() => {
    const t = (key) => {
      const dict = DICT[lang] || DICT.fr;
      if (dict && key in dict) return dict[key];
      const fallback = DICT.en;
      return fallback && key in fallback ? fallback[key] : key;
    };
    const toggleLang = () => setLang((prev) => (prev === 'fr' ? 'en' : 'fr'));
    return { lang, setLang, toggleLang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}