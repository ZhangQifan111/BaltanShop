import { useState, useEffect } from 'react';

function fmt(n, d) { return Number(n).toFixed(d||0); }
function yne(n) { return '¥' + Number(n).toLocaleString('zh-CN'); }
function rmb(n) { return '≈¥' + Number(n).toLocaleString('zh-CN'); }
function ts2date(ts) { const d = new Date(ts*1000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function ts2month(ts) { const d = new Date(ts*1000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }

export default function OrderAnalyzer() {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [savedFiles, setSavedFiles] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [parsedData, setParsedData] = useState(null);

  const _fetchFiles = () => {
    return fetch('/api/order-data?t=' + Date.now()).then(r => r.json());
  };

  useEffect(() => {
    _fetchFiles().then(setSavedFiles).catch(() => {});
  }, []);

  const refreshFiles = () => {
    _fetchFiles().then(setSavedFiles).catch(() => {});
  };

  const saveData = async () => {
    if (!parsedData) { setSaveMsg('请先分析数据再保存'); return; }
    try {
      const r = await fetch('/api/order-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedData) });
      const info = await r.json();
      setSaveMsg('已保存: ' + info.name);
      refreshFiles();
    } catch(e) { setSaveMsg('保存失败'); }
  };

  const loadFile = async (name) => {
    try {
      const r = await fetch('/api/order-data/' + name);
      const data = await r.json();
      setRaw(JSON.stringify(data));
      setResult(null);
      setError('');
      setSaveMsg('已加载: ' + name);
    } catch(e) { setSaveMsg('加载失败'); }
  };

  const deleteFile = async (name) => {
    try {
      const r = await fetch('/api/order-data/' + name, { method: 'DELETE' });
      const j = await r.json();
      if (!j.ok) { setSaveMsg('删除失败: ' + (j.error || 'unknown')); return; }
      setSavedFiles(prev => prev.filter(f => f.name !== name));
      setSaveMsg('已删除: ' + name);
    } catch(e) { setSaveMsg('删除失败: ' + e.message); }
  };

  const analyze = () => {
    setError('');
    setResult(null);
    if (!raw.trim()) { setError('请先粘贴 JSON 数据'); return; }

    // 跳过 JSON 之前的日志文本
    let txt = raw;
    let s = txt.indexOf('[');
    if (s > 0) txt = txt.slice(s);
    if (txt.startsWith('"') && txt.endsWith('"')) txt = txt.slice(1, -1).replace(/\\"/g, '"');
    let cleaned = txt.replace(/^\s*\/\/[^\n\r]*/gm, '');
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    let data;
    try { data = JSON.parse(cleaned); } catch(e) {
      setError('JSON 解析失败: ' + e.message);
      return;
    }
    if (!Array.isArray(data)) { setError('需要 JSON 数组'); return; }

    setParsedData(data);

    const items = [];
    data.forEach(ord => {
      (ord.body||[]).forEach(it => {
        items.push({
          orderId: ord.id,
          orderMonth: ts2month(ord.header.show_time),
          orderDate: ts2date(ord.header.show_time),
          title: (it.product_title||'').trim(),
          price: parseFloat(it.unit_price)||0,
          priceRmb: it._priceRmb||0,
          source: (it.source_site_name||'未知').trim(),
          amount: it.amount||1,
          createTs: it.create_time,
          paymentFee: it._paymentFee||0,
          paymentFeeRmb: it._paymentFeeRmb||0,
          serviceFee: it._serviceFee||0,
          serviceFeeRmb: it._serviceFeeRmb||0,
          domesticShipping: it._domesticShipping||0,
          domesticShippingRmb: it._domesticShippingRmb||0,
          coupon: it._coupon||0
        });
      });
    });

    const totalSpent = items.reduce((s,i) => s + i.price * i.amount, 0);
    const totalServiceFee = items.reduce((s,i) => s + i.serviceFee, 0);
    const totalServiceFeeRmb = items.reduce((s,i) => s + i.serviceFeeRmb, 0);
    const totalShipping = items.reduce((s,i) => s + i.domesticShipping, 0);
    const totalShippingRmb = items.reduce((s,i) => s + i.domesticShippingRmb, 0);
    const totalPaymentFee = items.reduce((s,i) => s + i.paymentFee, 0);
    const totalPaymentFeeRmb = items.reduce((s,i) => s + i.paymentFeeRmb, 0);
    const totalCoupon = items.reduce((s,i) => s + i.coupon, 0);
    const totalIntlShipping = data.reduce((s,ord) => s + ((ord._package||{}).internationalShipping||0), 0);
    const totalIntlShippingRmb = data.reduce((s,ord) => s + ((ord._package||{}).internationalShippingRmb||0), 0);
    const totalPackagingFee = data.reduce((s,ord) => s + ((ord._package||{}).packagingFee||0), 0);
    const totalPackagingFeeRmb = data.reduce((s,ord) => s + ((ord._package||{}).packagingFeeRmb||0), 0);
    const intlCount = data.filter(ord => ((ord._package||{}).internationalShipping||0) > 0).length;
    const totalAllIn = totalSpent + totalServiceFee + totalShipping + totalPaymentFee + totalIntlShipping + totalPackagingFee;
    const totalSpentRmb = items.reduce((s,i) => s + i.priceRmb * i.amount, 0);
    const totalAllInRmb = totalSpentRmb + totalServiceFeeRmb + totalShippingRmb + totalPaymentFeeRmb + totalCoupon + totalIntlShippingRmb + totalPackagingFeeRmb;
    const avgPrice = totalSpent / items.length;
    const prices = items.map(i => i.price).sort((a,b) => a-b);
    const p50 = prices[Math.floor(prices.length*0.5)];
    const p90 = prices[Math.floor(prices.length*0.9)];
    const p95 = prices[Math.floor(prices.length*0.95)];

    // 来源
    const srcMap = {};
    items.forEach(i => {
      if (!srcMap[i.source]) srcMap[i.source] = { count:0, spent:0, serviceFee:0, serviceFeeRmb:0, shipping:0, shippingRmb:0, coupon:0 };
      srcMap[i.source].count++;
      srcMap[i.source].spent += i.price * i.amount;
      srcMap[i.source].serviceFee += i.serviceFee;
      srcMap[i.source].serviceFeeRmb += i.serviceFeeRmb;
      srcMap[i.source].shipping += i.domesticShipping;
      srcMap[i.source].shippingRmb += i.domesticShippingRmb;
      srcMap[i.source].coupon += i.coupon;
    });
    const srcs = Object.entries(srcMap).sort((a,b) => b[1].spent - a[1].spent);

    // 月度
    const monthMap = {};
    items.forEach(i => {
      if (!monthMap[i.orderMonth]) monthMap[i.orderMonth] = { count:0, spent:0, serviceFee:0, serviceFeeRmb:0, shipping:0, shippingRmb:0, coupon:0 };
      monthMap[i.orderMonth].count++;
      monthMap[i.orderMonth].spent += i.price * i.amount;
      monthMap[i.orderMonth].serviceFee += i.serviceFee;
      monthMap[i.orderMonth].serviceFeeRmb += i.serviceFeeRmb;
      monthMap[i.orderMonth].shipping += i.domesticShipping;
      monthMap[i.orderMonth].shippingRmb += i.domesticShippingRmb;
      monthMap[i.orderMonth].coupon += i.coupon;
    });
    const months = Object.entries(monthMap).sort();
    const maxMonthSpent = Math.max(...months.map(e => e[1].spent));
    const maxMonthCount = Math.max(...months.map(e => e[1].count));

    // 年度
    const yearMap = {};
    const yearMonths = {};
    items.forEach(i => {
      const y = i.orderMonth.slice(0,4);
      if (!yearMap[y]) yearMap[y] = { count:0, spent:0, serviceFee:0, serviceFeeRmb:0, shipping:0, shippingRmb:0, coupon:0 };
      yearMap[y].count++;
      yearMap[y].spent += i.price * i.amount;
      yearMap[y].serviceFee += i.serviceFee;
      yearMap[y].serviceFeeRmb += i.serviceFeeRmb;
      yearMap[y].shipping += i.domesticShipping;
      yearMap[y].shippingRmb += i.domesticShippingRmb;
      yearMap[y].coupon += i.coupon;
      if (!yearMonths[y]) yearMonths[y] = new Set();
      yearMonths[y].add(i.orderMonth);
    });

    // 价格区间
    const buckets = [
      { label:'¥1~999', min:1, max:999 },
      { label:'¥1,000~4,999', min:1000, max:4999 },
      { label:'¥5,000~9,999', min:5000, max:9999 },
      { label:'¥10,000~19,999', min:10000, max:19999 },
      { label:'¥20,000~29,999', min:20000, max:29999 },
      { label:'¥30,000~49,999', min:30000, max:49999 },
      { label:'¥50,000+', min:50000, max:Infinity }
    ];
    const bucketCounts = buckets.map(b => items.filter(i => i.price>=b.min && i.price<=b.max).length);
    const maxBucket = Math.max(...bucketCounts);

    // 关键词
    const kwStop = /検\)|まとめ|未開封|美品|ジャンク|フィギュア|ソフビ|ウルトラ|怪獣|当時物|非売品|コレクション|昭和レトロ|リペイント|オリジナル|ペイント|完全復刻版|アクション|タイマー|スター|ウォーズ|BANDAI|バンダイ|円谷|プロ|ダクション|マルサン|ブルマァク|パイロット|エース|トイグラフ|M1号|マーミット|ベア|モデル|ベネリック|おとかい|おとなり|かいじゅう|ビリケン|商会|キット|未組立|エクスプラス|ギガンティック|大怪獣|シリーズ/g;
    const kwMap = {};
    items.forEach(i => {
      const t = i.title.replace(kwStop,'').replace(/[【】◆■▲▼★●◎○□■☆＊]/g,' ').replace(/\s+/g,' ').trim();
      t.split(/[\s　・\/（）\(\)、，]+/).forEach(p => {
        p = p.trim();
        if (p.length>=2 && !/^\d/.test(p)) kwMap[p] = (kwMap[p]||0)+1;
      });
    });
    const topKw = Object.entries(kwMap).sort((a,b) => b[1]-a[1]).slice(0,30);

    // 最贵
    const topExpensive = items.slice().sort((a,b) => b.price-a.price).slice(0,20);

    // ── 批次分析 ──
    const batchMap = {};
    data.forEach(ord => {
      const batchItems = (ord.body||[]).map(it => ({
        title: (it.product_title||'').trim(),
        price: parseFloat(it.unit_price)||0,
        priceRmb: it._priceRmb||0,
        source: (it.source_site_name||'未知').trim(),
        amount: it.amount||1,
        serviceFee: it._serviceFee||0,
        serviceFeeRmb: it._serviceFeeRmb||0,
        shipping: it._domesticShipping||0,
        shippingRmb: it._domesticShippingRmb||0,
        coupon: it._coupon||0
      }));
      const pkg = ord._package || {};
      batchMap[ord.id] = {
        orderId: ord.id,
        orderTs: ord.header.show_time,
        pkg,
        orderDate: ts2date(ord.header.show_time),
        items: batchItems,
        itemCount: batchItems.length,
        totalSpent: batchItems.reduce((s,i) => s + i.price*i.amount + i.serviceFee + i.shipping, 0),
        totalSpentRmb: batchItems.reduce((s,i) => s + i.serviceFeeRmb + i.shippingRmb, 0),
        sources: [...new Set(batchItems.map(i => i.source))]
      };
    });
    const batches = Object.values(batchMap);
    const batchSizeDist = {};
    batches.forEach(b => {
      const k = b.itemCount >= 5 ? '5+' : String(b.itemCount);
      batchSizeDist[k] = (batchSizeDist[k]||0) + 1;
    });
    const avgBatchSize = items.length / batches.length;
    const allBatches = batches.sort((a,b) => b.orderTs - a.orderTs);
    const multiCount = batches.filter(b => b.itemCount >= 2).length;

    setResult({
      orderCount: data.length,
      itemCount: items.length,
      totalSpent, totalSpentRmb, totalServiceFee, totalServiceFeeRmb, totalShipping, totalShippingRmb, totalPaymentFee, totalPaymentFeeRmb, totalCoupon, totalIntlShipping, totalIntlShippingRmb, totalPackagingFee, totalPackagingFeeRmb, intlCount, totalAllIn, totalAllInRmb,
      avgPrice, p50, p90, p95,
      minPrice: prices[0],
      maxPrice: prices[prices.length-1],
      srcs, months, maxMonthSpent, maxMonthCount,
      buckets, bucketCounts, maxBucket,
      yearMap, yearMonths,
      topKw, topExpensive,
      batches, batchSizeDist, avgBatchSize, allBatches, multiCount
    });
  };

  return (
    <div className="card">
      <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">任你购订单分析</div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs text-[#6b7085] flex-1">
          在任你购页面 Console 运行<a href="/fetch_all_details.js" target="_blank" className="text-accent underline mx-0.5">抓取脚本</a>，将输出的 JSON 数组粘贴到下方进行分析。
        </p>
        <a href="/fetch_all_details.js" target="_blank" className="btn-primary text-xs whitespace-nowrap">打开抓取脚本</a>
      </div>
      <textarea
        className="input text-xs w-full h-32 resize-y mb-3 font-mono"
        placeholder="粘贴 JSON 数组..."
        value={raw}
        onChange={e => setRaw(e.target.value)}
        lang="zh-CN"
        spellCheck={false}
        autoComplete="off"
      />
      <div className="flex gap-2 mb-4">
        <button className="btn-primary text-xs" onClick={analyze}>分析</button>
        {result && <button className="btn-ghost text-xs text-accent" onClick={saveData}>保存</button>}
        {saveMsg && <span className="text-xs text-[#6b7085] self-center">{saveMsg}</span>}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 mb-4">{error}</div>}

      {savedFiles.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">已保存的分析数据</div>
          <div className="space-y-1">
            {savedFiles.map(f => (
              <div key={f.name} className="flex items-center justify-between text-xs bg-bg rounded px-3 py-1.5">
                <span className="text-[#6b7085] truncate flex-1 mr-2">{f.name}</span>
                <span className="text-[#6b7085] text-[10px] mr-2 shrink-0">{f.time.slice(0,10)}</span>
                <button className="text-accent text-[11px] mr-2 shrink-0" onClick={() => loadFile(f.name)}>加载</button>
                <button className="text-red-400 text-[11px] shrink-0" onClick={() => deleteFile(f.name)}>删</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* 总览 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">
              总览 (JPY)
              {result.totalServiceFee + result.totalShipping === 0 && (
                <span className="text-[#f0883e] ml-2 font-normal">⚠ 未检测到费用数据，请用 fetch_all_details.js 重新抓取</span>
              )}
            </div>
            <div className="grid grid-cols-2 xs:grid-cols-4 gap-3">
              {[
                ['订单数', result.orderCount],
                ['商品件数', result.itemCount],
                ['商品总价', yne(result.totalSpent)],
                ['代购手续费', yne(result.totalServiceFee)],
                ['日本国内运费', yne(result.totalShipping)],
                ['国际运费', yne(result.totalIntlShipping)],
                ['包装手续费', yne(result.totalPackagingFee)],
                ['付款手续费', yne(result.totalPaymentFee)],
                ['优惠券抵扣', (result.totalCoupon||0) + ' 元'],
                ['有国际运费批次', result.intlCount + '/' + result.batches.length],
                ['合计 (含费)', yne(result.totalAllIn)],
                ['均价', yne(result.avgPrice)],
                ['中位数', yne(result.p50)],
                ['P90', yne(result.p90)],
                ['P95', yne(result.p95)],
                ['价格范围', yne(result.minPrice) + ' ~ ' + yne(result.maxPrice)],
              ].map(([label, val]) => (
                <div key={label} className="bg-bg rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-accent">{val}</div>
                  <div className="text-[10px] text-[#6b7085] mt-1">{label}</div>
                </div>
              ))}
            </div>

            {result.totalAllInRmb > 0 && (
              <div className="mt-3">
                <div className="text-xs text-accent font-bold mb-2">人民币汇总 (CNY)</div>
                <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                  {[
                    ['商品总价', result.totalSpentRmb],
                    ['代购手续费', result.totalServiceFeeRmb],
                    ['日本国内运费', result.totalShippingRmb],
                    ['付款手续费', result.totalPaymentFeeRmb],
                    ['优惠券抵扣', result.totalCoupon],
                    ['国际运费', result.totalIntlShippingRmb],
                    ['包装手续费', result.totalPackagingFeeRmb],
                    ['合计 (含所有)', result.totalAllInRmb],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-bg rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-[#f0883e]">{val ? rmb(val) : '-'}</div>
                      <div className="text-[10px] text-[#6b7085]">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 年度 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">年度统计</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6b7085] text-left">
                  <th className="py-1 pr-2">年份</th>
                  <th className="py-1 pr-2 text-right">件数</th>
                  <th className="py-1 pr-2 text-right">商品价</th>
                  <th className="py-1 pr-2 text-right">费用</th>
                  <th className="py-1 pr-2 text-right">优惠券</th>
                  <th className="py-1 text-right">合计</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.yearMap).sort().map(([y, v]) => (
                  <tr key={y} className="border-t border-white/[0.04]">
                    <td className="py-1.5 pr-2">{y}</td>
                    <td className="py-1.5 pr-2 text-right">{v.count}</td>
                    <td className="py-1.5 pr-2 text-right">{yne(v.spent)}</td>
                    <td className="py-1.5 pr-2 text-right">{yne(v.serviceFee+v.shipping)}</td>
                    <td className="py-1.5 pr-2 text-right text-[#f0883e]">{v.coupon ? v.coupon + ' 元' : ''}</td>
                    <td className="py-1.5 text-right">{yne(v.spent+v.serviceFee+v.shipping)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 来源 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">购买来源</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6b7085] text-left">
                  <th className="py-1 pr-2">来源</th>
                  <th className="py-1 pr-2 text-right">件数</th>
                  <th className="py-1 pr-2 text-right">商品价</th>
                  <th className="py-1 pr-2 text-right">手续费</th>
                  <th className="py-1 pr-2 text-right">运费</th>
                  <th className="py-1 pr-2 text-right">优惠券</th>
                  <th className="py-1 text-right">合计</th>
                </tr>
              </thead>
              <tbody>
                {result.srcs.map(([name, v]) => (
                  <tr key={name} className="border-t border-white/[0.04]">
                    <td className="py-1.5 pr-2">{name}</td>
                    <td className="py-1.5 pr-2 text-right">{v.count}</td>
                    <td className="py-1.5 pr-2 text-right">{yne(v.spent)}</td>
                    <td className="py-1.5 pr-2 text-right">{yne(v.serviceFee)}</td>
                    <td className="py-1.5 pr-2 text-right">{yne(v.shipping)}</td>
                    <td className="py-1.5 pr-2 text-right text-[#f0883e]">{v.coupon ? v.coupon + ' 元' : ''}</td>
                    <td className="py-1.5 text-right">{yne(v.spent+v.serviceFee+v.shipping)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 价格分布 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">价格分布</div>
            <div className="space-y-2">
              {result.buckets.map((b, i) => {
                const pct = fmt(result.bucketCounts[i]/result.itemCount*100, 1);
                return (
                  <div key={b.label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 text-right text-[#6b7085] shrink-0">{b.label}</span>
                    <span className="w-8 text-right shrink-0">{result.bucketCounts[i]}</span>
                    <span className="w-10 text-right text-[#6b7085] shrink-0">{pct}%</span>
                    <div className="flex-1 h-4 bg-bg rounded overflow-hidden">
                      <div className="h-full bg-[#f0883e]/60 rounded" style={{ width: Math.max(result.bucketCounts[i]/result.maxBucket*100, 1)+'%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 月度趋势 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">月度趋势</div>
            <div className="mb-2 text-[10px] text-[#6b7085]">
              <span className="inline-block w-3 h-3 bg-[#58a6ff]/60 rounded-sm mr-1 align-middle" /> 月花费
              <span className="inline-block w-3 h-3 bg-[#f0883e]/60 rounded-sm ml-3 mr-1 align-middle" /> 月件数
            </div>
            <div className="flex items-end gap-[1px] h-32 mb-2 bg-bg rounded p-1">
              {result.months.map(([m, v]) => (
                <div key={m} className="flex-1 flex flex-col justify-end min-w-[4px]" title={m + ': ' + yne(v.spent) + ' / ' + v.count + '件'}>
                  <div className="bg-[#f0883e]/60 w-full" style={{ height: (v.count/result.maxMonthCount*100)+'%' }} />
                  <div className="bg-[#58a6ff]/60 w-full" style={{ height: (v.spent/result.maxMonthSpent*100)+'%' }} />
                </div>
              ))}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6b7085] text-left">
                  <th className="py-1 pr-2">月份</th>
                  <th className="py-1 pr-2 text-right">件数</th>
                  <th className="py-1 pr-2 text-right">商品价</th>
                  <th className="py-1 pr-2 text-right">费用</th>
                  <th className="py-1 pr-2 text-right">优惠券</th>
                  <th className="py-1 text-right">合计</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map(([m, v]) => (
                  <tr key={m} className="border-t border-white/[0.04]">
                    <td className="py-1 pr-2">{m}</td>
                    <td className="py-1 pr-2 text-right">{v.count}</td>
                    <td className="py-1 pr-2 text-right">{yne(v.spent)}</td>
                    <td className="py-1 pr-2 text-right">{yne(v.serviceFee+v.shipping)}</td>
                    <td className="py-1 pr-2 text-right text-[#f0883e]">{v.coupon ? v.coupon + ' 元' : ''}</td>
                    <td className="py-1 text-right">{yne(v.spent+v.serviceFee+v.shipping)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 关键词 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">热门关键词 Top 30</div>
            <div className="flex flex-wrap gap-1.5">
              {result.topKw.map(([kw, n]) => (
                <span key={kw} className="inline-block px-2 py-0.5 bg-accent/10 text-accent rounded-full text-[11px]">
                  {kw} <span className="text-[#6b7085]">({n})</span>
                </span>
              ))}
            </div>
          </div>

          {/* 最贵 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">最贵单品 Top 20</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#6b7085] text-left">
                  <th className="py-1 pr-2">价格</th>
                  <th className="py-1 pr-2">商品</th>
                  <th className="py-1 pr-2">来源</th>
                  <th className="py-1 text-right">日期</th>
                </tr>
              </thead>
              <tbody>
                {result.topExpensive.map((i, idx) => (
                  <tr key={idx} className="border-t border-white/[0.04]">
                    <td className="py-1.5 pr-2 text-accent whitespace-nowrap">{yne(i.price)}</td>
                    <td className="py-1.5 pr-2 max-w-[200px] truncate" title={i.title}>{i.title}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{i.source}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{ts2date(i.createTs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 批次分析 */}
          <div>
            <div className="text-xs text-accent font-bold mb-3">批次分析</div>
            <div className="grid grid-cols-2 xs:grid-cols-4 gap-3 mb-4">
              {[
                ['总批次', result.batches.length],
                ['多件批次', result.multiCount],
                ['单件批次', result.batches.length - result.multiCount],
                ['平均件/批', fmt(result.avgBatchSize, 1)],
              ].map(([label, val]) => (
                <div key={label} className="bg-bg rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-accent">{val}</div>
                  <div className="text-[10px] text-[#6b7085] mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-[#6b7085] mb-2">批次规模分布</div>
            <div className="flex gap-2 mb-4">
              {Object.entries(result.batchSizeDist).sort((a,b) => {
                const o = { '1':0,'2':1,'3':2,'4':3,'5+':4 };
                return (o[a[0]]??9) - (o[b[0]]??9);
              }).map(([k, v]) => (
                <div key={k} className="bg-bg rounded-lg px-3 py-2 text-center flex-1">
                  <div className="text-sm font-bold text-accent">{v}</div>
                  <div className="text-[10px] text-[#6b7085]">{k}件/批</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-[#6b7085] mb-2">全部批次（由近到远）</div>
            {result.allBatches.map(b => {
              const mixedSources = b.sources.length >= 2;
              return (
                <div key={b.orderId} className="bg-bg rounded-lg p-3 mb-2 text-xs">
                  <div className="mb-2">
                    <div className="flex items-center gap-x-3 flex-wrap">
                      <span className="text-accent font-bold">#{b.orderId}</span>
                      <span className="text-[#6b7085]">{b.orderDate}</span>
                      <span className="text-accent">{b.itemCount}件</span>
                      {mixedSources && <span className="bg-[#f0883e]/20 text-[#f0883e] px-1.5 py-0.5 rounded text-[10px]">跨站合批</span>}
                    </div>
                    <div className="text-[#6b7085] mt-0.5">
                      {yne(b.totalSpent)}
                      {b.pkg && b.pkg.internationalShipping ? <span className="ml-2 text-[#58a6ff]">+国际 {yne(b.pkg.internationalShipping)}</span> : ''}
                      {b.pkg && b.pkg.packagingFee ? <span className="ml-2">+包装 {yne(b.pkg.packagingFee)}</span> : ''}
                    </div>
                    {(() => {
                      var pRmb = b.totalSpentRmb + (b.pkg ? (b.pkg.internationalShippingRmb||0) + (b.pkg.packagingFeeRmb||0) : 0);
                      return pRmb > 0 ? <div className="text-[10px] text-[#6b7085]">{rmb(pRmb)}</div> : null;
                    })()}
                    {b.pkg && (b.pkg.expressName || b.pkg.expressNo) ? (
                      <div className="text-[10px] text-[#6b7085] mt-0.5">
                        快递: {b.pkg.expressName}{b.pkg.expressNo ? ' ' + b.pkg.expressNo : ''}{b.pkg.weight ? ' 重量 ' + b.pkg.weight + 'g' : ''}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    {b.items.map((it, idx) => {
                      var feeJpy = it.serviceFee + it.shipping;
                      var feeRmb = it.serviceFeeRmb + it.shippingRmb;
                      var hasFee = feeJpy > 0 || feeRmb > 0 || it.coupon !== 0;
                      return (
                      <div key={idx} className="pl-2 border-l-2 border-white/[0.06] text-[11px]">
                        <div className="truncate mb-0.5">{it.title}</div>
                        <div className="text-[10px] text-[#6b7085] leading-relaxed">
                          <span className="text-accent">{yne(it.price)}</span>
                          {it.priceRmb ? <span className="text-[#f0883e] ml-1">{rmb(it.priceRmb)}</span> : null}
                          {it.serviceFee ? <span className="ml-2">代购 <span className="text-accent">+{yne(it.serviceFee)}</span><span className="text-[#f0883e]"> {rmb(it.serviceFeeRmb)}</span></span> : null}
                          {it.shipping ? <span className="ml-2">运费 <span className="text-accent">+{yne(it.shipping)}</span><span className="text-[#f0883e]"> {rmb(it.shippingRmb)}</span></span> : null}
                          {it.coupon ? <span className="ml-2 text-[#f0883e]">券 {it.coupon}元</span> : null}
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
