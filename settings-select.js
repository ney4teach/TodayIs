(() => {
  'use strict';
  const dialog = document.querySelector('#dialog');
  if (!dialog || !('showPopover' in HTMLElement.prototype)) return;
  const controls = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let sequence = 0;
  function spring(stiffness, damping, duration) {
    const decay = damping / 2, frequency = Math.sqrt(stiffness - decay ** 2);
    return Array.from({length:31}, (_, i) => {
      const time = duration * i / 30000;
      return i === 30 ? 1 : 1 - Math.exp(-decay * time) * (Math.cos(frequency * time) + decay / frequency * Math.sin(frequency * time));
    });
  }
  const openSpring = spring(360, 24, 380), highlightSpring = spring(620, 34, 280);
  function node(tag, className, text) {
    const result = document.createElement(tag);
    result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function glyph(key, fallback) {
    if (typeof icon === 'function' && typeof paths === 'object' && paths[key]) return icon(key);
    const result = node('span', 'settings-select-glyph', fallback);
    result.setAttribute('aria-hidden', 'true');
    return result;
  }
  function enhance(source) {
    const abort = new AbortController(), signal = abort.signal;
    const wrapper = node('span', 'settings-select');
    const trigger = node('button', 'settings-select-trigger');
    trigger.type = 'button';
    trigger.id = 'settings-select-trigger-' + ++sequence;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = source.labels?.[0];
    const labelCopy = label?.cloneNode(true);
    labelCopy?.querySelectorAll('select').forEach(element => element.remove());
    const name = source.getAttribute('aria-label') || labelCopy?.textContent.trim() || 'Выбрать значение';
    trigger.setAttribute('aria-label', name);
    const previousFor = label?.getAttribute('for');
    if (label) label.htmlFor = trigger.id;
    const menu = node('div', 'settings-select-menu');
    menu.id = 'settings-select-menu-' + sequence;
    menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', name);
    trigger.setAttribute('aria-controls', menu.id);
    trigger.popoverTargetElement = menu;
    const highlight = node('div', 'settings-select-highlight');
    highlight.setAttribute('aria-hidden', 'true');
    source.before(wrapper);
    wrapper.append(source, trigger);
    source.classList.add('settings-select-source');
    dialog.append(menu);
    let rows = [], opening, motion, typeahead = '', typedAt = 0;
    const listen = (target, type, fn) => target.addEventListener(type, fn, {signal});
    const engineIcons = typeof searchEngineIcon === 'function' && Array.from(source.options).every(option => ['Google','Яндекс','DuckDuckGo'].includes(option.value));
    function sync() {
      trigger.disabled = source.disabled || !Array.from(source.options).some(option => !option.hidden && !option.disabled && !option.parentElement.disabled);
      const option = source.selectedOptions[0];
      const content = node('span', 'settings-select-label', option?.label || 'Выбрать значение');
      trigger.replaceChildren(...(engineIcons && option ? [searchEngineIcon(option.value)] : []), content, glyph('searchChevron', '▾'));
      rows.forEach(row => row.setAttribute('aria-selected', String(row.option === option)));
    }
    function move(row, animate = true) {
      if (!row) return;
      const to = row.offsetTop;
      const transform = getComputedStyle(highlight).transform;
      const from = transform === 'none' ? to : new DOMMatrix(transform).m42;
      motion?.cancel();
      highlight.style.transform = 'translateY(' + to + 'px)';
      highlight.style.height = row.offsetHeight + 'px';
      if (animate && !reduced.matches && from !== to) {
        motion = highlight.animate(highlightSpring.map(progress => ({transform:'translateY(' + (from + (to - from) * progress) + 'px)'})), {duration:280});
      }
    }
    function close() {
      if (menu.matches(':popover-open')) menu.hidePopover();
    }
    function reveal(row) {
      if (!row) return;
      const top = row.offsetTop, bottom = top + row.offsetHeight;
      if (top < menu.scrollTop) menu.scrollTop = Math.max(0, top - 5);
      else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight + 5;
    }
    function select(row) {
      close();
      trigger.focus({preventScroll:true});
      if (row.option.index === source.selectedIndex) return;
      source.selectedIndex = row.option.index;
      sync();
      source.dispatchEvent(new Event('input', {bubbles:true}));
      source.dispatchEvent(new Event('change', {bubbles:true}));
    }
    function render() {
      menu.replaceChildren(highlight);
      rows = Array.from(source.options).filter(option => !option.hidden && !option.disabled && !option.parentElement.disabled).map(option => {
        const row = node('button', 'settings-select-option');
        row.type = 'button';row.tabIndex = -1;row.option = option;
        row.setAttribute('role', 'option');
        row.append(...(engineIcons ? [searchEngineIcon(option.value)] : []), node('span', 'settings-select-label', option.label), glyph('engineCheck', '✓'));
        row.addEventListener('pointerenter', () => move(row));
        row.addEventListener('focus', () => move(row));
        row.addEventListener('click', () => select(row));
        menu.append(row);
        return row;
      });
      sync();
    }
    listen(menu, 'beforetoggle', event => {
      const open = event.newState === 'open';
      trigger.setAttribute('aria-expanded', String(open));
      opening?.cancel();motion?.cancel();
      if (!open) return;
      render();
      const rect = trigger.getBoundingClientRect();
      const below = innerHeight - rect.bottom, above = rect.top;
      const up = below < Math.min(rows.length * 40 + 12, 320) && above > below;
      const width = Math.min(rect.width, innerWidth - 16);
      menu.style.width = width + 'px';
      menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - width - 8)) + 'px';
      menu.style.top = up ? 'auto' : rect.bottom + 6 + 'px';
      menu.style.bottom = up ? innerHeight - rect.top + 6 + 'px' : 'auto';
      menu.style.maxHeight = Math.max(0, Math.min(320, (up ? above : below) - 14)) + 'px';
      menu.style.transformOrigin = up ? 'bottom left' : 'top left';
    });
    listen(menu, 'toggle', event => {
      if (event.newState !== 'open') return;
      const selected = rows.find(row => row.option.selected) || rows[0];
      move(selected, false);
      selected?.focus({preventScroll:true});
      reveal(selected);
      if (!reduced.matches) {
        const direction = menu.style.bottom === 'auto' ? -1 : 1;
        opening = menu.animate(openSpring.map(progress => ({
          transform:'translateY(' + direction * 9 * (1 - progress) + 'px) scale(' + (.94 + .06 * progress) + ')',
          opacity:Math.min(1, progress * 2)
        })), {duration:380});
      }
    });
    listen(trigger, 'keydown', event => {
      if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      event.preventDefault();
      if (!menu.matches(':popover-open')) menu.showPopover({source:trigger});
    });
    listen(menu, 'keydown', event => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') event.preventDefault();
        close();trigger.focus({preventScroll:true});return;
      }
      const index = rows.indexOf(document.activeElement), last = rows.length - 1;
      const next = {ArrowDown:(index + 1) % rows.length, ArrowUp:(index + last) % rows.length, Home:0, End:last}[event.key];
      if (next !== undefined) {
        event.preventDefault();rows[next]?.focus({preventScroll:true});reveal(rows[next]);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
        const now = Date.now();
        typeahead = (now - typedAt > 700 ? '' : typeahead) + event.key.toLocaleLowerCase();typedAt = now;
        const ordered = [...rows.slice(index + 1), ...rows.slice(0, index + 1)];
        const found = ordered.find(row => row.option.label.toLocaleLowerCase().startsWith(typeahead));
        if (found) {event.preventDefault();found.focus({preventScroll:true});reveal(found);}
      }
    });
    listen(menu, 'pointerleave', () => move(rows.includes(document.activeElement) ? document.activeElement : rows.find(row => row.option.selected)));
    listen(source, 'change', sync);
    listen(source, 'invalid', event => {event.preventDefault();trigger.focus()});
    const originalFocus = source.focus, originalScroll = source.scrollIntoView;
    // Settings search still finds the original select by its existing id.
    source.focus = options => trigger.focus(options);
    source.scrollIntoView = options => trigger.scrollIntoView(options);
    sync();
    controls.set(source, {sync,close,remove() {
      abort.abort();opening?.cancel();motion?.cancel();menu.remove();
      source.classList.remove('settings-select-source');
      source.focus = originalFocus;source.scrollIntoView = originalScroll;
      if (label?.htmlFor === trigger.id) {
        if (previousFor === null) label.removeAttribute('for');else label.htmlFor = previousFor;
      }
      if (wrapper.contains(source)) wrapper.replaceWith(source);else wrapper.remove();
    }});
  }
  function update(records = []) {
    for (const [source, control] of controls) {
      if (!dialog.contains(source)) {control.remove();controls.delete(source);}
    }
    for (const source of dialog.querySelectorAll('select')) if (!controls.has(source)) enhance(source);
    for (const record of records) {
      const source = record.target.closest?.('select');
      if (source) {controls.get(source)?.close();controls.get(source)?.sync();}
    }
  }
  new MutationObserver(update).observe(dialog, {childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','selected']});
  const closeAll = () => controls.forEach(control => control.close());
  window.addEventListener('resize', closeAll);
  dialog.addEventListener('close', closeAll);
  dialog.addEventListener('scroll', event => {if(event.target === dialog)closeAll()}, true);
  update();
})();
