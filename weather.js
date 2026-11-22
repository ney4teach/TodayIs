'use strict';

const pendingWeather = new Set();
const weatherErrors = new Map();

function validWeatherCity(city) {
  return city && typeof city.id === 'string' && /^\d+$/.test(city.id) &&
    typeof city.name === 'string' && city.name.trim() &&
    Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90 &&
    Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180;
}

async function weatherJSON(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw Error();
  return response.json();
}

async function selectWeatherCity(id, city) {
  await change(s => {
    if (city && !s.cities.some(item => item.id === id)) s.cities.push(city);
    s.weatherCity = id;
  });
  if (state.weatherCity !== id) return;
  const saved = state.cities.find(item => item.id === id);
  if (!saved || !saved.report || Date.now() - saved.report.at > 900000) getWeather(id);
}

function weatherCityFields() {

  const query = input('', 'search');
  query.required = true;
  field('Название города', query);
  const results = el('div', 'city-results');
  results.setAttribute('aria-live', 'polite');
  let revision = 0;
  query.oninput = () => { revision++; results.replaceChildren(); };
  formSave('Найти', async () => {
    const name = query.value.trim();
    const current = ++revision;
    if (name.length < 2) {
      results.textContent = 'Введите хотя бы две буквы';
      return;
    }
    results.textContent = 'Ищем города…';
    try {
      const data = await weatherJSON('https://geocoding-api.open-meteo.com/v1/search?' +
        new URLSearchParams({name, language:'ru', count:'10'}));
      if (current !== revision || !results.isConnected || !dialog.open) return;
      results.replaceChildren();
      for (const place of data.results || []) {
        const city = {id:String(place.id), name:place.name, latitude:place.latitude,
          longitude:place.longitude, region:[place.admin1, place.country].filter(Boolean).join(', ')};
        if (!validWeatherCity(city)) continue;
        const label = [city.name, city.region].filter(Boolean).join(' · ');
        results.append(btn(label, label, () => {
          dialog.close();
          selectWeatherCity(city.id, city);
        }));
      }
      if (!results.children.length) results.textContent = 'Город не найден';
    } catch {
      if (current === revision) results.textContent = 'Поиск недоступен. Попробуйте ещё раз.';
    }
  });
  fields.append(results);
  query.focus();
}

async function getWeather(id) {
  if (pendingWeather.has(id)) return;
  const city = state.cities.find(item => item.id === id);
  if (id !== 'auto' && !city) return;
  pendingWeather.add(id);
  weatherErrors.delete(id);
  drawOne('weather');
  try {
    const {latitude, longitude} = await weatherCoordinates(city);
    const loc = latitude + ',' + longitude;
    const meteo = await weatherJSON('https://api.open-meteo.com/v1/forecast?' +
      new URLSearchParams({latitude, longitude, current:'temperature_2m,weather_code'}));
    const current = meteo.current;
    if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current.weather_code)) throw Error();
    const report = {temp:Math.round(current.temperature_2m), code:current.weather_code, at:Date.now()};
    if (city) {
      await change(s => {
        const target = s.cities.find(item => item.id === id);
        if (target && !(target.report?.at > report.at)) target.report = report;
      });
    } else {
      let name = state.weather.loc === loc ? state.weather.city : '';
      if (!name) try {
        const geo = await weatherJSON('https://nominatim.openstreetmap.org/reverse?' +
          new URLSearchParams({format:'jsonv2', zoom:10, 'accept-language':'ru', lat:latitude, lon:longitude}));
        name = geo.address.city || geo.address.town || geo.address.village || geo.address.county;
      } catch {}
      await change(s => { if (!(s.weather.at > report.at)) s.weather = {...report, loc, city:name || ''}; });
    }
  } catch (error) {
    weatherErrors.set(id, error.code === 1 ? 'Доступ к геопозиции закрыт' : 'Не удалось получить погоду');
  } finally {
    pendingWeather.delete(id);
    drawOne('weather');
  }
}

