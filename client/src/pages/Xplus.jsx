import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import useStore from '../stores/useStore';
import ImageModal from '../components/ImageModal';

const MUSEUM_STYLE = {
  bg: '#FFFFCC',
  bgImage: 'url(/uploads/xplus/banners/back_img.jpg)',
};

const SERIES_BANNER = {
  'ultraq': '/uploads/xplus/banners/ultraq.jpg',
  'ultraman': '/uploads/xplus/banners/man.jpg',
  'ultraseven': '/uploads/xplus/banners/seven.jpg',
  'return-of-ultraman': '/uploads/xplus/banners/reultra.jpg',
  'ultraman-ace': '/uploads/xplus/banners/ace.jpg',
  'ultramantaro': '/uploads/xplus/banners/taro.jpg',
  'magmataisi': '/uploads/xplus/banners/magma.jpg',
  'soutennenshoku': '/uploads/xplus/banners/soutennen.jpg',
  'sekai': '/uploads/xplus/banners/sekai.jpg',
  'ultranewgeneration': '/uploads/xplus/banners/ung.jpg',
  'daiei20cm': '/uploads/xplus/banners/daiei.jpg',
  'p-pro': '/uploads/xplus/banners/pp.jpg',
  'boosuka': '/uploads/xplus/banners/boosuka.jpg',
  'toho20cm': '/uploads/xplus/banners/toho20.jpg',
  'toho30cm': '/uploads/xplus/banners/toho30.jpg',
  'daiei30cm': '/uploads/xplus/banners/daiei30.jpg',
  'realmastercollection': '/uploads/xplus/banners/rmc.jpg',
  'diecast-age': '/uploads/xplus/banners/dage.jpg',
  'ray-harryhausen': '/uploads/xplus/banners/hhfl.jpg',
  'youkaisinsiroku': '/uploads/xplus/banners/youkai.jpg',
};

const DAIKAIJU_BANNER = '/uploads/xplus/banners/dkjs.jpg';
const DAIKAIJU_SERIES = new Set([
  'ultraq', 'ultraman', 'ultraseven', 'return-of-ultraman',
  'ultraman-ace', 'ultramantaro', 'magmataisi', 'soutennenshoku',
  'sekai', 'ultranewgeneration', 'daiei20cm', 'p-pro', 'boosuka',
]);

// ============ 产品卡片 ============
function ItemCard({ item, onClick }) {
  return (
    <button type="button" onClick={() => onClick(item)}
      className="flex flex-col items-center group"
      style={{ width: 106, height: 106, margin: 3, padding: 2,
        border: '1px solid #990000', background: '#fff' }}>
      <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="max-w-full max-h-full object-contain" loading="lazy" />
        ) : <span className="text-lg text-[#999]">?</span>}
      </div>
    </button>
  );
}

// ============ 角色卡片 ============
function CharacterCard({ character, onClick }) {
  return (
    <button type="button" onClick={() => onClick(character)}
      className="flex flex-col items-center group"
      style={{ width: 106, margin: 3, padding: 2,
        border: '1px solid #990000', background: '#fff', cursor: 'pointer' }}>
      <div className="flex items-center justify-center overflow-hidden" style={{ width: 100, height: 100 }}>
        {character.image_url ? (
          <img src={character.image_url} alt="" className="max-w-full max-h-full object-contain" loading="lazy" />
        ) : <span className="text-2xl text-[#999]">?</span>}
      </div>
      <div className="w-full text-center mt-1 pb-1" style={{ borderTop: '1px dashed #CC6600' }}>
        <div className="text-[10px] text-[#990000] font-bold leading-tight truncate px-0.5"
          title={character.character_name}>{character.character_name}</div>
        <div className="text-[9px] text-[#CC6600]">{character.count}版</div>
      </div>
    </button>
  );
}

