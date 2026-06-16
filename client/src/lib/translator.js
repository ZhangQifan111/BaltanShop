export async function batchTranslateJpToCn(texts) {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts })
    });
    if (!res.ok) return new Array(texts.length).fill('');
    const data = await res.json();
    return data.translations || new Array(texts.length).fill('');
  } catch {
    return new Array(texts.length).fill('');
  }
}
