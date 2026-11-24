'use strict';

let bookmarkFolders = new Map();
let bookmarkSites = [];
let bookmarkRoot = '';
let bookmarkTrail = [];
let bookmarkHome;
let bookmarkRevision = 0;
let bookmarkStatus = 'Загружаем закладки…';

async function bookmarks() {
  const revision = ++bookmarkRevision;
  try {
    const [root] = await chrome.bookmarks.getTree();
    if (revision !== bookmarkRevision) return;
    const folders = new Map();
    const sites = [];
    function visit(node, path) {
      if (node.url) {
        if (url(node.url)) sites.push(node);
        return;
      }
      const label = [...path, node.title || 'Без названия'];
      folders.set(node.id, {node, path: label.join(' / ')});
      for (const child of node.children || []) visit(child, label);
    }
    for (const node of root.children) visit(node, []);
    bookmarkFolders = folders;
    bookmarkSites = sites;
    bookmarkRoot = root.children.find(node => node.folderType === 'bookmarks-bar')?.id
      || folders.keys().next().value || '';
    bookmarkStatus = '';
  } catch {
    if (revision !== bookmarkRevision) return;
    bookmarkStatus = 'Не удалось прочитать закладки';
  }
  drawOne('bookmarks');
  if (dialog.open && activeDialog === 'bookmark-search') updateBookmarkResults();
  if (dialog.open && activeDialog === 'settings' && settingsPage === 'bookmarks') showSettings('bookmarks');
}

const themeLimit = 4;
const sitesPerTheme = 4;

function bookmarkFields() {
  selectField('Содержимое панели', [['custom', 'Мои темы'], ['browser', 'Закладки браузера']],
    state.bookmarkSource, value => change(s => { s.bookmarkSource = value; }));
  if (state.bookmarkSource === 'custom') {
    const addTheme = btn('Добавить тему', 'Добавить тему', () => editCustomBookmark());
    addTheme.disabled = state.linkCategories.length >= themeLimit;
    fields.append(el('small', '', 'До 4 тем, по 4 сайта в каждой'), addTheme);
    if (state.siteTiles.length) fields.append(btn('Поиск по всем моим ссылкам', 'Найти сайт', openBookmarkSearch));
    if (state.linkCategories.length) fields.append(bookmarkPreview());
    for (const theme of state.linkCategories) {
      const row = el('div', 'bookmark-settings-row');
      const group = el('section', 'bookmark-settings-group');
      row.append(el('strong', '', theme.title), deleteBookmarkButton(theme, true));
      group.append(row);
      for (const site of state.siteTiles.filter(item => item.categoryId === theme.id)) {
        const entry = el('div', 'bookmark-settings-row bookmark-settings-site');
        const details = el('div');
        details.append(el('span', '', site.title), el('small', '', site.url));
        entry.append(details, deleteBookmarkButton(site, false));
        group.append(entry);
      }
      const addSite = btn('Добавить сайт в тему «' + theme.title + '»', 'Добавить сайт', () => editCustomBookmark(theme.id));
      addSite.disabled = state.siteTiles.filter(site => site.categoryId === theme.id).length >= sitesPerTheme;
      group.append(addSite);
      fields.append(group);
    }
    return;
  }
  if (!bookmarkFolders.size) {
    fields.append(el('small', '', bookmarkStatus || 'Нет папок с закладками'));
    return;
  }
  selectField('Папка на карточке', Array.from(bookmarkFolders, ([id, folder]) => [id, folder.path]),
    bookmarkFolders.has(state.bookmarkFolder) ? state.bookmarkFolder : bookmarkRoot,
    id => change(s => { s.bookmarkFolder = id; }));
}

function deleteBookmarkButton(item, isTheme) {
  const label = 'Удалить ' + (isTheme ? 'тему' : 'сайт') + ' «' + item.title + '»';
  return btn(label, 'Удалить', async () => {
    const question = label + (isTheme ? ' вместе со всеми её сайтами?' : '?');
    if (!window.confirm(question)) return;
    await change(s => {
      if (isTheme) {
        s.linkCategories = s.linkCategories.filter(theme => theme.id !== item.id);
        s.siteTiles = s.siteTiles.filter(site => site.categoryId !== item.id);
      } else {
        s.siteTiles = s.siteTiles.filter(site => site.id !== item.id);
      }
    });
  }, 'mini bookmark-remove');
}

