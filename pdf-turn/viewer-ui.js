(function () {
  var params = new URLSearchParams(window.location.search);

  var HIDE_SELECTORS = [
    '#openFile',
    '#secondaryOpenFile',
    '#secondaryDownload',
    '#viewBookmark',
    '#secondaryViewBookmark',
    '#viewFind',
    '#secondaryPrint',
    '#secondaryToolbarToggle',
    '#scrollVertical',
    '#scrollHorizontal',
    '#scrollWrapped',
    '#bookFlip',
    '#zoomIn',
    '#zoomOut',
  ];

  function hideExtraControls() {
    HIDE_SELECTORS.forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) el.setAttribute('hidden', 'true');
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
    } catch (err) {
      decoded = file;
    }
    var match = decoded.match(/^\/api\/pdf\/(.+)$/);
    if (match) {
      return window.location.origin + '/view/' + match[1];
    }
    return window.location.href.split('#')[0];
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

  function updatePageLabel() {
    var numPagesEl = document.getElementById('numPages');
    if (!numPagesEl) return;
    var total = (window.PDFViewerApplication && PDFViewerApplication.pagesCount)
      || parseInt(numPagesEl.textContent.replace(/\D/g, ''), 10)
      || 0;
    if (total > 0) {
      numPagesEl.textContent = 'of ' + total;
    }
  }

  function bindPageLabel() {
    updatePageLabel();
    if (window.PDFViewerApplication && PDFViewerApplication.eventBus) {
      PDFViewerApplication.eventBus.on('pagesinit', updatePageLabel);
      PDFViewerApplication.eventBus.on('pagechanging', updatePageLabel);
    }
    document.addEventListener('pagesloaded', updatePageLabel);
    var pageInput = document.getElementById('pageNumber');
    if (pageInput) {
      pageInput.addEventListener('change', updatePageLabel);
    }
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
    btn.textContent = 'Share';

    var fullscreenBtn = document.getElementById('presentationMode');
    if (fullscreenBtn && fullscreenBtn.parentNode === toolbar) {
      toolbar.insertBefore(btn, fullscreenBtn);
    } else {
      toolbar.appendChild(btn);
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

  function reorganizeDock() {
    var toolbarViewer = document.getElementById('toolbarViewer');
    if (!toolbarViewer || document.getElementById('vsphDockRow')) return;

    var row = document.createElement('div');
    row.id = 'vsphDockRow';
    row.className = 'vsph-dock-row';

    function appendIfPresent(el) {
      if (!el || el.hasAttribute('hidden')) return;
      el.classList.remove('hiddenSmallView', 'hiddenLargeView', 'hiddenMediumView');
      row.appendChild(el);
    }

    appendIfPresent(document.getElementById('sidebarToggle'));

    var nav = document.querySelector('#toolbarViewerLeft .splitToolbarButton');
    if (nav) {
      nav.classList.remove('hiddenSmallView', 'hiddenLargeView', 'hiddenMediumView');
      row.appendChild(nav);
    }

    var pageGroup = document.createElement('div');
    pageGroup.className = 'vsph-dock-group vsph-dock-group--pages';
    var pageNum = document.getElementById('pageNumber');
    var numPages = document.getElementById('numPages');
    if (pageNum) pageGroup.appendChild(pageNum);
    if (numPages) pageGroup.appendChild(numPages);
    if (pageGroup.childNodes.length) row.appendChild(pageGroup);

    appendIfPresent(document.getElementById('scaleSelectContainer'));
    appendIfPresent(document.getElementById('print'));
    appendIfPresent(document.getElementById('download'));
    appendIfPresent(document.getElementById('vsphShareBtn'));
    appendIfPresent(document.getElementById('presentationMode'));

    toolbarViewer.appendChild(row);
  }

  function syncStageInsets() {
    var toolbar = document.getElementById('toolbarContainer');
    var dockBottom = 12;
    var dockHeight = toolbar ? Math.ceil(toolbar.getBoundingClientRect().height) : 52;
    var dockSpace = dockHeight + dockBottom + 16;
    document.documentElement.style.setProperty('--vsph-dock-space', dockSpace + 'px');
  }

  function refitSpread() {
    if (typeof bookFlip !== 'undefined' && bookFlip.active) {
      bookFlip.fitToScreen();
    }
    if (typeof trifold !== 'undefined' && trifold.active && typeof trifold.fitToScreen === 'function') {
      trifold.fitToScreen();
    }
  }

  function bindSpreadReflow() {
    var scheduleReflow = function () {
      syncStageInsets();
      window.requestAnimationFrame(refitSpread);
    };
    var debounced = function () {
      scheduleReflow();
    };
    window.addEventListener('resize', debounced);
    document.addEventListener('pagesloaded', function () {
      setTimeout(scheduleReflow, 50);
      setTimeout(scheduleReflow, 250);
    });

    var toolbar = document.getElementById('toolbarContainer');
    if (toolbar && window.ResizeObserver) {
      new ResizeObserver(debounced).observe(toolbar);
    }

    var main = document.getElementById('mainContainer');
    if (main && window.MutationObserver) {
      new MutationObserver(function () {
        if (main.classList.contains('bookFlipMode') || main.classList.contains('trifoldMode')) {
          scheduleReflow();
        }
      }).observe(main, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function bindWheelFlip() {
    var container = document.getElementById('viewerContainer');
    if (!container) return;

    var accumulated = 0;
    var threshold = 60;
    var cooldownMs = 500;
    var lastFlip = 0;

    function shouldIgnoreTarget(target) {
      if (!target || !target.closest) return false;
      return !!target.closest(
        '#toolbarContainer, #sidebarContainer, #vsphShareOverlay, input, select, textarea, button, a'
      );
    }

    container.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) return;
      if (shouldIgnoreTarget(e.target)) return;

      var brochureActive = typeof bookFlip !== 'undefined' && bookFlip.active;
      var flyerActive = typeof trifold !== 'undefined' && trifold.active;
      if (!brochureActive && !flyerActive) return;

      e.preventDefault();

      var now = Date.now();
      if (now - lastFlip < cooldownMs) return;

      accumulated += e.deltaY;
      if (Math.abs(accumulated) < threshold) return;

      var forward = accumulated > 0;
      accumulated = 0;
      lastFlip = now;

      if (flyerActive) {
        if (forward) trifold.nextState();
        else trifold.prevState();
        return;
      }

      if (brochureActive && typeof $ !== 'undefined') {
        if (forward) $('#viewer').turn('next');
        else $('#viewer').turn('previous');
      }
    }, { passive: false });
  }

  function init() {
    document.body.classList.add('vsph-magazine-ui');
    hideExtraControls();
    addShareUi();
    reorganizeDock();
    syncStageInsets();
    bindPageLabel();
    bindSpreadReflow();
    bindWheelFlip();
    window.requestAnimationFrame(refitSpread);

    if (window.PDFViewerApplication && PDFViewerApplication.initializedPromise) {
      PDFViewerApplication.initializedPromise.then(bindPageLabel);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
