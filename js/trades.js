import { db, save } from './storage.js?v=20261030-2';
import { $, escapeHtml, render, toast } from './ui.js?v=20261030-2';
import { offerCount, wantCount, applyTrade } from './collectionModel.js?v=20261030-2';
export function initTrades() {
  const modal = $('#tradeModal');
  $('#openTrade').onclick = () => {
    const candidates = db.photos.filter(item => offerCount(item) || wantCount(item));
    $('#tradeLines').innerHTML = candidates.length ? candidates.map(item => `<fieldset class="trade-line" data-trade-id="${escapeHtml(item.id)}"><legend>${escapeHtml(item.member)} / ${escapeHtml(item.series)} / ${escapeHtml(item.pose || '種類未設定')}</legend>
      <label>渡す（提供 ${offerCount(item)}枚）<input type="number" name="give" min="0" max="${offerCount(item)}" step="1" value="0" required></label>
      <label>もらう（希望 ${wantCount(item)}枚）<input type="number" name="receive" min="0" max="99999" step="1" value="0" required></label></fieldset>`).join('') : '<p>まず生写真の編集で「提供できる枚数」または「欲しい枚数」を設定してください。</p>';
    modal.classList.add('open');
  };
  $('#cancelTrade').onclick = () => modal.classList.remove('open');
  modal.onclick = event => { if (event.target === modal) modal.classList.remove('open'); };
  $('#tradeForm').onsubmit = event => {
    event.preventDefault();
    const lines = [...$('#tradeLines').querySelectorAll('[data-trade-id]')].map(row => ({ id: row.dataset.tradeId, give: Number(row.querySelector('[name="give"]').value), receive: Number(row.querySelector('[name="receive"]').value) }));
    try {
      const photos = applyTrade(db.photos, lines);
      if (!confirm('交換を確定して所持・提供・希望の枚数を更新しますか？')) return;
      const previous = db.photos;
      const record = { id: crypto.randomUUID(), date: new Date().toISOString(), lines: lines.filter(line => line.give || line.receive).map(line => { const photo = previous.find(item => String(item.id) === line.id); return { ...line, member: photo.member, series: photo.series, pose: photo.pose }; }) };
      db.photos = photos; db.trades.unshift(record);
      try { save(); } catch (error) { db.photos = previous; db.trades.shift(); throw new Error('交換を保存できませんでした。空き容量を確認してください'); }
      modal.classList.remove('open'); render(); toast('交換を記録しました');
    } catch (error) { toast(error.message || '交換を保存できませんでした'); }
  };
}