function renderWeather(n) {
  const id = state.weatherCity;
  const city = state.cities.find(item => item.id === id);
  const report = city ? city.report : state.weather;
  const localName = state.weather.city || 'Моё место';
  const locations = [{id:'auto', name:localName, label:state.weather.city ? localName + ' (моё место)' : localName},
    ...state.cities.map(item => ({...item, label:[item.name, item.region].filter(Boolean).join(' · ')}))];
  const current = locations.find(item => item.id === id);
  const header = el('div', 'cap weather-controls');
  const openForecast = () => showWeatherForecast(city, current.name);
  const name = btn('Подробный прогноз · ' + current.label, current.name, openForecast, 'weather-city');
  n.onclick = event => {
    if (!state.manage && !event.target.closest('button, a')) openForecast();
  };
  name.title = current.label;
  header.append(icon('weather'), name, 
    btn('Обновить погоду', '↻', () => getWeather(id), 'mini'));
  const content = el('div', 'weather-content');
  content.append(header);
  n.append(content);
  if (Number.isFinite(report?.temp)) {
    const line = el('div', 'weather');
    line.append(el('strong', '', report.temp + '°'), el('span', '', weatherText(report.code)));
    line.title = 'Обновлено ' + new Date(report.at).toLocaleString('ru');
    content.append(line);
  } else if (!pendingWeather.has(id)) {
    const label = city ? 'Получить погоду' : 'Определить место';
    content.append(btn(label, label, () => getWeather(id)));
  }
  const status = pendingWeather.has(id) ? 'Получаем погоду…' : weatherErrors.get(id);
  if (status) content.append(el('small', '', status));
  const dots = el('div', 'weather-dots');
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', 'Города');
  for (const location of locations) {
    const dot = btn(location.label, '', () => {
      if (location.id !== id) selectWeatherCity(location.id);
    }, 'weather-dot');
    dot.setAttribute('aria-pressed', String(location.id === id));
    dots.append(dot);
  }
  n.append(dots);
  const active = dots.querySelector('[aria-pressed="true"]');
  requestAnimationFrame(() => {
    if (dots.isConnected && active && dots.scrollWidth > dots.clientWidth) {
      dots.scrollLeft = active.offsetLeft - (dots.clientWidth - active.offsetWidth) / 2;
    }
  });
}

async function weatherCoordinates(city) {
  if (city) return city;
  const position = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:12000, maximumAge:300000}));
  return {latitude:position.coords.latitude.toFixed(2), longitude:position.coords.longitude.toFixed(2)};
}

async function showWeatherForecast(city, name) {
  if (!dialog.open) {
    const card = board.querySelector('[data-id="weather"]');
    const bounds = card?.getBoundingClientRect();
    const offsetX = bounds ? bounds.left + bounds.width / 2 - innerWidth / 2 : 0;
    const offsetY = bounds ? bounds.top + bounds.height / 2 - innerHeight / 2 : 0;
    const distance = Math.max(1, Math.hypot(offsetX, offsetY));
    const travel = Math.min(32, distance);
    dialog.style.setProperty('--forecast-x', offsetX / distance * travel + 'px');
    dialog.style.setProperty('--forecast-y', offsetY / distance * travel + 'px');
  }
  modal('Прогноз · ' + name, 'forecast');
  const body = el('div', 'weather-forecast', 'Загружаем прогноз…');
  body.setAttribute('aria-live', 'polite');
  fields.append(body);
  try {
    let coordinates = city;
    if (!city && state.weather.loc) {
      const [latitude, longitude] = state.weather.loc.split(',').map(Number);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) coordinates = {latitude, longitude};
    }
    const {latitude, longitude} = coordinates || await weatherCoordinates();
    const data = await weatherJSON('https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
      latitude, longitude, timezone:'auto', forecast_days:4, wind_speed_unit:'ms',
      current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure,weather_code',
      daily:'weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,sunrise,sunset',
      hourly:'temperature_2m,weather_code,precipitation_probability'
    }));
    if (!dialog.open || !body.isConnected) return;
    if (!data.current || !data.daily?.time?.length) throw Error();
    renderForecast(body, data);
  } catch (error) {
    if (!dialog.open || !body.isConnected) return;
    body.textContent = error.code === 1 ? 'Разрешите доступ к геопозиции или выберите сохранённый город.' : 'Не удалось загрузить прогноз.';
    body.append(btn('Повторить загрузку', 'Повторить', () => showWeatherForecast(city, name)));
  }
}

