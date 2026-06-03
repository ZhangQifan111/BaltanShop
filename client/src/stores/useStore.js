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
    get().loadAll();
    return updated;
  },

  deleteToy: async (id) => {
    await api.del(`/toys/${id}`);
    set(s => ({ toys: s.toys.filter(t => t.id != id) }));
    get().loadAll();
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
}));

export default useStore;
