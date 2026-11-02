'use strict';

function ticketComplete(item) {
  return ['落選', '入金済み'].includes(item.status);
}

function ticketDeadlineHint(item, now = new Date()) {
  if (ticketComplete(item) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return '';
  const [year, month, day] = item.date.split('-').map(Number);
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (days < 0) return '期限を過ぎています';
  if (days === 0) return '今日が期限';
  if (days === 1) return '明日が期限';
  return days <= 7 ? `あと${days}日` : '';
}

function renderTicketRows(items) {
  $('#resetTickets').hidden = !$('[data-search="tickets"]').value && !$('[data-filter="tickets"]').value;
  $('#ticketSummary').textContent = `${items.length}件を表示 / 全${db.tickets.length}件`;
  if (!items.length) return empty(db.tickets.length ? '条件に合う応募はありません' : '応募は未登録です');
  const sorted = [...items].sort((a, b) => Number(ticketComplete(a)) - Number(ticketComplete(b)) || (a.date || '9999').localeCompare(b.date || '9999'));
  return sorted.map(item => {
    const index = db.tickets.indexOf(item), hint = ticketDeadlineHint(item);
    return `<article class="ticket-row"><div class="ticket-heading"><h3>${escapeHtml(item.title || '名称未登録')}</h3><span class="ticket-status">状況：${escapeHtml(item.status || '未設定')}</span></div>
      <div class="ticket-deadline"><span>締切・入金期限</span><time datetime="${escapeHtml(item.date || '')}">${escapeHtml(item.date?.replaceAll('-', '/') || '未設定')}</time>${hint ? `<strong>${hint}</strong>` : ''}</div>
      ${item.note ? `<p class="ticket-note">${escapeHtml(item.note)}</p>` : ''}
      <div class="ticket-actions"><button type="button" class="secondary" data-edit-ticket="${index}" aria-label="${escapeHtml(item.title || '応募')}を編集">編集</button><button type="button" class="del" data-delete="tickets" data-index="${index}" aria-label="${escapeHtml(item.title || '応募')}を削除">削除</button></div></article>`;
  }).join('');
}
