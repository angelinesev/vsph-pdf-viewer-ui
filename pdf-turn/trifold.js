/********************************************************/
/**  Simplebooklet-style trifold: 6 slots, states 0–3  **/
/**  Front 1-2-3, back 4-5-0; one fold per click       **/
/********************************************************/

var trifold = {
	active: false,
	state: 0,
	_ready: false,
	_width: [],
	_height: [],
	_intoView: null,
	_visPages: null,
	_banner: null,
	_brochure: null,
	_scene: null,
	_front: null,
	_back: null,
	_slots: null,
	_layoutKind: null,
	_warn: false,
	_usedPages: [],
	_slicePages: [],
	_panelNatW: 1,
	_panelNatH: 1,
	_animating: false,
	_animTimer: null,
	_applyingScale: false,
	_touchX: null,
	_onNext: null,
	_onPrevious: null,
	_onResize: null,
	_onKeyDown: null,
	_onTouchStart: null,
	_onTouchEnd: null,
	_onViewerClick: null,

	/* PDF page 1..6 fills slots in this order (last PDF page → slot 0). */
	PDF_TO_SLOT: [1, 2, 3, 4, 5, 0],
	/* Landscape print sheet (MIRAVERA compressed: ~921×612, ratio ~1.51). */
	WIDE_RATIO: 1.25,

	init: function () {
		this._onResize = fitScreen.debounce(() => {
			if (this.active) this.fitToScreen();
		}, 150);

		$(document).on('documentinit', () => {
			this.stop();
			this._ready = false;
			this._width = [];
			this._height = [];
			this._layoutKind = null;
		});

		$(document).on('pagerendered', (evt) => {
			if (!this.active) return;
			var detail = (evt.originalEvent && evt.originalEvent.detail) || evt.detail || {};
			var pageNum = detail.pageNumber;
			if (!pageNum) return;
			this._refreshLayout();
			if (this._slicePages.indexOf(pageNum) !== -1 || this._needsRemount(pageNum)) {
				this._fillSlots();
			}
			this.fitToScreen();
		});

		$(document).on('scalechanging', () => {
			if (!this.active || this._applyingScale) return;
			this._refreshLayout();
			this.fitToScreen();
		});

		$(document).on('rotationchanging', () => {
			if (!this.active) return;
			this._refreshLayout();
			this.fitToScreen();
		});

		fitScreen.bindPresentationReflow(() => {
			if (this.active) this.fitToScreen();
		});
	},

	start: function () {
		if (this.active || !this._ready) return;
		this.active = true;
		this.state = 0;
		this._animating = false;

		var viewer = PDFViewerApplication.pdfViewer;
		this._intoView = viewer.scrollPageIntoView;
		this._visPages = viewer._getVisiblePages;
		viewer.scrollPageIntoView = (data) => this._goToPage(data.pageNumber);
		viewer._getVisiblePages = () => this._visiblePages();

		this._measurePages();
		this._detectLayout();

		$('#viewer').removeClass('bookViewer').addClass('trifoldViewer pdfViewer');
		$('#mainContainer').addClass('trifoldMode');
		$('#outerContainer').addClass('trifoldMode');

		this._buildDom();
		this._fillSlots();
		this._bindControls();
		this._showBanner();
		this._setState(0, true);
		this.fitToScreen();
	},

	stop: function () {
		if (!this.active) return;
		this.active = false;
		this._animating = false;
		if (this._animTimer) {
			clearTimeout(this._animTimer);
			this._animTimer = null;
		}

		var viewer = PDFViewerApplication.pdfViewer;
		if (this._intoView) viewer.scrollPageIntoView = this._intoView;
		if (this._visPages) viewer._getVisiblePages = this._visPages;

		this._unbindControls();
		this._restorePages();

		$('#viewer').removeClass('trifoldViewer trifold-folding').removeAttr('style');
		$('#viewer .page').removeClass('trifold-hidden').removeAttr('style');
		$('#mainContainer').removeClass('trifoldMode');
		$('#outerContainer').removeClass('trifoldMode');

		if (this._banner) {
			this._banner.remove();
			this._banner = null;
		}

		this._brochure = null;
		this._scene = null;
		this._front = null;
		this._back = null;
		this._slots = null;
		this._usedPages = [];
		this._slicePages = [];
	},

	nextState: function () {
		if (!this.active || this._animating) return;
		var next = this.state + 1;
		if (next > 3) next = 0;
		this._setState(next, false);
	},

	prevState: function () {
		if (!this.active || this._animating) return;
		var prev = this.state - 1;
		if (prev < 0) prev = 3;
		this._setState(prev, false);
	},

	fitToScreen: function () {
		if (!this.active || !this._brochure) return;
		this._measurePages();
		this._updatePanelNaturalSize();

		var pw = this._panelNatW;
		var ph = this._panelNatH;
		if (!pw || !ph) return;

		var viewer = PDFViewerApplication.pdfViewer;
		var fitScale = fitScreen.scaleToFit(pw, ph, 3);
		if (Math.abs(viewer.currentScale - fitScale) > 0.001) {
			this._applyingScale = true;
			viewer.currentScale = fitScale;
			this._applyingScale = false;
			this._measurePages();
			this._updatePanelNaturalSize();
			pw = this._panelNatW;
			ph = this._panelNatH;
		}

		var size = fitScreen.getContainerSize();
		var pad = fitScreen.PADDING;
		var availW = Math.max(size.width - pad * 2, 1);
		var availH = Math.max(size.height - pad * 2, 1);
		var panelW = Math.min(availW / 3, availH * (pw / ph));
		var panelH = panelW * (ph / pw);

		[this._scene, this._brochure].forEach(function (el) {
			if (!el) return;
			el.style.setProperty('--panel-w', panelW + 'px');
			el.style.setProperty('--panel-h', panelH + 'px');
		});
	},

	pagesReady: function () {
		var count = (typeof PDFViewerApplication !== 'undefined' && PDFViewerApplication.pagesCount) || 0;
		if (!count) return false;
		var nodes = document.querySelectorAll('#viewer .page');
		return nodes.length >= Math.min(count, 6);
	},

	_pageIsWide: function (num) {
		var w = this._width[num];
		var h = this._height[num];
		if (!w || !h) return null;
		return (w / h) >= this.WIDE_RATIO;
	},

	_refreshLayout: function () {
		var prev = this._layoutKind;
		var prevWarn = this._warn;
		this._measurePages();
		this._detectLayout();
		if (this._layoutKind !== prev) {
			this._fillSlots();
			this._showBanner();
		} else if (this._warn !== prevWarn) {
			this._showBanner();
		}
	},

	_detectLayout: function () {
		var count = PDFViewerApplication.pagesCount || 0;
		var wide = this._pageIsWide(1);
		var kind;
		var warn = false;

		if (count === 3 && wide !== true) {
			kind = 'pages3';
		} else if (count === 6) {
			kind = 'pages6';
		} else if (count === 2 && wide !== false) {
			kind = 'pages2Wide';
		} else if (count === 1 && wide === true) {
			kind = 'pages1Wide';
		} else {
			kind = 'pagesN';
			warn = true;
		}

		this._layoutKind = kind;
		this._warn = warn;
		this._updatePanelNaturalSize();
	},

	_updatePanelNaturalSize: function () {
		var kind = this._layoutKind;
		var w = this._width[1] || 1;
		var h = this._height[1] || 1;
		if (kind === 'pages2Wide' || kind === 'pages1Wide') {
			this._panelNatW = w / 3;
			this._panelNatH = h;
		} else {
			this._panelNatW = w;
			this._panelNatH = h;
		}
	},

	_buildDom: function () {
		var viewer = document.getElementById('viewer');
		var scene = document.createElement('div');
		scene.className = 'trifold-scene';

		var brochure = document.createElement('div');
		brochure.className = 'trifold-brochure';
		brochure.setAttribute('data-state', '0');

		var front = document.createElement('div');
		front.className = 'fold-container pages-front';
		var back = document.createElement('div');
		back.className = 'fold-container pages-back';

		var slots = {};
		function makeSlot(id, side) {
			var slot = document.createElement('div');
			slot.className = 'slot slot-' + id + ' panel-' + side;
			slot.setAttribute('data-slot', String(id));
			var face = document.createElement('div');
			face.className = 'slot-face';
			slot.appendChild(face);
			slots[id] = face;
			return slot;
		}

		front.appendChild(makeSlot(1, 'left'));
		front.appendChild(makeSlot(2, 'center'));
		front.appendChild(makeSlot(3, 'right'));
		back.appendChild(makeSlot(4, 'left'));
		back.appendChild(makeSlot(5, 'center'));
		back.appendChild(makeSlot(0, 'right'));

		brochure.appendChild(front);
		brochure.appendChild(back);
		scene.appendChild(brochure);
		viewer.insertBefore(scene, viewer.firstChild);

		this._scene = scene;
		this._brochure = brochure;
		this._front = front;
		this._back = back;
		this._slots = slots;
	},

	_fillSlots: function () {
		if (!this._slots) return;
		var kind = this._layoutKind;
		this._usedPages = [];
		this._slicePages = [];

		if (kind === 'pages2Wide') {
			this._detachPagesToViewer();
			this._slicePages = [1, 2];
			this._usedPages = [1, 2];
			this._slicePageToSlots(1, [1, 2, 3]);
			this._slicePageToSlots(2, [4, 5, 0]);
			this._hideUnusedPages();
			return;
		}

		if (kind === 'pages1Wide') {
			this._detachPagesToViewer();
			this._slicePages = [1];
			this._usedPages = [1];
			this._slicePageToSlots(1, [1, 2, 3]);
			this._hideUnusedPages();
			return;
		}

		var count = PDFViewerApplication.pagesCount || 0;
		var map = this.PDF_TO_SLOT;
		for (var i = 0; i < map.length; i++) {
			var pageNum = i + 1;
			if (pageNum <= count) {
				this._mountPage(pageNum, map[i]);
				this._usedPages.push(pageNum);
			}
		}
		this._hideUnusedPages();
	},

	_pageEl: function (pageNum) {
		return document.querySelector('#viewer .page[data-page-number="' + pageNum + '"]');
	},

	_detachPagesToViewer: function () {
		var viewer = document.getElementById('viewer');
		if (!viewer) return;
		var pages = Array.prototype.slice.call(viewer.querySelectorAll('.page'));
		pages.forEach(function (pageEl) {
			if (pageEl.parentNode !== viewer) viewer.appendChild(pageEl);
		});
	},

	_needsRemount: function (pageNum) {
		if (this._slicePages.length) return false;
		var pageEl = this._pageEl(pageNum);
		if (!pageEl || !this._slots) return true;
		var parent = pageEl.parentNode;
		return !(parent && parent.classList && parent.classList.contains('slot-face'));
	},

	_mountPage: function (pageNum, slotId) {
		var pageEl = this._pageEl(pageNum);
		var face = this._slots[slotId];
		if (!pageEl || !face) return;
		if (pageEl.parentNode !== face) {
			face.innerHTML = '';
			face.appendChild(pageEl);
		}
		pageEl.classList.remove('trifold-hidden');
	},

	_slicePageToSlots: function (pageNum, slotIds) {
		var pageEl = this._pageEl(pageNum);
		if (!pageEl) return;
		var srcCanvas = pageEl.querySelector('.canvasWrapper canvas') || pageEl.querySelector('canvas');
		if (!srcCanvas || !srcCanvas.width) return;

		var sw = srcCanvas.width;
		var sh = srcCanvas.height;
		var sliceW = Math.floor(sw / 3);
		var parent = this;

		slotIds.forEach(function (slotId, i) {
			var face = parent._slots[slotId];
			if (!face) return;
			var dest = face.querySelector('canvas.trifold-slice');
			if (!dest) {
				face.innerHTML = '';
				dest = document.createElement('canvas');
				dest.className = 'trifold-slice';
				face.appendChild(dest);
			}
			var sx = i * sliceW;
			var dw = i === 2 ? sw - 2 * sliceW : sliceW;
			dest.width = dw;
			dest.height = sh;
			dest.getContext('2d').drawImage(srcCanvas, sx, 0, dw, sh, 0, 0, dw, sh);
		});

		pageEl.classList.add('trifold-hidden');
	},

	_hideUnusedPages: function () {
		var viewer = document.getElementById('viewer');
		if (!viewer) return;
		Array.prototype.forEach.call(viewer.children, function (el) {
			if (el.classList && el.classList.contains('page')) {
				el.classList.add('trifold-hidden');
			}
		});
	},

	_restorePages: function () {
		var viewer = document.getElementById('viewer');
		if (!viewer) return;
		var pages = Array.prototype.slice.call(viewer.querySelectorAll('.page'));
		pages.sort(function (a, b) {
			return parseInt(a.getAttribute('data-page-number'), 10)
				- parseInt(b.getAttribute('data-page-number'), 10);
		});
		if (this._scene && this._scene.parentNode) {
			this._scene.parentNode.removeChild(this._scene);
		}
		pages.forEach(function (pageEl) {
			viewer.appendChild(pageEl);
			pageEl.classList.remove('trifold-hidden');
		});
	},

	_prefersReducedMotion: function () {
		return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	},

	_setState: function (index, instant) {
		var from = this.state;
		this.state = index;
		if (!this._brochure) return;

		var reduced = instant || this._prefersReducedMotion();
		this._brochure.classList.toggle('no-motion', !!reduced);
		this._brochure.setAttribute('data-state', String(index));

		if (this._front && this._back) {
			this._front.classList.remove('old-page', 'new-page', 'flip');
			this._back.classList.remove('old-page', 'new-page', 'flip', 'finish');
			if (index === 3) {
				this._back.classList.add('finish');
				if (!reduced && from !== 3) {
					this._front.classList.add('old-page', 'flip');
					this._back.classList.add('new-page', 'flip');
				}
			} else if (from === 3 && index !== 3 && !reduced) {
				this._back.classList.add('old-page', 'flip');
				this._front.classList.add('new-page', 'flip');
			}
		}

		var page = this._pageForState(index);
		if (page) {
			PDFViewerApplication.page = page;
			PDFViewerApplication.pdfViewer.update();
		}

		if (reduced) {
			this._animating = false;
			return;
		}

		this._animating = true;
		this._brochure.classList.add('animating');
		if (this._animTimer) clearTimeout(this._animTimer);
		this._animTimer = setTimeout(() => {
			this._animating = false;
			if (this._brochure) this._brochure.classList.remove('animating');
			if (this._front) this._front.classList.remove('old-page', 'new-page', 'flip');
			if (this._back) this._back.classList.remove('old-page', 'new-page', 'flip');
			this._animTimer = null;
		}, 1050);
	},

	_pageForState: function (state) {
		if (state === 3) return this._usedPages[3] || this._usedPages[0] || 1;
		if (state === 1) return this._usedPages[0] || 1;
		if (state === 2) return this._usedPages[0] || 1;
		return this._usedPages[1] || this._usedPages[0] || 1;
	},

	_measurePages: function () {
		var viewer = PDFViewerApplication.pdfViewer;
		var scale = viewer.currentScale || 1;
		var parent = this;
		var pageViews = viewer._pages || [];

		pageViews.forEach(function (view, i) {
			if (!view || !view.viewport) return;
			parent._width[i + 1] = view.viewport.width / scale;
			parent._height[i + 1] = view.viewport.height / scale;
		});

		$('#viewer .page').each(function () {
			var num = parseInt($(this).attr('data-page-number'), 10);
			if (parent._width[num] && parent._height[num]) return;
			var w = $(this).width() / scale;
			var h = $(this).height() / scale;
			if (w && h) {
				parent._width[num] = w;
				parent._height[num] = h;
			}
		});
	},

	_bindControls: function () {
		this._onViewerClick = (e) => this._handleClick(e);
		this._onNext = (e) => {
			if (!this.active) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			this.nextState();
		};
		this._onPrevious = (e) => {
			if (!this.active) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			this.prevState();
		};
		this._onKeyDown = (e) => this._handleKey(e);
		this._onTouchStart = (e) => {
			if (e.changedTouches && e.changedTouches[0]) {
				this._touchX = e.changedTouches[0].clientX;
			}
		};
		this._onTouchEnd = (e) => {
			if (this._touchX == null || !e.changedTouches || !e.changedTouches[0]) return;
			var dx = e.changedTouches[0].clientX - this._touchX;
			this._touchX = null;
			if (Math.abs(dx) < 50) return;
			if (dx < 0) this.nextState();
			else this.prevState();
		};

		$('#viewer').on('click.trifold', this._onViewerClick);
		var nextBtn = document.getElementById('next');
		var prevBtn = document.getElementById('previous');
		if (nextBtn) nextBtn.addEventListener('click', this._onNext, true);
		if (prevBtn) prevBtn.addEventListener('click', this._onPrevious, true);
		window.addEventListener('resize', this._onResize);
		window.addEventListener('keydown', this._onKeyDown, true);
		var container = document.getElementById('viewerContainer');
		if (container) {
			container.addEventListener('touchstart', this._onTouchStart, { passive: true });
			container.addEventListener('touchend', this._onTouchEnd, { passive: true });
		}
	},

	_unbindControls: function () {
		$('#viewer').off('click.trifold');
		var nextBtn = document.getElementById('next');
		var prevBtn = document.getElementById('previous');
		if (nextBtn && this._onNext) nextBtn.removeEventListener('click', this._onNext, true);
		if (prevBtn && this._onPrevious) prevBtn.removeEventListener('click', this._onPrevious, true);
		window.removeEventListener('resize', this._onResize);
		if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown, true);
		var container = document.getElementById('viewerContainer');
		if (container && this._onTouchStart) {
			container.removeEventListener('touchstart', this._onTouchStart);
			container.removeEventListener('touchend', this._onTouchEnd);
		}
		this._onViewerClick = null;
		this._onNext = null;
		this._onPrevious = null;
		this._onKeyDown = null;
		this._onTouchStart = null;
		this._onTouchEnd = null;
	},

	_handleClick: function (e) {
		if (!this.active || this._animating) return;
		if (e.target.closest && e.target.closest('a, button, input, textarea')) return;
		var scene = this._scene;
		if (!scene) return;
		var rect = scene.getBoundingClientRect();
		if (!rect.width) return;
		var relX = e.clientX - rect.left;
		if (relX < rect.width * 0.2) this.prevState();
		else this.nextState();
	},

	_handleKey: function (e) {
		if (!this.active || this._animating) return;
		var tag = (e.target && e.target.tagName) || '';
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		var nextKeys = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, Spacebar: 1 };
		var prevKeys = { ArrowLeft: 1, ArrowUp: 1, PageUp: 1 };
		if (nextKeys[e.key]) {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.nextState();
		} else if (prevKeys[e.key]) {
			e.preventDefault();
			e.stopImmediatePropagation();
			this.prevState();
		}
	},

	_goToPage: function (pageNumber) {
		if (!this.active) return;
		PDFViewerApplication.page = pageNumber;
	},

	_visiblePages: function () {
		if (!this.active) return { first: null, last: null, views: [] };
		var views = PDFViewerApplication.pdfViewer._pages || [];
		var arr = [];
		var used = this._usedPages.length ? this._usedPages : [1, 2, 3, 4, 5, 6];
		for (var i = 0; i < used.length; i++) {
			var idx = used[i] - 1;
			if (!views[idx]) continue;
			arr.push({
				id: views[idx].id,
				view: views[idx],
				x: 0,
				y: 0,
				percent: 100,
			});
		}
		return {
			first: arr[0] || null,
			last: arr[arr.length - 1] || null,
			views: arr,
		};
	},

	_showBanner: function () {
		if (this._banner) {
			this._banner.remove();
			this._banner = null;
		}
		if (!this._warn) return;
		this._banner = $(
			'<div class="trifold-banner">This file is not a standard flyer layout. Use a 2-page landscape print sheet (3 panels per side), 3 square/portrait pages (left, cover, right), or 6 pages (fronts + backs). Opening with a best-effort layout.</div>',
		);
		$('#outerContainer').prepend(this._banner);
	},
};

trifold.init();
