"""Run: python3 tests/browser_smoke.py (requires Playwright and system Chromium).
Uses its own HTTP server and fresh temporary browser context; never loads a user profile.
"""
import base64
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=')
try:
 with sync_playwright() as p:
  browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
  context = browser.new_context(storage_state={'cookies': [], 'origins': []})
  page = context.new_page(); page.set_default_timeout(5000)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}')
  def nav(name): page.locator(f'#nav [data-page="{name}"]').click()
  def submit():
   page.locator('#itemForm [type="submit"]').click()
   page.wait_for_selector('#modalWrap:not(.open)',state='attached')
  def image(): page.locator('[name="photo"]').set_input_files({'name':'photo.png','mimeType':'image/png','buffer':PNG})
  assert page.locator('#page-home').evaluate('(el)=>el.classList.contains("active")')
  assert page.locator('.top-actions .avatar').count()==0
  nav('photos')
  # Independent inventories, each with its own image and count.
  def photo(member, series, pose, count):
   page.locator('[data-add="photos"]:not([data-wish])').click()
   for key,value in {'member':member,'series':series,'count':str(count)}.items(): page.locator(f'[name="{key}"]').fill(value)
   page.locator('[name="pose"]').select_option(pose);image();submit();page.wait_for_selector('.photo-card img')
  photo('森田ひかる','衣装A','ヨリ',1)
  page.locator('[data-photo-view="offer"]').click();assert page.locator('.photo-card').count()==0
  photo('森田ひかる','衣装A','ヨリ',2)
  page.locator('[data-photo-view="owned"]').click();assert page.locator('.photo-counter strong').inner_text()=='1枚'
  page.locator('[data-edit-photo]').click();page.locator('[name="count"]').fill('3');submit()
  page.locator('[data-photo-view="offer"]').click();assert page.locator('.photo-counter strong').inner_text()=='2枚'
  page.locator('[data-photo-view="want"]').click()
  page.locator('[data-add="photos"]:not([data-wish])').click()
  for key,value in {'member':'田村保乃','series':'CD封入B','count':'1'}.items():page.locator(f'[name="{key}"]').fill(value)
  page.locator('[name="pose"]').select_option('その他');page.locator('[name="customPose"]').fill('タイプA')
  page.locator('[name="category"]').select_option('CD封入');image();submit();page.wait_for_selector('.photo-card img')
  page.locator('[data-edit-photo]').click();assert page.locator('[name="customPose"]').input_value()=='タイプA';page.locator('#cancelBtn').click()
  page.locator('[data-photo-view="offer"]').click()
  assert 'ダブり' not in page.locator('#page-photos').inner_text()
  page.locator('#openTrade').click();page.locator('#cancelTrade').click();assert page.locator('.photo-counter strong').inner_text()=='2枚'
  page.locator('#openTrade').click();lines=page.locator('.trade-line')
  lines.nth(0).locator('[name="receive"]').fill('1');lines.nth(1).locator('[name="give"]').fill('2')
  page.evaluate("() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(){throw new Error('simulated quota failure')}; }")
  page.once('dialog',lambda dialog:dialog.accept());page.locator('#tradeForm [type="submit"]').click()
  assert page.locator('#tradeModal').evaluate('(el)=>el.classList.contains("open")');assert page.locator('.photo-counter strong').inner_text()=='2枚'
  assert not page.locator('#tradeHistory .data-row').count()
  page.evaluate('() => { Storage.prototype.setItem = window.originalSetItem; }')
  page.once('dialog',lambda dialog:dialog.accept());page.locator('#tradeForm [type="submit"]').click();page.wait_for_selector('#tradeModal:not(.open)',state='attached')
  assert page.locator('.photo-counter strong').inner_text()=='0枚'
  page.locator('[data-photo-view="owned"]').click();assert page.locator('.photo-card').count()==2
  assert page.locator('.photo-counter strong').all_inner_texts()==['3枚','1枚']
  assert page.locator('#tradeHistory').text_content().count('受け取った')==2
  page.reload();assert page.locator('#page-home').evaluate('(el)=>el.classList.contains("active")');nav('photos')
  assert page.locator('.photo-card').count()==2;page.wait_for_function("document.querySelectorAll('#list-photos img').length === 2")
  # Multi-member anniversary with image, filtering, edit and persistence.
  nav('milestones');page.locator('[data-add="milestones"]').click()
  page.locator('[name="title"]').fill('初ファンサ')
  page.locator('#itemForm [type="submit"]').click();assert page.locator('#toast').inner_text()=='メンバーを1人以上選んでください'
  for name in ['森田ひかる','田村保乃']:page.locator(f'#itemForm [name="members"][value="{name}"]').check()
  page.locator('[name="title"]').fill('初ファンサ');page.locator('[name="date"]').fill('2025-11-01');page.locator('[name="note"]').fill('大切な思い出');image();submit()
  page.wait_for_selector('#list-milestones img');assert '森田ひかる' in page.locator('#list-milestones').inner_text()
  page.locator('#milestoneMember').select_option('山﨑天');assert page.locator('#list-milestones .milestone-card').count()==0
  page.locator('#milestoneMember').select_option('田村保乃');page.locator('[data-edit-milestone]').click();page.locator('[name="title"]').fill('初ファンサ記念');submit();page.wait_for_selector('#list-milestones img')
  # Favorite home anniversaries.
  nav('home');page.locator('#editProfile').click();page.locator('#profileMembers input[value="森田ひかる"]').check();page.locator('[data-favorite-since="森田ひかる"]').fill('2025-01-01');page.locator('#profileForm [type="submit"]').click()
  assert '初ファンサ記念' in page.locator('#homeMilestones').inner_text()
  assert '日目' in page.locator('#favoriteDays').inner_text()
  # Existing report -> anniversary prefill, no duplicate source record.
  nav('reports');page.locator('[data-add="reports"]').click();page.locator('[name="member"]').fill('森田ひかる');page.locator('[name="title"]').fill('初ミーグリ');page.locator('[name="note"]').fill('話せた')
  page.locator('[name="part"]').fill('5部');page.locator('[name="tickets"]').fill('3')
  for field in ['memberAvatar','selfAvatar']: page.locator(f'[name="{field}"]').set_input_files({'name':'icon.png','mimeType':'image/png','buffer':PNG})
  for kind,text in [('member','おかえり〜'),('self','ただいま！'),('note','（用紙を出す）')]:
   page.locator(f'[data-add-message="{kind}"]').click();page.locator(f'[data-message-input="{kind}"]').fill(text)
  page.locator('[data-add-message="image"]').click();page.locator('[data-message-input="image"]').set_input_files({'name':'memory.png','mimeType':'image/png','buffer':PNG})
  submit();page.wait_for_function("document.querySelectorAll('#list-reports img').length === 4")
  assert page.locator('#list-reports .from-self').count()==1
  assert '5部' in page.locator('#list-reports .report-header').inner_text()
  page.locator('#list-reports [data-edit-report]').click()
  page.locator('.conversation-block').nth(1).get_by_role('button',name='この会話を上へ').click()
  submit();assert 'from-self' in page.locator('#list-reports .report-message').first.get_attribute('class')
  page.locator('[data-search="reports"]').fill('ただいま');assert page.locator('#list-reports .report-card').count()==1
  page.locator('[data-search="reports"]').fill('見つからない内容');assert page.locator('#list-reports .report-card').count()==0
  page.locator('[data-search="reports"]').fill('')
  page.locator('#list-reports [data-create-milestone]').click();assert page.locator('[name="title"]').input_value()=='初ミーグリ';assert page.locator('#itemForm [name="members"]:checked').count()==1;submit()
  page.locator('#list-reports [data-create-milestone]').click();assert '編集' in page.locator('#modalTitle').inner_text();page.locator('#cancelBtn').click()
  page.reload();assert '2025/01/01から' in page.locator('#favoriteDays').inner_text();nav('milestones');assert page.locator('#list-milestones .milestone-card').count()==2;page.wait_for_selector('#list-milestones img')
  for name in ['schedule','tickets','goods','lives','reports','money','todos','places','milestones','photos','home']: nav(name)
  page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('#menuBtn').click();nav('photos');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('#openTrade').click();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.locator('#cancelTrade').click()
  page.locator('#menuBtn').click();nav('milestones');page.locator('#list-milestones [data-edit-milestone]').first.click();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.locator('#cancelBtn').click()
  page.once('dialog',lambda dialog:dialog.accept());page.locator('#list-milestones [data-delete="milestones"]').first.click()
  assert page.locator('#list-milestones .milestone-card').count()==1
  page.locator('#menuBtn').click();nav('reports');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');assert page.locator('#list-reports .report-message').count()==2
  page.wait_for_function("document.querySelectorAll('#list-reports img').length === 4")
  assert page.locator('#list-reports .report-card').evaluate("el => getComputedStyle(el).borderTopWidth === '0px' && getComputedStyle(el).borderRadius === '0px'")
  assert page.locator('#list-reports .report-bubble').first.evaluate("el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).borderRadius === '0px'")
  assert not errors,errors
  # Migration keeps existing images available after either inventory is removed.
  context.close()
  context=browser.new_context(storage_state={'cookies': [], 'origins': []});page=context.new_page();page.set_default_timeout(5000)
  page.goto(f'http://127.0.0.1:{server.server_port}');nav('photos');photo('森田ひかる','移行確認','ヨリ',3)
  page.evaluate("""async () => { const version = new URL(document.querySelector('script[type=module]').src).search; const {db,save} = await import('./js/storage.js'+version); delete db.photos[0].inventory; db.photos[0].offer=2; save(); }""")
  page.reload();nav('photos');page.wait_for_selector('.photo-card img');assert page.locator('.photo-counter strong').inner_text()=='1枚'
  page.once('dialog',lambda dialog:dialog.accept());page.locator('[data-delete="photos"]').click()
  page.locator('[data-photo-view="offer"]').click();page.wait_for_selector('.photo-card img');assert page.locator('.photo-counter strong').inner_text()=='2枚'
  page.reload();nav('photos');assert page.locator('.photo-card').count()==0
  page.locator('[data-photo-view="offer"]').click();page.wait_for_selector('.photo-card img')
  context.close();browser.close()
  print('PASS: offers/wants/images, exchange/cancel/history/reload, multi-member anniversaries, edit/filter/home, report linking, navigation/mobile')
finally: server.shutdown();server.server_close()
