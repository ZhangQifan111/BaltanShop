import { create } from 'zustand';
import { api } from '../lib/api';

const useStore = create((set, get) => ({
  // Data
  toys: [],
  suppliers: [],
  shipments: [],
  supplies: [],
  feeRules: [],
  shippingRules: [],
  settings: {},
  stats: null,

  // UI state
  loading: false,
  toast: null,

  // 全局一键导入进度（不依赖 OrderAnalyzer 生命周期，切页不丢失）
  bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount: 0, createdCount: 0, error: null },

  // Actions
  setToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },

  loadAll: async () => {
    set({ loading: true });
    try {
      const [toys, suppliers, shipments, supplies, feeRules, shippingRules, settings, stats] = await Promise.all([
        api.get('/toys'),
        api.get('/suppliers'),
        api.get('/shipments'),
        api.get('/supplies'),
        api.get('/fee-rules'),
        api.get('/shipping-rules'),
        api.get('/settings'),
        api.get('/stats'),
      ]);
      set({ toys, suppliers, shipments, supplies, feeRules, shippingRules, settings, stats, loading: false });
    } catch (e) {
      set({ loading: false });
      get().setToast('加载失败: ' + e.message);
    }
  },

  // Toy CRUD
  addToy: async (toy) => {
    const created = await api.post('/toys', toy);
    set(s => ({ toys: [created, ...s.toys] }));
    get().loadAll();
    return created;
  },

  updateToy: async (id, toy) => {
    const updated = await api.put(`/toys/${id}`, toy);
    set(s => ({ toys: s.toys.map(t => t.id == id ? updated : t) }));
    return updated;
  },

  deleteToy: async (id) => {
    await api.del(`/toys/${id}`);
    set(s => ({ toys: s.toys.filter(t => t.id != id) }));
    get().loadAll();
  },

  deleteToys: async (ids) => {
    await api.post('/toys/batch-delete', { ids });
    set(s => ({ toys: s.toys.filter(t => !ids.includes(t.id)) }));
    get().loadAll();
    get().setToast(`已删除 ${ids.length} 件商品`);
  },

  // Supplier CRUD
  addSupplier: async (supplier) => {
    const created = await api.post('/suppliers', supplier);
    set(s => ({ suppliers: [...s.suppliers, created] }));
    return created;
  },

  // Shipment CRUD
  addShipment: async (shipment) => {
    const created = await api.post('/shipments', shipment);
    set(s => ({ shipments: [created, ...s.shipments] }));
    return created;
  },

  updateShipment: async (id, shipment) => {
    const updated = await api.put(`/shipments/${id}`, shipment);
    set(s => ({ shipments: s.shipments.map(sh => sh.id == id ? updated : sh) }));
    get().loadAll();
    return updated;
  },

  // Fee rules
  addFeeRule: async (rule) => {
    const created = await api.post('/fee-rules', rule);
    set(s => ({ feeRules: [...s.feeRules, created] }));
    return created;
  },

  deleteFeeRule: async (id) => {
    await api.del(`/fee-rules/${id}`);
    set(s => ({ feeRules: s.feeRules.filter(r => r.id != id) }));
  },

  // Settings
  saveSettings: async (settings) => {
    const updated = await api.put('/settings', settings);
    set({ settings: updated });
  },

  // Stats
  loadStats: async () => {
    const stats = await api.get('/stats');
    set({ stats });
  },

  // 一键批量导入：check → 翻译 → 入库，全程不依赖调用方组件生命周期
  // items: [{ toy, item, batchId }]
  startBulkImport: async (items) => {
    if (!items || items.length === 0) {
      get().setToast('没有可导入的商品');
      return;
    }
    // Step 1: 预检去重
    set({ bulkImport: { active: true, phase: 'check', done: 0, total: items.length, skippedCount: 0, createdCount: 0, error: null } });
    let existingIds = new Set();
    try {
      const checkRes = await api.post('/import-renrigou/check', { items: items.map(p => p.toy) });
      existingIds = new Set((checkRes.existing || []).map(e => String(e.itemId)));
      console.log('[bulkImport] check: existing=' + existingIds.size + ', total=' + items.length);
    } catch (e) {
      console.warn('check failed, fallback to no dedup:', e.message);
    }
    // 注意：p.item.itemId 是驼峰（mapItemToToy 生成的 toy 没 item_id 字段）
    const newItems = items.filter(p => {
      const id = p.item && p.item.itemId ? String(p.item.itemId) : null;
      return !id || !existingIds.has(id);
    });
    const skippedCount = items.length - newItems.length;

    if (newItems.length === 0) {
      set({ bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount, createdCount: 0, error: null } });
      get().setToast('全部 ' + items.length + ' 件都已存在，无新增');
      return;
    }

    // Step 2: 翻译（仅新 item）
    set(s => ({ bulkImport: { ...s.bulkImport, phase: 'translate', total: newItems.length, skippedCount } }));
    let translations = [];
    try {
      // 动态 import 避免循环依赖
      const { batchTranslateJpToCn } = await import('../lib/translator');
      translations = await batchTranslateJpToCn(
        newItems.map(p => p.toy.name),
        (done, total) => {
          set(s => ({ bulkImport: { ...s.bulkImport, done, total } }));
        }
      );
      newItems.forEach((p, i) => { p.toy.name_zh = translations[i] || ''; });
    } catch (e) {
      console.error('translate failed:', e);
      set({ bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount, createdCount: 0, error: '翻译失败: ' + e.message } });
      get().setToast('翻译失败: ' + e.message);
      return;
    }

    // Step 3: 入库（分批 5 件）
    set(s => ({ bulkImport: { ...s.bulkImport, phase: 'import', done: 0, total: newItems.length } }));
    const IMP_BATCH = 5;
    let allCreated = [];
    let importError = null;
    for (let i = 0; i < newItems.length; i += IMP_BATCH) {
      const batch = newItems.slice(i, i + IMP_BATCH).map(p => p.toy);
      try {
        const j = await api.post('/import-renrigou', { items: batch });
        if (j.created) allCreated.push(...j.created);
      } catch (e) {
        importError = e.message;
        break;
      }
      set(s => ({ bulkImport: { ...s.bulkImport, done: Math.min(i + IMP_BATCH, newItems.length) } }));
    }

    if (importError) {
      set({ bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount, createdCount: allCreated.length, error: importError } });
      get().setToast('部分导入失败: ' + importError);
    } else {
      // 入库成功 → 刷新 toys + 清状态 + toast
      if (allCreated.length > 0) {
        set(s => ({ toys: [...allCreated, ...s.toys] }));
      }
      set({ bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount, createdCount: allCreated.length, error: null } });
      get().setToast('✅ 导入完成：新建 ' + allCreated.length + ' 件' + (skippedCount > 0 ? '，跳过 ' + skippedCount + ' 件已存在' : ''));
    }
  },

  dismissBulkImport: () => {
    set({ bulkImport: { active: false, phase: '', done: 0, total: 0, skippedCount: 0, createdCount: 0, error: null } });
  },
}));

export default useStore;
