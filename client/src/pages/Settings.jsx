import { useState, useEffect } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import OrderAnalyzer from '../components/OrderAnalyzer';

export default function Settings() {
  const { suppliers, feeRules, addSupplier, addFeeRule, deleteFeeRule, setToast } = useStore();
  const [newSupplier, setNewSupplier] = useState({ name: '', source: '', contact: '' });
  const [newRule, setNewRule] = useState({ name: '', fee_type: 'xianyu', rate: '1.6', flat_fee: '0' });
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    api.get('/settings/categories')
      .then(cats => setCategories(cats))
      .catch(() => {});
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      const created = await api.post('/settings/categories', { name: newCat.trim() });
      setCategories(prev => [...prev, created]);
      setNewCat('');
    } catch (err) {
      setToast(err.message || '添加失败');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.del(`/settings/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setToast?.('删除失败');
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    await addSupplier(newSupplier);
    setNewSupplier({ name: '', source: '', contact: '' });
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.name) return;
    await addFeeRule({ ...newRule, rate: +newRule.rate, flat_fee: +newRule.flat_fee });
    setNewRule({ name: '', fee_type: 'xianyu', rate: '1.6', flat_fee: '0' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">设置</h2>
        <p className="text-xs text-[#6b7085]">供应商、费用规则、系统配置</p>
      </div>

      {/* 供应商管理 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">供应商</div>
        <form className="flex gap-2 mb-4" onSubmit={handleAddSupplier}>
          <input className="input text-xs flex-1" placeholder="供应商名称" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
          <input className="input text-xs w-28" placeholder="来源" value={newSupplier.source} onChange={e => setNewSupplier({ ...newSupplier, source: e.target.value })} />
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <div className="text-sm">{s.name}</div>
                {s.source && <div className="text-[10px] text-[#6b7085]">{s.source}</div>}
              </div>
              {s.contact && <div className="text-xs text-[#6b7085]">{s.contact}</div>}
            </div>
          ))}
          {suppliers.length === 0 && <div className="text-xs text-[#6b7085] text-center py-4">暂无供应商</div>}
        </div>
      </div>

      {/* 费用规则 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">费用规则</div>
        <form className="flex gap-2 mb-4 flex-wrap" onSubmit={handleAddRule}>
          <input className="input text-xs flex-1" placeholder="规则名称" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} />
          <select className="input text-xs w-24" value={newRule.fee_type} onChange={e => setNewRule({ ...newRule, fee_type: e.target.value })}>
            <option value="xianyu">闲鱼</option>
            <option value="huabei">花呗</option>
            <option value="other">其他</option>
          </select>
          <input className="input text-xs w-20" type="text" inputmode="decimal" step="0.1" placeholder="费率%" value={newRule.rate} onChange={e => setNewRule({ ...newRule, rate: e.target.value })} />
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="space-y-2">
          {feeRules.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <div className="text-sm">{r.name}</div>
                <div className="text-[10px] text-[#6b7085]">{r.fee_type === 'xianyu' ? '闲鱼' : r.fee_type === 'huabei' ? '花呗' : '其他'} · {r.rate}% {r.flat_fee > 0 ? `+ ¥${r.flat_fee}` : ''}</div>
              </div>
              <button className="btn-ghost text-xs text-red-400" onClick={() => setPendingDelete({ type: 'feeRule', id: r.id, name: r.name })}>删除</button>
            </div>
          ))}
          {feeRules.length === 0 && <div className="text-xs text-[#6b7085] text-center py-4">暂无费用规则</div>}
        </div>
      </div>

      {/* 分类管理 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">商品分类</div>
        <form className="flex gap-2 mb-3" onSubmit={handleAddCategory}>
          <input className="input text-xs flex-1" placeholder="新分类名称" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 badge badge-gray cursor-pointer group"
              onClick={() => setPendingDelete({ type: 'category', id: cat.id, name: cat.name })}
              title="点击删除"
            >
              {cat.name}
              <span className="text-red-400 opacity-0 group-hover:opacity-100 text-[10px] transition-opacity">×</span>
            </span>
          ))}
        </div>
        {categories.length === 0 && <div className="text-xs text-[#6b7085] mt-2">暂无分类</div>}
        <p className="text-[10px] text-[#6b7085] mt-3">点击分类可删除</p>
      </div>

      {/* 任你购订单分析 */}
      <OrderAnalyzer />

      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.type === 'category' ? '删除分类' : '删除费用规则'}
          message={`确认删除「${pendingDelete.name}」吗？`}
          onConfirm={async () => {
            try {
              if (pendingDelete.type === 'category') {
                await handleDeleteCategory(pendingDelete.id);
              } else {
                await deleteFeeRule(pendingDelete.id);
              }
            } catch (e) {}
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* 备份 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">数据备份</div>
        <p className="text-xs text-[#6b7085] mb-3">启动时会自动备份，最近 10 份保存在服务器上</p>
        <button
          className="btn-primary text-xs"
          onClick={async () => {
            try {
              const res = await fetch('/api/backup', { method: 'POST' });
              const data = await res.json();
              setToast('备份成功: ' + data.filename);
            } catch (e) {
              setToast('备份失败');
            }
          }}
        >
          立即备份
        </button>
      </div>
    </div>
  );
}