function bookmarkTile(node, openFolder, editTile) {
  const title = node.title || node.url || 'Без названия';
  const tile = editTile || (node.url ? link('', node.url) : btn(title, '', () => openFolder(node.id)));
  tile.className = 'bookmark-tile';
  tile.title = title;
  const mark = el('span', 'bookmark-mark');
  mark.setAttribute('aria-hidden', 'true');
  if (node.url) {
    mark.textContent = title.charAt(0).toUpperCase();
    const img = el('img');
    img.alt = '';
    img.draggable = false;
    img.loading = 'lazy';
    img.onload = () => mark.classList.add('loaded');
    const cachedIcon = chrome.runtime.getURL('/_favicon/') + '?size=32&pageUrl=' + encodeURIComponent(node.url);
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      if (img.src !== cachedIcon) img.src = cachedIcon;
      else img.remove();
    };
    img.src = node.categoryId ? new URL('/favicon.ico', node.url).href : cachedIcon;
    mark.append(img);
  } else {
    paths.folder = 'M3 7V5h6l2 2h10v12H3Z';
    mark.append(icon('folder'));
  }
  tile.append(mark, el('span', 'bookmark-label', title));
  return tile;
}

function renderBookmarks(container) {
  if (state.bookmarkSource === 'custom') return renderCustomBookmarks(container);
  const home = bookmarkFolders.has(state.bookmarkFolder) ? state.bookmarkFolder : bookmarkRoot;
  if (home !== bookmarkHome) { bookmarkTrail = []; bookmarkHome = home; }
  let parent = home;
  bookmarkTrail = bookmarkTrail.filter(id => {
    if (bookmarkFolders.get(id)?.node.parentId !== parent) return false;
    parent = id;
    return true;
  });
  const folder = bookmarkFolders.get(parent)?.node;
  const search = btn('Поиск по всем закладкам', '', openBookmarkSearch, 'mini');
  search.append(icon('search'));
  const header = cap('bookmarks', search);
  if (folder) {
    const title = header.querySelector('span');
    title.textContent = folder.title || 'Закладки';
    title.title = title.textContent;
  }
  if (bookmarkTrail.length) {
    const back = btn('Назад в родительскую папку', '‹', () => {
      bookmarkTrail.pop();
      drawOne('bookmarks');
    }, 'mini');
    header.firstChild.replaceWith(back);
  }
  container.append(header);
  const children = (folder?.children || []).filter(node => !node.url || url(node.url));
  if (!children.length) {
    container.append(el('small', '', bookmarkStatus || 'В этой папке пока пусто'));
    return;
  }
  const grid = el('div', 'bookmark-grid bookmark-folder-grid');
  const count = children.length;
  // Scale gutters down for large browser folders as well as for small cards.
  grid.style.setProperty('--folder-gap', (8 / Math.ceil(Math.sqrt(count))) + 'cqmin');
  for (const [name, ratio] of [['square', 1], ['wide', 2.5], ['tall', 0.5]]) {
    grid.style.setProperty('--' + name, Math.min(count, Math.ceil(Math.sqrt(count * ratio))));
  }
  for (const node of children) grid.append(bookmarkTile(node, id => {
    bookmarkTrail.push(id);
    drawOne('bookmarks');
  }));
  container.append(grid);
}

function openBookmarkSearch() {
  modal('Поиск по закладкам', 'bookmark-search');
  const query = input('', 'search');
  query.placeholder = 'Название или адрес сайта';
  query.setAttribute('aria-label', query.placeholder);
  query.oninput = updateBookmarkResults;
  fields.append(query, el('div', 'bookmark-grid bookmark-results'));
  updateBookmarkResults();
  query.focus();
}

function updateBookmarkResults() {
  const query = fields.querySelector('input').value.trim().toLowerCase();
  const grid = fields.querySelector('.bookmark-results');
  grid.replaceChildren();
  const sites = state.bookmarkSource === 'custom' ? state.siteTiles : bookmarkSites;
  for (const site of sites) {
    if (((site.title || '') + ' ' + site.url).toLowerCase().includes(query)) grid.append(bookmarkTile(site));
  }
  if (!grid.childElementCount) grid.append(el('small', '', (state.bookmarkSource === 'browser' && bookmarkStatus) || (query ? 'Ничего не найдено' : 'Пока нет закладок')));
}



