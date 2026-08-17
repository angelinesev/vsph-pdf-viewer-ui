(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('client') !== '1') {
    return;
  }

  function hideClientControls() {
    var selectors = [
      '#openFile',
      '#secondaryOpenFile',
      '#download',
      '#secondaryDownload',
      '#viewBookmark',
      '#scrollVertical',
      '#scrollHorizontal',
      '#scrollWrapped',
      '#bookFlip',
    ];

    selectors.forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) {
        el.setAttribute('hidden', 'true');
      }
    });
  }

  function publicShareUrl() {
    var publicPath = params.get('public');
    if (publicPath) {
      if (/^https?:\/\//i.test(publicPath)) return publicPath;
      if (publicPath.charAt(0) !== '/') publicPath = '/' + publicPath;
      return window.location.origin + publicPath;
    }
    var file = params.get('file') || '';
    var decoded;
    try {
      decoded = decodeURIComponent(file);
    } catch {
      decoded = file;
    }
    var match = decoded.match(/^\/api\/pdf\/(.+)$/);
    if (match) {
      return window.location.origin + '/view/' + match[1];
    }
    return window.location.origin;
  }

  function embedSnippet(url) {
    return '<iframe src="' + String(url).replace(/"/g, '&quot;')
      + '" width="100%" height="720" style="border:0;" allowfullscreen loading="lazy" title="Brochure"></iframe>';
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
    var ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
  }

  function addShareUi() {
    var toolbar = document.getElementById('toolbarViewerRight');
    if (!toolbar || document.getElementById('vsphShareBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'vsphShareBtn';
    btn.className = 'toolbarButton';
    btn.type = 'button';
    btn.title = 'Share / embed';
    btn.setAttribute('aria-label', 'Share or embed');
    btn.style.backgroundImage = 'none';
    btn.style.fontSize = '11px';
    btn.style.fontWeight = '700';
    btn.style.color = '#fff';
    btn.textContent = 'Share';
    btn.style.width = 'auto';
    btn.style.minWidth = '32px';
    btn.style.padding = '0 6px';

    var printBtn = document.getElementById('print');
    if (printBtn && printBtn.parentNode === toolbar) {
      toolbar.insertBefore(btn, printBtn);
    } else {
      toolbar.insertBefore(btn, toolbar.firstChild);
    }

    var overlay = document.createElement('div');
    overlay.id = 'vsphShareOverlay';
    overlay.innerHTML = ''
      + '<div class="vsph-share-card">'
      + '  <h2>Share</h2>'
      + '  <label>Link</label>'
      + '  <div class="vsph-share-row">'
      + '    <input id="vsphShareUrl" readonly />'
      + '    <button type="button" id="vsphCopyLink">Copy</button>'
      + '  </div>'
      + '  <label>Embed code</label>'
      + '  <div class="vsph-share-row">'
      + '    <textarea id="vsphEmbedCode" readonly rows="3"></textarea>'
      + '    <button type="button" id="vsphCopyEmbed">Copy</button>'
      + '  </div>'
      + '  <button type="button" id="vsphShareClose" class="vsph-share-close">Close</button>'
      + '</div>';

    var style = document.createElement('style');
    style.textContent = ''
      + '#vsphShareOverlay{display:none;position:fixed;inset:0;z-index:100000;background:rgba(17,24,39,.45);align-items:center;justify-content:center;padding:1.25rem}'
      + '#vsphShareOverlay.open{display:flex}'
      + '.vsph-share-card{background:#fff;color:#111827;max-width:520px;width:100%;border-radius:14px;padding:1.1rem 1.2rem 1rem;font-family:Inter,system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.2)}'
      + '.vsph-share-card h2{margin:0 0 .75rem;font-size:1.05rem}'
      + '.vsph-share-card label{display:block;font-size:.78rem;font-weight:600;margin:.55rem 0 .3rem}'
      + '.vsph-share-row{display:flex;gap:.45rem;align-items:flex-start}'
      + '.vsph-share-row input,.vsph-share-row textarea{flex:1;width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:.45rem .55rem;font-size:.8rem}'
      + '.vsph-share-row textarea{font-family:ui-monospace,Menlo,Consolas,monospace;min-height:4.4rem;resize:vertical}'
      + '.vsph-share-row button,.vsph-share-close{border:0;background:#2563eb;color:#fff;border-radius:8px;padding:.45rem .7rem;font-weight:600;cursor:pointer}'
      + '.vsph-share-close{margin-top:.85rem;background:#111827}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    var shareUrl = publicShareUrl();
    document.getElementById('vsphShareUrl').value = shareUrl;
    document.getElementById('vsphEmbedCode').value = embedSnippet(shareUrl);

    function close() {
      overlay.classList.remove('open');
    }

    btn.addEventListener('click', function () {
      overlay.classList.add('open');
    });
    document.getElementById('vsphShareClose').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.getElementById('vsphCopyLink').addEventListener('click', function () {
      copyText(document.getElementById('vsphShareUrl').value);
    });
    document.getElementById('vsphCopyEmbed').addEventListener('click', function () {
      copyText(document.getElementById('vsphEmbedCode').value);
    });
  }

  function init() {
    hideClientControls();
    addShareUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
