export async function batchTranslateJpToCn(texts, onProgress) {
  const results = new Array(texts.length).fill('');
  const BATCH = 20;

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: batch })
      });
      if (res.ok) {
        const data = await res.json();
        const tr = data.translations || [];
        for (let j = 0; j < tr.length; j++) {
          results[i + j] = tr[j] || '';
        }
      }
    } catch {}
    if (onProgress) {
      onProgress(Math.min(i + BATCH, texts.length), texts.length);
    }
  }

  return results;
}
