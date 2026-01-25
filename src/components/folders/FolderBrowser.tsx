import { useState, useEffect } from 'react';
import { listDrives, browseDirectory, type DriveInfo } from '../../services/tauriCommands';

interface FolderBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

export function FolderBrowser({ isOpen, onClose, onSelect }: FolderBrowserProps) {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ path: string; name: string }[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDrives();
    }
  }, [isOpen]);

  const loadDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      const driveList = await listDrives();
      setDrives(driveList);
      setCurrentPath(null);
      setFolders([]);
      setBreadcrumbs([]);
    } catch (err) {
      setError('Impossible de charger les lecteurs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = async (path: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const folderList = await browseDirectory(path);
      setFolders(folderList);
      setCurrentPath(path);

      // Update breadcrumbs
      const pathParts = path.split('/').filter(Boolean);
      const newBreadcrumbs: BreadcrumbItem[] = [];
      let currentBuildPath = '';

      for (const part of pathParts) {
        currentBuildPath += '/' + part;
        newBreadcrumbs.push({
          name: part,
          path: currentBuildPath,
        });
      }

      // Replace first breadcrumb with friendly name if it's a drive
      if (newBreadcrumbs.length > 0) {
        const drive = drives.find(d => d.path === '/' + pathParts[0] || d.path === path);
        if (drive && newBreadcrumbs[0]) {
          newBreadcrumbs[0].name = name || drive.name;
        }
      }

      setBreadcrumbs(newBreadcrumbs);
    } catch (err) {
      setError('Impossible d\'accéder à ce dossier');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCurrent = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  const getDriveIcon = (driveType: string) => {
    switch (driveType) {
      case 'wsl':
        return (
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'network':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Sélectionner un dossier
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-1 text-sm overflow-x-auto">
          <button
            onClick={loadDrives}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Lecteurs
          </button>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-1">
              <span className="text-gray-400">/</span>
              <button
                onClick={() => navigateTo(crumb.path, crumb.name)}
                className={`hover:text-blue-600 whitespace-nowrap ${
                  index === breadcrumbs.length - 1
                    ? 'text-gray-900 font-medium'
                    : 'text-blue-600'
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
              <button
                onClick={loadDrives}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Retour aux lecteurs
              </button>
            </div>
          ) : currentPath === null ? (
            // Show drives
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Sélectionnez un emplacement pour commencer :
              </p>
              {drives.map((drive) => (
                <button
                  key={drive.path}
                  onClick={() => navigateTo(drive.path, drive.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  {getDriveIcon(drive.drive_type)}
                  <div>
                    <div className="font-medium text-gray-900">{drive.name}</div>
                    <div className="text-sm text-gray-500">{drive.path}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p>Ce dossier ne contient aucun sous-dossier</p>
            </div>
          ) : (
            // Show folders
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => navigateTo(folder.path, folder.name)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="text-gray-700">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {currentPath ? (
              <span className="truncate max-w-md block">{currentPath}</span>
            ) : (
              <span>Aucun dossier sélectionné</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSelectCurrent}
              disabled={!currentPath}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sélectionner ce dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
