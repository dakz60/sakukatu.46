// メニュー名と入力項目をまとめています。
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
  milestones: 'メンバー別記念日',
};

export const collections = Object.keys(labels);

// 名前・読み・誕生日の一覧です。
// 卒業したメンバーは候補から外しています。
export const members = [
  { name: '遠藤光莉', kana: 'えんどうひかり', birthday: '1999-04-17' },
  { name: '大園玲', kana: 'おおぞのれい', birthday: '2000-04-18' },
  { name: '大沼晶保', kana: 'おおぬまあきほ', birthday: '1999-10-12' },
  { name: '幸阪茉里乃', kana: 'こうさかまりの', birthday: '2002-12-19' },
  { name: '田村保乃', kana: 'たむらほの', birthday: '1998-10-21' },
  { name: '藤吉夏鈴', kana: 'ふじよしかりん', birthday: '2001-08-29' },
  { name: '松田里奈', kana: 'まつだりな', birthday: '1999-10-13' },
  { name: '森田ひかる', kana: 'もりたひかる', birthday: '2001-07-10' },
  { name: '守屋麗奈', kana: 'もりやれな', birthday: '2000-01-02' },
  { name: '山﨑天', kana: 'やまさきてん', birthday: '2005-09-28' },
  { name: '石森璃花', kana: 'いしもりりか', birthday: '2002-01-13' },
  { name: '遠藤理子', kana: 'えんどうりこ', birthday: '2006-01-09' },
  { name: '小田倉麗奈', kana: 'おだくられいな', birthday: '2004-07-25' },
  { name: '小島凪紗', kana: 'こじまなぎさ', birthday: '2005-07-07' },
  { name: '谷口愛季', kana: 'たにぐちあいり', birthday: '2005-04-12' },
  { name: '中嶋優月', kana: 'なかしまゆづき', birthday: '2003-02-17' },
  { name: '的野美青', kana: 'まとのみお', birthday: '2006-11-08' },
  { name: '向井純葉', kana: 'むかいいとは', birthday: '2006-05-09' },
  { name: '村井優', kana: 'むらいゆう', birthday: '2004-08-18' },
  { name: '村山美羽', kana: 'むらやまみう', birthday: '2005-02-15' },
  { name: '山下瞳月', kana: 'やましたしづき', birthday: '2005-01-22' },
  { name: '浅井恋乃未', kana: 'あさいこのみ', birthday: '2004-12-22' },
  { name: '稲熊ひな', kana: 'いなぐまひな', birthday: '2006-03-09' },
  { name: '勝又春', kana: 'かつまたはる', birthday: '2004-01-24' },
  { name: '佐藤愛桜', kana: 'さとうねお', birthday: '2006-12-01' },
  { name: '中川智尋', kana: 'なかがわちひろ', birthday: '2007-09-16' },
  { name: '松本和子', kana: 'まつもとわこ', birthday: '2005-02-06' },
  { name: '目黒陽色', kana: 'めぐろひいろ', birthday: '2006-01-24' },
  { name: '山川宇衣', kana: 'やまかわうい', birthday: '2005-09-19' },
  { name: '山田桃実', kana: 'やまだももみ', birthday: '2008-07-20' },
];

export const forms = {
  milestones: {
    title: '記念日を追加',
    fields: [
      ['members', 'メンバー（複数選択可）', 'members', true],
      ['date', '記念日', 'date', true],
      ['title', 'タイトル', 'text', true],
      ['note', '思い出・メモ', 'textarea', false],
      ['photo', '思い出の画像（任意）', 'file', false],
    ],
  },
  schedule: {
    title: '予定を追加',
    fields: [
      ['title', '予定名', 'text', true],
      ['date', '日付', 'date', true],
      [
        'type',
        '種類',
        'select',
        true,
        ['ライブ', 'テレビ', 'ラジオ', '雑誌', '配信', '発売日', 'その他'],
      ],
      ['place', '場所・メモ', 'text', false],
    ],
  },

  tickets: {
    title: '応募を追加',
    fields: [
      ['title', 'イベント・応募名', 'text', true],
      ['date', '締切・入金期限', 'date', true],
      [
        'status',
        '状況',
        'select',
        true,
        ['応募前', '申込済み', '当選', '落選', '入金済み'],
      ],
      ['note', 'メモ', 'text', false],
    ],
  },

  goods: {
    title: 'グッズを追加',
    fields: [
      ['title', 'グッズ名', 'text', true],
      [
        'type',
        '種類',
        'select',
        true,
        ['ペンライト', 'アクリルスタンド', 'タオル', 'CD・書籍', 'その他'],
      ],
      ['status', '所持状況', 'select', true, ['所持', '購入予定', '未所持']],
      ['price', '価格（円）', 'number', false],
      ['note', 'メモ', 'text', false],
    ],
  },

  photos: {
    title: '生写真を追加',
    fields: [
      ['member', 'メンバー', 'member', true],
      ['category', '分類', 'select', true, ['公式ランダム', 'CD封入']],
      ['series', 'シリーズ・衣装', 'text', true],
      ['pose', 'ポーズ・種類', 'select', true, ['スワリ', 'ヨリ', 'チュウ', 'ヒキ', 'その他']],
      ['count', '所持枚数（合計）', 'number', true],
      ['keep', 'コレクションとして残す枚数', 'number', true],
      ['offer', '提供できる枚数', 'number', true],
      ['want', '欲しい枚数', 'number', true],
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
      ['member', 'メンバー', 'member', true],
      ['title', 'イベント名', 'text', false],
      ['part', '部（例：5部）', 'text', false],
      ['tickets', '使用枚数（任意）', 'number', false],
      ['memberAvatar', 'メンバーのアイコン（任意）', 'file', false],
      ['selfAvatar', '自分のアイコン（任意）', 'file', false],
      ['note', '感想・メモ', 'textarea', false],
    ],
  },

  money: {
    title: '支出を追加',
    fields: [
      ['title', '内容', 'text', true],
      ['date', '日付', 'date', true],
      ['amount', '金額（円）', 'number', true],
      [
        'type',
        'カテゴリ',
        'select',
        true,
        ['チケット', 'グッズ', '遠征', 'CD・書籍', 'その他'],
      ],
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
      [
        'type',
        '種類',
        'select',
        true,
        ['ライブ会場', '聖地巡礼', 'お店', 'その他'],
      ],
      ['address', '住所・エリア', 'text', false],
      ['url', '地図リンク', 'url', false],
      ['note', 'メモ', 'textarea', false],
    ],
  },
};
