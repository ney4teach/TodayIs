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

function bookmarkFields() {
  selectField('Содержимое панели', [['custom', 'Мои темы'], ['browser', 'Закладки браузера']],
    state.bookmarkSource, value => change(s => { s.bookmarkSource = value; }));
  if (state.bookmarkSource === 'custom') {
    fields.append(btn('Добавить тему', 'Добавить тему', () => editCustomBookmark()));
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
      group.append(btn('Добавить сайт в тему «' + theme.title + '»', 'Добавить сайт', () => editCustomBookmark(theme.id)));
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

function bookmarkTile(node, openFolder) {
  const title = node.title || node.url || 'Без названия';
  const tile = node.url ? link('', node.url) : btn(title, '', () => openFolder(node.id));
  tile.className = 'bookmark-tile';
  tile.title = title;
  const mark = el('span', 'bookmark-mark');
  mark.setAttribute('aria-hidden', 'true');
  if (node.url) {
    mark.textContent = title.charAt(0).toUpperCase();
    const img = el('img');
    img.alt = '';
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
  const grid = el('div', 'bookmark-grid');
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
  const linkCategories = records(raw.linkCategories);
  const ids = new Set(linkCategories.map(item => item.id));
  const siteTiles = records(raw.siteTiles).filter(item => ids.has(item.categoryId) && url(item.url));
  return {linkCategories, siteTiles};
}

function renderCustomBookmarks(container) {
  if (!state.linkCategories.length) {
    container.append(el('small', '', 'Добавьте тему в настройках виджета «Закладки».'));
    return;
  }
  const groups = new Map(state.linkCategories.map(theme => [theme.id, []]));
  for (const site of state.siteTiles) groups.get(site.categoryId)?.push(site);
  for (const theme of state.linkCategories) {
    const section = el('section', 'bookmark-theme');
    const heading = el('div', 'bookmark-theme-heading');
    heading.append(el('h3', '', theme.title));
    if (theme === state.linkCategories[0] && state.siteTiles.length) {
      const search = btn('Поиск по моим ссылкам', '', openBookmarkSearch, 'mini');
      search.append(icon('search'));
      heading.append(search);
    }
    section.append(heading);
    const grid = el('div', 'bookmark-grid');
    for (const site of groups.get(theme.id)) grid.append(bookmarkTile(site));
    if (grid.childElementCount) section.append(grid);
    container.append(section);
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
        if (!s.siteTiles.some(item => item.id === id)) s.siteTiles.push({id, categoryId, title:name, url:href});
      } else if (!s.linkCategories.some(item => item.id === id)) {
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
