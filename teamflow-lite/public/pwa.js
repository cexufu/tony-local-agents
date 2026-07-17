(() => {
  const appBase = new URL('.', document.baseURI).pathname;
  let deferredInstallPrompt = null;
  let refreshing = false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function addInstallButtons() {
    if (isStandalone() || document.querySelector('[data-pwa-install]')) return;
    const topActions = document.querySelector('.top-actions');
    if (topActions) {
      const button = document.createElement('button');
      button.className = 'btn secondary pwa-install-button';
      button.dataset.pwaInstall = '';
      button.innerHTML = '<span>\u2193</span> \u5b89\u88c5 App';
      topActions.insertBefore(button, topActions.firstChild);
    }
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pwa-login-install';
      button.dataset.pwaInstall = '';
      button.textContent = '\u5b89\u88c5 TeamFlow App \u2192';
      loginCard.appendChild(button);
    }
    document.querySelectorAll('[data-pwa-install]').forEach(button => button.addEventListener('click', installApp));
  }

  function addDeviceSettingsButton() {
    if (document.querySelector('#pwaDeviceSettings')) return;
    const settings = document.querySelector('#settingsBtn');
    if (!settings) return;
    const button = document.createElement('button');
    button.id = 'pwaDeviceSettings';
    button.className = 'nav-secondary';
    button.innerHTML = '<span class="pwa-device-icon">\u25a3</span>App \u4e0e\u901a\u77e5';
    settings.insertAdjacentElement('beforebegin', button);
    button.onclick = showAppSettings;
  }

  function showAppSettings() {
    const installed = isStandalone();
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const permissionLabel = permission === 'granted' ? '\u5df2\u5f00\u542f' : permission === 'denied' ? '\u5df2\u88ab\u7cfb\u7edf\u62d2\u7edd' : permission === 'unsupported' ? '\u8bbe\u5907\u4e0d\u652f\u6301' : '\u672a\u5f00\u542f';
    openModal(`<p class="eyebrow">App settings</p><h2>App \u4e0e\u901a\u77e5</h2><p class="modal-desc">\u7ba1\u7406\u5b89\u88c5\u72b6\u6001\u548c\u8fd9\u53f0\u8bbe\u5907\u7684\u901a\u77e5\u6743\u9650\u3002</p><div class="app-setting-row"><span>\u5b89\u88c5\u72b6\u6001</span><b>${installed ? '\u5df2\u4f5c\u4e3a App \u8fd0\u884c' : '\u5f53\u524d\u4e3a\u6d4f\u89c8\u5668\u6a21\u5f0f'}</b></div><div class="app-setting-row"><span>\u7cfb\u7edf\u901a\u77e5</span><b>${permissionLabel}</b></div><p class="app-setting-note">\u670d\u52a1\u5668\u7684\u98de\u4e66/Webhook \u63d0\u9192\u4e0d\u53d7\u6b64\u8bbe\u7f6e\u5f71\u54cd\u3002App \u7cfb\u7edf\u901a\u77e5\u7528\u4e8e\u6253\u5f00 App \u65f6\u63d0\u793a\u5f85\u8ddf\u8fdb\u4e8b\u9879\u3002</p><div class="modal-actions"><button class="btn secondary" data-close>\u5173\u95ed</button>${!installed ? '<button class="btn secondary" id="installFromSettings">\u5b89\u88c5 App</button>' : ''}${permission === 'default' ? '<button class="btn primary" id="notifyFromSettings">\u5f00\u542f\u901a\u77e5</button>' : ''}</div>`);
    document.querySelector('[data-close]').onclick = closeModal;
    if (document.querySelector('#installFromSettings')) document.querySelector('#installFromSettings').onclick = installApp;
    if (document.querySelector('#notifyFromSettings')) document.querySelector('#notifyFromSettings').onclick = requestNotifications;
  }

  async function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === 'accepted') toast('\u6b63\u5728\u5b89\u88c5 TeamFlow');
      return;
    }
    showInstallHelp();
  }

  function showInstallHelp() {
    const iosSteps = '<ol><li>\u7528 Safari \u6253\u5f00 TeamFlow \u7f51\u5740</li><li>\u70b9\u51fb\u5e95\u90e8\u7684\u201c\u5206\u4eab\u201d\u56fe\u6807</li><li>\u9009\u62e9\u201c\u6dfb\u52a0\u5230\u4e3b\u5c4f\u5e55\u201d</li><li>\u70b9\u51fb\u201c\u6dfb\u52a0\u201d\u5b8c\u6210\u5b89\u88c5</li></ol>';
    const otherSteps = '<ol><li>\u5728 Chrome \u6216 Edge \u4e2d\u6253\u5f00 TeamFlow</li><li>\u70b9\u51fb\u5730\u5740\u680f\u53f3\u4fa7\u7684\u5b89\u88c5\u56fe\u6807</li><li>\u6216\u6253\u5f00\u6d4f\u89c8\u5668\u83dc\u5355\uff0c\u9009\u62e9\u201c\u5b89\u88c5 TeamFlow\u201d</li></ol>';
    openModal(`<p class="eyebrow">Install TeamFlow</p><h2>\u5b89\u88c5\u5230${isIos ? ' iPhone / iPad' : '\u8bbe\u5907'}</h2><p class="modal-desc">\u5b89\u88c5\u540e\u4f1a\u51fa\u73b0\u72ec\u7acb\u56fe\u6807\uff0c\u5e76\u4ee5 App \u7a97\u53e3\u542f\u52a8\u3002</p><div class="install-guide">${isIos ? iosSteps : otherSteps}</div><div class="install-feature-grid"><span><b>\u25a3</b> \u72ec\u7acb\u7a97\u53e3</span><span><b>\u2601</b> \u81ea\u52a8\u66f4\u65b0</span><span><b>\u25ce</b> \u79bb\u7ebf\u63d0\u793a</span><span><b>\u25cf</b> \u7cfb\u7edf\u901a\u77e5</span></div><div class="modal-actions"><button class="btn secondary" data-close>\u77e5\u9053\u4e86</button>${'Notification' in window ? '<button class="btn primary" id="enableAppNotifications">\u5f00\u542f\u7cfb\u7edf\u901a\u77e5</button>' : ''}</div>`);
    document.querySelector('[data-close]').onclick = closeModal;
    if (document.querySelector('#enableAppNotifications')) document.querySelector('#enableAppNotifications').onclick = requestNotifications;
  }

  async function requestNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast('\u7cfb\u7edf\u901a\u77e5\u5df2\u5f00\u542f');
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'SHOW_NOTIFICATION', payload: { title: 'TeamFlow', body: '\u901a\u77e5\u5df2\u5f00\u542f\uff0c\u6253\u5f00 App \u65f6\u4f1a\u63d0\u793a\u5f85\u8ddf\u8fdb\u4e8b\u9879\u3002', tag: 'teamflow-welcome' } });
        closeModal();
      } else toast('\u672a\u83b7\u5f97\u901a\u77e5\u6743\u9650');
    } catch { toast('\u5f53\u524d\u8bbe\u5907\u4e0d\u652f\u6301\u7cfb\u7edf\u901a\u77e5'); }
  }

  function showUpdate(registration) {
    if (document.querySelector('.pwa-update-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'pwa-update-banner';
    banner.innerHTML = '<span>TeamFlow \u6709\u65b0\u7248\u672c</span><button>\u7acb\u5373\u66f4\u65b0</button>';
    banner.querySelector('button').onclick = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    document.body.appendChild(banner);
  }

  function onlineState() {
    let banner = document.querySelector('.offline-banner');
    if (!navigator.onLine) {
      if (!banner) { banner = document.createElement('div'); banner.className = 'offline-banner'; banner.textContent = '\u5f53\u524d\u79bb\u7ebf\uff0c\u5df2\u6682\u505c\u6570\u636e\u66f4\u65b0'; document.body.appendChild(banner); }
    } else if (banner) { banner.remove(); toast('\u7f51\u7edc\u5df2\u6062\u590d'); }
  }

  async function notifyPendingOnOpen() {
    if (!isStandalone() || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (let i = 0; i < 20 && !state.dashboard; i += 1) await new Promise(resolve => setTimeout(resolve, 500));
    const reminders = state.dashboard?.reminders || [];
    if (!reminders.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `teamflow-notified-${today}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const overdue = reminders.filter(item => item.kind === 'overdue').length;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'SHOW_NOTIFICATION', payload: { title: `TeamFlow \u00b7 ${reminders.length} \u4e2a\u5f85\u8ddf\u8fdb`, body: overdue ? `\u5176\u4e2d ${overdue} \u4e2a\u5df2\u903e\u671f\uff0c\u70b9\u51fb\u67e5\u770b\u3002` : '\u6709\u4e8b\u9879\u5373\u5c06\u5230\u671f\uff0c\u70b9\u51fb\u67e5\u770b\u3002', tag: `teamflow-${today}`, url: `${appBase}#tracking` } });
  }

  function routeFromHash() {
    const page = location.hash.slice(1);
    if (!['dashboard','requirements','analysis','tasks','tracking','team'].includes(page)) return;
    const attempt = () => { if (!document.querySelector('#appView.hidden') && typeof navigate === 'function') navigate(page); else setTimeout(attempt, 300); };
    attempt();
  }

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; addInstallButtons(); });
  window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; document.querySelectorAll('[data-pwa-install]').forEach(button => button.remove()); toast('TeamFlow App \u5df2\u5b89\u88c5'); });
  window.addEventListener('online', onlineState); window.addEventListener('offline', onlineState); window.addEventListener('hashchange', routeFromHash);

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(`${appBase}sw.js`, { scope: appBase }).then(registration => {
      if (registration.waiting) showUpdate(registration);
      registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration); }); });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshing) { refreshing = true; location.reload(); } });
      notifyPendingOnOpen();
    }).catch(error => console.warn('PWA registration:', error));
  }
  setTimeout(addInstallButtons, 500);
  setTimeout(addDeviceSettingsButton, 500);
  setTimeout(routeFromHash, 700);
  onlineState();
})();
