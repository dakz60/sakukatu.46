// メニュー名と各機能の入力項目をまとめています。
export const labels = {
  schedule: 'スケジュール',
  tickets: '応募・チケット',
  goods: 'グッズ管理',
  photos: '生写真コレクション',
  lives: 'ライブ参戦記録',
  reports: 'ミーグリレポ',
  money: '推し活家計簿',
  todos: '推し活ToDo',
  places: '推し活マップ',
};

export const collections = Object.keys(labels);

export const forms = {
  schedule: {
    title: '予定を追加',
    fields: [
      ['title', '予定名', 'text', true],
      ['date', '日付', 'date', true],
      ['type', '種類', 'select', true, [
        'ライブ',
        'テレビ',
        'ラジオ',
        '雑誌',
        '配信',
        '発売日',
        'その他',
      ]],
      ['place', '場所・メモ', 'text', false],
    ],
  },

  tickets: {
    title: '応募を追加',
    fields: [
      ['title', 'イベント・応募名', 'text', true],
      ['date', '締切・入金期限', 'date', true],
      ['status', '状況', 'select', true, [
        '応募前',
        '申込済み',
        '当選',
        '落選',
        '入金済み',
      ]],
      ['note', 'メモ', 'text', false],
    ],
  },

  goods: {
    title: 'グッズを追加',
    fields: [
      ['title', 'グッズ名', 'text', true],
      ['type', '種類', 'select', true, [
        'ペンライト',
        'アクリルスタンド',
        'タオル',
        'CD・書籍',
        'その他',
      ]],
      ['status', '所持状況', 'select', true, [
        '所持',
        '購入予定',
        '未所持',
      ]],
      ['price', '価格（円）', 'number', false],
      ['note', 'メモ', 'text', false],
    ],
  },

  photos: {
    title: '生写真を追加',
    fields: [
      ['member', 'メンバー', 'text', true],
      ['series', 'シリーズ・衣装', 'text', true],
      ['pose', 'ポーズ・種類', 'text', false],
      ['status', '所持状況', 'select', true, [
        '所持',
        '購入予定',
        '未所持',
      ]],
      ['count', '所持枚数', 'number', false],
      ['photo', '写真画像（任意）', 'file', false],
      ['note', 'メモ', 'text', false],
    ],
  },

  lives: {
    title: 'ライブ参戦記録を追加',
    fields: [
      ['title', '公演名', 'text', true],
      ['date', '参加日', 'date', true],
      ['venue', '会場', 'text', false],
      ['seat', '座席', 'text', false],
      ['setlist', 'セットリスト・印象に残った曲', 'textarea', false],
      ['note', '感想・思い出', 'textarea', false],
    ],
  },

  reports: {
    title: 'ミーグリレポを書く',
    fields: [
      ['date', '参加日', 'date', true],
      ['member', 'メンバー', 'text', true],
      ['title', 'イベント名・部', 'text', false],
      ['note', '会話・感想・次回話したいこと', 'textarea', false],
    ],
  },

  money: {
    title: '支出を追加',
    fields: [
      ['title', '内容', 'text', true],
      ['date', '日付', 'date', true],
      ['amount', '金額（円）', 'number', true],
      ['type', 'カテゴリ', 'select', true, [
        'チケット',
        'グッズ',
        '遠征',
        'CD・書籍',
        'その他',
      ]],
    ],
  },

  todos: {
    title: 'ToDoを追加',
    fields: [
      ['title', 'やること', 'text', true],
      ['date', '期限', 'date', false],
    ],
  },

  places: {
    title: 'スポットを追加',
    fields: [
      ['title', 'スポット名', 'text', true],
      ['type', '種類', 'select', true, [
        'ライブ会場',
        '聖地巡礼',
        'お店',
        'その他',
      ]],
      ['address', '住所・エリア', 'text', false],
      ['url', '地図リンク', 'url', false],
      ['note', 'メモ', 'textarea', false],
    ],
  },
};