function normalizeCustomBookmarks(raw) {
  const records = list => Array.isArray(list)
    ? list.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && item.title.trim())
    : [];
  const order = item => Number.isSafeInteger(item.order) && item.order >= 0 ? item.order : Infinity;
  const byOrder = (a, b) => order(a) - order(b);
  const linkCategories = records(raw.linkCategories).sort(byOrder);
  const ids = new Set(linkCategories.map(item => item.id));
  const siteTiles = records(raw.siteTiles).filter(item => ids.has(item.categoryId) && url(item.url)).sort(byOrder);
  return {linkCategories, siteTiles};
}

function moveBookmark(state, source, target) {
  if (!state.linkCategories.some(theme => theme.id === target.themeId)) throw Error('Тема больше недоступна');
  if (!source.siteId) {
    const from = state.linkCategories.findIndex(theme => theme.id === source.themeId);
    const to = state.linkCategories.findIndex(theme => theme.id === target.themeId);
    if (from < 0) throw Error('Тема больше недоступна');
    const [theme] = state.linkCategories.splice(from, 1);
    state.linkCategories.splice(to, 0, theme);
    state.linkCategories.forEach((item, order) => { item.order = order; });
    return;
  }
  const site = state.siteTiles.find(item => item.id === source.siteId && item.categoryId === source.themeId);
  if (!site) throw Error('Сайт больше недоступен в этой теме');
  const destination = state.siteTiles.filter(item => item.categoryId === target.themeId);
  if (source.themeId !== target.themeId && destination.length >= sitesPerTheme) throw Error('В этой теме уже 4 сайта');
  const to = target.siteId ? destination.findIndex(item => item.id === target.siteId) : destination.length;
  if (to < 0) throw Error('Место больше недоступно');
  const from = destination.indexOf(site);
  if (from >= 0) destination.splice(from, 1);
  site.categoryId = target.themeId;
  destination.splice(to, 0, site);
  destination.forEach((item, order) => { item.order = order; });
}

function bookmarkPreview() {
  const preview = el('section', 'bookmark-preview');
  const heading = el('h4', '', 'Порядок закладок');
  const instructions = el('small', '', 'Перетащите тему за заголовок, а сайт за иконку. Можно также выбрать элемент и новое место двумя нажатиями.');
  const hint = el('small', 'bookmark-preview-status');
  hint.setAttribute('aria-live', 'polite');
  const surface = el('div', 'bookmark-preview-surface');
  preview.append(heading, instructions, surface, hint);
  let source;
  let pending = false;

  function select(control) {
    preview.querySelectorAll('.bookmark-drop-target').forEach(element => element.classList.remove('bookmark-drop-target'));
    source?.button.setAttribute('aria-pressed', 'false');
    source = control;
    source?.button.setAttribute('aria-pressed', 'true');
    hint.textContent = source ? 'Выберите новое место для «' + source.button.title + '».' : '';
  }

  function canMove(target) {
    if (!source || pending || source.button === target.button) return false;
    if (!source.siteId) return !target.siteId;
    return source.themeId === target.themeId || target.count < sitesPerTheme;
  }

  async function move(target) {
    const item = source;
    select();
    pending = true;
    const saved = await change(s => moveBookmark(s, item, target));
    pending = false;
    if (saved && !preview.isConnected && dialog.open && activeDialog === 'settings' && settingsPage === 'bookmarks') {
      const moved = [...fields.querySelectorAll('[data-bookmark-move]')].find(button => button.dataset.bookmarkMove === item.button.dataset.bookmarkMove);
      moved?.focus({preventScroll:true});
    }
  }

  function control(theme, site, count) {
    const button = btn(site?.title || theme.title, site ? '' : theme.title, () => {
      if (pending) return;
      if (source?.button === button) select();
      else if (canMove(target)) void move(target);
      else if (source?.siteId && source.themeId !== target.themeId && count >= sitesPerTheme) {
        hint.textContent = 'В теме «' + theme.title + '» уже 4 сайта. Выберите другую тему.';
      } else select(target);
    });
    const target = {button, themeId:theme.id, siteId:site?.id, count};
    button.dataset.bookmarkMove = (site ? 'site:' + site.id : 'theme:' + theme.id);
    button.draggable = true;
    button.setAttribute('aria-pressed', 'false');
    button.ondragstart = event => {
      if (pending) return event.preventDefault();
      event.dataTransfer.setData('text/plain', button.title);
      event.dataTransfer.effectAllowed = 'move';
      select(target);
    };
    button.ondragend = () => select();
    return target;
  }

  function dropZone(element, target) {
    element.ondragover = event => {
      if (source && !source.siteId && target.siteId) return;
      event.stopPropagation();
      if (!canMove(target)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      element.classList.add('bookmark-drop-target');
    };
    element.ondragleave = event => {
      if (!element.contains(event.relatedTarget)) element.classList.remove('bookmark-drop-target');
    };
    element.ondrop = event => {
      if (source && !source.siteId && target.siteId) return;
      event.preventDefault();
      event.stopPropagation();
      element.classList.remove('bookmark-drop-target');
      if (canMove(target)) void move(target);
    };
  }

  preview.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !source) return;
    event.preventDefault();
    event.stopPropagation();
    source.button.focus();
    select();
  });
  renderCustomBookmarks(surface, {control, dropZone});
  return preview;
}