// ============ 详情弹窗 ============
function DetailModal({ item, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  const allImages = (() => {
    const imgs = [];
    if (item.image_url) imgs.push(item.image_url);
    if (item.images) {
      try { (typeof item.images === 'string' ? JSON.parse(item.images) : item.images)
        .forEach(u => { if (u.split('?')[0] !== (item.image_url || '').split('?')[0]) imgs.push(u); }); } catch {}
    }
    return imgs;
  })();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const fields = [
    ['商品名', item.product_name], ['発売日', item.release_date],
    ['材質', item.material], ['仕様', item.specs], ['全高', item.height],
    ['価格', item.price], ['パッケージ', item.package_info],
    ['付属', item.accessories], ['バリエーション', item.variations],
  ].filter(([, v]) => v);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="rounded w-full max-w-lg max-h-[90vh] overflow-y-auto"
          style={{ background: '#FFFFCC', border: 'double #990000 5px' }}>
          {allImages.length > 0 && (
            <div className="relative bg-black/10">
              <img src={allImages[imgIdx]} alt="" className="w-full object-contain cursor-pointer"
                style={{ maxHeight: '320px' }} onClick={() => setLightbox({ url: allImages[imgIdx] })} />
              {allImages.length > 1 && (
                <div className="flex justify-center gap-1.5 p-2">
                  {allImages.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImgIdx(i)}
                      className="w-2.5 h-2.5 rounded-full border transition-colors"
                      style={{ background: i === imgIdx ? '#CC6600' : '#ccc',
                        borderColor: i === imgIdx ? '#990000' : '#999' }} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="p-4 space-y-2">
            <h2 className="text-sm font-bold text-[#660000] mb-3"
              style={{ borderBottom: '1px dashed #CC6600', paddingBottom: 8 }}>
              {item.product_name || item.ref_id}
            </h2>
            <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-xs">
              {fields.map(([label, value]) => (
                <div key={label} className="contents">
                  <div className="text-[#CC6600] font-bold">{label}</div>
                  <div className="text-[#333]">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 flex justify-end" style={{ borderTop: '1px dashed #CC6600' }}>
            <button type="button" onClick={onClose}
              className="px-5 py-1.5 text-xs rounded font-bold transition-colors"
              style={{ background: '#CC6600', color: '#fff', border: '1px solid #990000' }}>
              閉じる
            </button>
          </div>
        </div>
      </div>
      {lightbox && <ImageModal src={lightbox.url} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ============ 返回按钮 ============
function BackButton({ onClick }) {
  return (
    <div style={{ padding: '0 20px', marginBottom: 8 }}>
      <button type="button" onClick={onClick}
        style={{ background: '#CC6600', color: '#fff', border: '1px solid #990000',
          padding: '6px 16px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
        ← 戻る
      </button>
    </div>
  );
}

// ============ 第一层：系列首页 ============
function SeriesHome({ seriesGroups, onSelectSeries }) {
  return (
    <div>
      <div className="flex justify-center" style={{ margin: '10px 40px' }}>
        <img src="/uploads/xplus/banners/top_title.gif" alt="大玩具博物館" style={{ height: 60 }} />
      </div>

      {/* 大怪獣シリーズ */}
      {seriesGroups.daikaiju?.length > 0 && (
        <div style={{ maxWidth: 550, margin: '10px auto' }}>
          <div style={{ marginBottom: 4 }}>
            <img src={DAIKAIJU_BANNER} alt="大怪獣シリーズ" style={{ width: '100%', maxWidth: 550, height: 85 }} />
          </div>
          <div style={{ padding: '0 2px', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {seriesGroups.daikaiju.map((g) => (
              <button key={g.series} type="button" onClick={() => onSelectSeries(g.series)} className="group"
                style={{ width: 178, height: 70, margin: '0 2px 4px 2px',
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                {SERIES_BANNER[g.series] ? (
                  <img src={SERIES_BANNER[g.series]} alt={g.name}
                    style={{ width: 178, height: 70, border: 0, opacity: 0.9 }}
                    className="group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div style={{ width: 178, height: 70, display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-start', fontSize: 12, color: '#990000' }}>{g.name}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 独立系列 */}
      {seriesGroups.standalone?.map((g) => (
        <button key={g.series} type="button" onClick={() => onSelectSeries(g.series)} className="block group"
          style={{ maxWidth: 550, margin: '10px auto', border: 'none',
            background: 'transparent', cursor: 'pointer', padding: 0, display: 'block' }}>
          <div style={{ height: 85, width: '100%', maxWidth: 550, margin: '0 auto' }}>
            <img src={SERIES_BANNER[g.series]} alt={g.name}
              style={{ width: '100%', maxWidth: 550, height: 85, opacity: 0.9 }}
              className="group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ============ 第二层：某系列下角色列表 ============
function CharacterList({ seriesName, characters, onSelectCharacter, onBack }) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <div style={{ maxWidth: 688, margin: '0 auto 10px', padding: 5,
        background: '#CC6600', color: '#660000', fontSize: 20, fontWeight: 'bold',
        textAlign: 'center', border: 'double #990000 5px' }}>
        {seriesName}
        <span className="ml-2 text-sm font-normal" style={{ color: '#990000' }}>
          ({characters.length}角色)
        </span>
      </div>
      <div style={{ maxWidth: 708, margin: '10px auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {characters.map(ch => (
          <CharacterCard key={ch.character_name} character={ch} onClick={onSelectCharacter} />
        ))}
      </div>
    </div>
  );
}

// ============ 第三层：角色详情（所有版本）============
function CharacterDetail({ characterName, items, onBack }) {
  const [detail, setDetail] = useState(null);

  return (
    <div>
      <BackButton onClick={onBack} />
      <div style={{ maxWidth: 688, margin: '0 auto 10px', padding: 5,
        background: '#CC6600', color: '#660000', fontSize: 20, fontWeight: 'bold',
        textAlign: 'center', border: 'double #990000 5px' }}>
        {characterName}
        <span className="ml-2 text-sm font-normal" style={{ color: '#990000' }}>
          ({items.length}種)
        </span>
      </div>
      <div style={{ maxWidth: 708, margin: '10px auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {items.map(item => (
          <ItemCard key={item.id} item={item} onClick={setDetail} />
        ))}
      </div>
      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ============ 主组件 ============
export default function Xplus() {
  const [seriesList, setSeriesList] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 导航状态：null=系列首页, {series}=角色列表, {series,character}=产品列表
  const [nav, setNav] = useState(null);

  const [characters, setCharacters] = useState([]);
  const [charLoading, setCharLoading] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const setToast = useStore(s => s.setToast);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/xplus/series');
        setSeriesList(r.series || []);
      } catch (e) {
        setToast('加载失败: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();

    // 后台加载所有 items 用于角色详情
    api.get('/xplus/items').then(r => setAllItems(r.items || [])).catch(() => {});
  }, []);

  // 当选中系列时加载该系列的角色
  useEffect(() => {
    if (!nav?.series) { setCharacters([]); return; }
    (async () => {
      setCharLoading(true);
      try {
        const r = await api.get(`/xplus/characters?series=${encodeURIComponent(nav.series)}`);
        setCharacters(r.characters || []);
      } catch { /* ignore */ } finally {
        setCharLoading(false);
      }
    })();
  }, [nav?.series]);

  const seriesGroups = useMemo(() => {
    const daikaiju = []; const standalone = [];
    for (const s of seriesList) {
      (DAIKAIJU_SERIES.has(s.series) ? daikaiju : standalone).push(s);
    }
    return { daikaiju, standalone };
  }, [seriesList]);

  const currentSeriesName = useMemo(() => {
    if (!nav?.series) return '';
    const s = seriesList.find(s => s.series === nav.series);
    return s?.series_name_ja || nav.series;
  }, [nav?.series, seriesList]);

  const currentCharacterItems = useMemo(() => {
    if (!nav?.character) return [];
    return allItems.filter(i => i.character_name === nav.character);
  }, [nav?.character, allItems]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus({ kind: 'running', message: '正在爬取...' });
    try {
      await api.post('/xplus/refresh');
      setSyncStatus({ kind: 'running', message: '正在下载图片...' });
      await api.post('/xplus/download-images');
      setSyncStatus({ kind: 'success', message: '同步完成' });
      const [sr, ir] = await Promise.all([api.get('/xplus/series'), api.get('/xplus/items')]);
      setSeriesList(sr.series || []);
      setAllItems(ir.items || []);
    } catch (e) {
      setSyncStatus({ kind: 'error', message: '同步失败: ' + e.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-sm" style={{ background: '#FFFFCC', color: '#990000' }}>加载中...</div>;
  }

  return (
    <div style={{
      background: MUSEUM_STYLE.bg, backgroundImage: MUSEUM_STYLE.bgImage,
      minHeight: 400, padding: '10px 0 20px',
      fontFamily: '"MS PGothic", Osaka, "Hiragino Kaku Gothic Pro W3", sans-serif',
      color: '#333',
    }}>
      {/* 同步按钮 */}
      {!nav && (
        <div style={{ textAlign: 'right', padding: '0 20px', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#990000', marginRight: 8 }}>{syncStatus?.message || ''}</span>
          <button type="button" disabled={syncing} onClick={handleSync}
            style={{ padding: '4px 12px', fontSize: 11,
              background: syncing ? '#ddd' : '#CC6600', color: syncing ? '#999' : '#fff',
              border: '1px solid #990000', cursor: syncing ? 'wait' : 'pointer', fontWeight: 'bold' }}>
            {syncing ? '同期中…' : '🔄 同期'}
          </button>
        </div>
      )}

      {/* 三层导航 */}
      {!nav ? (
        seriesList.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: '#990000' }}>
            データがありません。「🔄 同期」をクリックしてください
          </div>
        ) : (
          <SeriesHome seriesGroups={seriesGroups} onSelectSeries={(s) => setNav({ series: s })} />
        )
      ) : nav.character ? (
        <CharacterDetail
          characterName={nav.character}
          items={currentCharacterItems}
          onBack={() => setNav({ series: nav.series })}
        />
      ) : charLoading ? (
        <div className="text-center py-10 text-sm" style={{ color: '#990000' }}>加载中...</div>
      ) : (
        <CharacterList
          seriesName={currentSeriesName}
          characters={characters}
          onSelectCharacter={(ch) => setNav({ series: nav.series, character: ch.character_name })}
          onBack={() => setNav(null)}
        />
      )}

      {/* 版权 */}
      <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 12,
        borderTop: '1px dashed #CC6600', fontSize: 10, color: '#999' }}>
        「少年リック」 ホームページに掲載の画像・データの無断転用・転載を禁じます。<br />
        Copyright© X PLUS CO.,LTD. All Rights Reserved.
      </div>
    </div>
  );
}