function renderForecast(body, {current, daily, hourly}) {
  const value = (v, unit) => Number.isFinite(v) ? Math.round(v) + unit : '—';
  const condition = code => Number.isFinite(code) ? weatherText(code) : '—';
  const dateLabel = date => new Date(date + 'T12:00:00').toLocaleDateString('ru', {weekday:'short', day:'numeric', month:'short'});
  const range = i => value(daily.temperature_2m_min?.[i], '°') + ' … ' + value(daily.temperature_2m_max?.[i], '°');
  const summary = el('section', 'forecast-summary');
  const temperature = el('div', 'forecast-now');
  temperature.append(el('strong', '', value(current.temperature_2m, '°')), el('span', '', condition(current.weather_code)));
  summary.append(el('h3', '', 'Сегодня · ' + dateLabel(daily.time[0])), temperature);
  body.replaceChildren(summary);
  const stats = el('dl', 'forecast-stats');
  for (const [label, reading] of [
    ['Ощущается как', value(current.apparent_temperature, '°')], ['Мин. / макс.', range(0)],
    ['Влажность', value(current.relative_humidity_2m, '%')], ['Ветер', value(current.wind_speed_10m, ' м/с')],
    ['Давление', value(current.surface_pressure, ' гПа')], ['Вероятность осадков', value(daily.precipitation_probability_max?.[0], '%')],
    ['Осадки за день', Number.isFinite(daily.precipitation_sum?.[0]) ? daily.precipitation_sum[0].toLocaleString('ru') + ' мм' : '—'],
    ['Восход / закат', [daily.sunrise?.[0], daily.sunset?.[0]].map(time => time?.slice(11,16) || '—').join(' / ')]
  ]) {
    const metric = el('div', 'forecast-metric');
    metric.append(el('dt', '', label), el('dd', '', reading));
    stats.append(metric);
  }
  body.append(stats);
  if (hourly?.time?.length) {
    body.append(el('h3', '', 'Сегодня по часам'));
    const hours = el('div', 'forecast-hours');
    hours.tabIndex = 0;
    hourly.time.forEach((time, i) => {
      if (time.slice(0,10) !== daily.time[0]) return;
      const item = el('div', 'forecast-hour');
      item.append(el('small', '', time.slice(11,16)), el('b', '', value(hourly.temperature_2m?.[i], '°')),
        el('span', '', condition(hourly.weather_code?.[i])), el('small', '', 'Осадки ' + value(hourly.precipitation_probability?.[i], '%')));
      hours.append(item);
      if (time.slice(0,13) === current.time?.slice(0,13)) item.setAttribute('aria-current', 'time');
    });
    body.append(hours);
    requestAnimationFrame(() => {
      const now = hours.querySelector('[aria-current]');
      if (now) hours.scrollLeft = now.offsetLeft;
    });
  }
  body.append(el('h3', '', 'Ближайшие дни'));
  daily.time.slice(1,4).forEach((date, index) => {
    const i = index + 1;
    const row = el('div', 'forecast-day');
    row.append(el('b', '', dateLabel(date)), el('span', '', range(i)), el('small', '',
      condition(daily.weather_code?.[i]) + ' · вероятность осадков ' + value(daily.precipitation_probability_max?.[i], '%')));
    body.append(row);
  });
}
