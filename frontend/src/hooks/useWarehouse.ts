import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WarehouseWand, WarehouseFolder, SmartTag, WandData, AppNotification } from '../types';

export const useWarehouse = (setNotification: (n: AppNotification | null) => void) => {
  const { t } = useTranslation();
  
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  
  const [warehouseWands, setWarehouseWands] = useState<WarehouseWand[]>(() => {
    const saved = localStorage.getItem('twwe_warehouse');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [warehouseFolders, setWarehouseFolders] = useState<WarehouseFolder[]>(() => {
    const saved = localStorage.getItem('twwe_warehouse_folders');
    let folders = saved ? JSON.parse(saved) : [];
    // 确保老古文件夹始终存在
    if (!folders.some((f: any) => f.id === 'bones_folder')) {
      folders.push({
        id: 'bones_folder',
        name: '老古法杖 (Bones)',
        order: -1,
        isOpen: true,
        parentId: null
      });
    }
    return folders;
  });
  
  const [smartTags, setSmartTags] = useState<SmartTag[]>(() => {
    const saved = localStorage.getItem('twwe_smart_tags');
    return saved ? JSON.parse(saved) : [];
  });

  // 运行时确保老古文件夹存在 (防止之前的空状态覆盖)
  useEffect(() => {
    if (!warehouseFolders.some(f => f.id === 'bones_folder')) {
      setWarehouseFolders(prev => [...prev, {
        id: 'bones_folder',
        name: '老古法杖 (Bones)',
        order: -1,
        isOpen: true,
        parentId: null
      }]);
    }
  }, [warehouseFolders, setWarehouseFolders]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('twwe_warehouse', JSON.stringify(warehouseWands));
  }, [warehouseWands]);

  useEffect(() => {
    localStorage.setItem('twwe_warehouse_folders', JSON.stringify(warehouseFolders));
  }, [warehouseFolders]);

  useEffect(() => {
    localStorage.setItem('twwe_smart_tags', JSON.stringify(smartTags));
  }, [smartTags]);

  const saveToWarehouse = useCallback(async (data: WandData) => {
    const name = prompt(t('app.notification.enter_wand_name'), t('app.notification.my_wand'));
    if (!name) return;

    let py = "", init = "";
    try {
      const res = await fetch('/api/pinyin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: name })
      });
      const pyData = await res.json();
      if (pyData.success) {
        py = pyData.pinyin;
        init = pyData.initials;
      }
    } catch (e) { 
      console.error("Pinyin fetch failed", e); 
    }

    const newWand: WarehouseWand = {
      ...data,
      id: Math.random().toString(36).substring(2, 11),
      name: name,
      pinyin: py,
      pinyin_initials: init,
      tags: [],
      createdAt: Date.now(),
      folderId: null
    };
    
    setWarehouseWands(prev => [newWand, ...prev]);
    setNotification({ msg: t('app.notification.saved_to_warehouse', { name }), type: 'success' });
    setIsWarehouseOpen(true);
  }, [t, setNotification]);

  const pullBones = useCallback(async () => {
    try {
      const res = await fetch('/api/bones');
      if (!res.ok) throw new Error('Failed to fetch bones');
      const data = await res.json();
      const bonesWands = data.wands || [];
      
      setWarehouseWands(prev => {
        const otherWands = prev.filter(w => w.folderId !== 'bones_folder');
        const newBonesWands = bonesWands.map((w: any) => ({
          ...w,
          folderId: 'bones_folder',
          id: w.id || `bone_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: w.createdAt || Date.now()
        }));
        return [...otherWands, ...newBonesWands];
      });
    } catch (e) {
      console.error('Pull bones error:', e);
      throw e;
    }
  }, [setWarehouseWands]);

  const pushBones = useCallback(async () => {
    try {
      const wandsToPush = warehouseWands.filter(w => w.folderId === 'bones_folder');
      const res = await fetch('/api/bones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wands: wandsToPush })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to push bones');
      }
    } catch (e) {
      console.error('Push bones error:', e);
      throw e;
    }
  }, [warehouseWands]);

  return {
    isWarehouseOpen,
    setIsWarehouseOpen,
    warehouseWands,
    setWarehouseWands,
    warehouseFolders,
    setWarehouseFolders,
    smartTags,
    setSmartTags,
    saveToWarehouse,
    pullBones,
    pushBones
  };
};
