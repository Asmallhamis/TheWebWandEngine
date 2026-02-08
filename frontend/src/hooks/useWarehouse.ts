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
    return saved ? JSON.parse(saved) : [];
  });
  
  const [smartTags, setSmartTags] = useState<SmartTag[]>(() => {
    const saved = localStorage.getItem('twwe_smart_tags');
    return saved ? JSON.parse(saved) : [];
  });

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

  return {
    isWarehouseOpen,
    setIsWarehouseOpen,
    warehouseWands,
    setWarehouseWands,
    warehouseFolders,
    setWarehouseFolders,
    smartTags,
    setSmartTags,
    saveToWarehouse
  };
};