function renderCustomBookmarks(container, preview) {
  if (!state.linkCategories.length) {
    container.append(el('small', '', 'Добавьте тему в настройках виджета «Закладки».'));
    return;
  }
  const groups = new Map(state.linkCategories.map(theme => [theme.id, []]));
  for (const site of state.siteTiles) groups.get(site.categoryId)?.push(site);
  const themes = state.linkCategories.slice(0, themeLimit);
  const panel = el('div', 'bookmark-panel');
  container.append(panel);
  for (const theme of themes) {
    const sites = groups.get(theme.id);
    const section = el('section', 'bookmark-theme');
    const heading = el('div', 'bookmark-theme-heading');
    const name = el('h3');
    name.title = theme.title;
    if (preview) {
      const target = preview.control(theme, null, sites.length);
      target.button.className = 'bookmark-move-theme';
      name.append(target.button);
      preview.dropZone(section, target);
    } else name.textContent = theme.title;
    heading.append(name);
    section.append(heading);
    const grid = el('div', 'bookmark-grid');
    for (const site of sites.slice(0, sitesPerTheme)) {
      const target = preview?.control(theme, site, sites.length);
      const tile = bookmarkTile(site, null, target?.button);
      if (target) preview.dropZone(tile, target);
      tile.setAttribute('aria-label', site.title + ' · ' + theme.title);
      grid.append(tile);
    }
    section.append(grid);
    panel.append(section);
  }
}
function editCustomBookmark(categoryId) {
  const addingSite = Boolean(categoryId);
  modal(addingSite ? 'Добавить сайт' : 'Новая тема', 'bookmark-add');
  const back = btn('К настройкам закладок', '‹', () => showSettings('bookmarks'), 'settings-back');
  dialog.querySelector('header').prepend(back);
  const title = input();
  title.maxLength = 100;
  title.required = !addingSite;
  field(addingSite ? 'Название плитки (необязательно)' : 'Название темы', title);
  const address = input();
  if (addingSite) {
    address.required = true;
    address.placeholder = 'example.com';
    address.inputMode = 'url';
    field('Адрес сайта', address);
  }
  const id = crypto.randomUUID();
  formSave('Добавить', async () => {
    let name = title.value.trim();
    let href = '';
    if (addingSite) {
      const value = address.value.trim();
      href = value && url(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : 'https://' + value);
      if (!href) {
        address.setCustomValidity('Введите адрес сайта HTTP или HTTPS');
        address.reportValidity();
        address.setCustomValidity('');
        return;
      }
      if (!name) name = new URL(href).hostname;
    } else if (!name) {
      title.focus();
      return;
    }
    const submit = title.form.querySelector('[type=submit]');
    if (submit.disabled) return;
    submit.disabled = true;
    await change(s => {
      if (addingSite) {
        if (!s.linkCategories.some(item => item.id === categoryId)) throw Error('Тема больше недоступна');
        if (s.siteTiles.some(item => item.id === id)) return;
        if (s.siteTiles.filter(item => item.categoryId === categoryId).length >= sitesPerTheme) throw Error('В теме уже 4 сайта');
        s.siteTiles.push({id, categoryId, title:name, url:href});
      } else if (!s.linkCategories.some(item => item.id === id)) {
        if (s.linkCategories.length >= themeLimit) throw Error('Уже добавлены 4 темы');
        s.linkCategories.push({id, title:name});
      }
    });
    submit.disabled = false;
    if (!title.isConnected || !dialog.open) return;
    if ((addingSite ? state.siteTiles : state.linkCategories).some(item => item.id === id)) {
      showSettings('bookmarks');
    }
  });
  title.focus();
}
