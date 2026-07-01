/********************************************************/
/**  Trifold flyer view — 3 panels per spread          **/
/********************************************************/

var trifold = {
	active: false,
	spread: 0,
	_ready: false,
	_width: [],
	_height: [],
	_intoView: null,
	_visPages: null,
	_banner: null,
	_onViewerClick: null,
	_onNext: null,
	_onPrevious: null,
	_onResize: null,

	init: function () {
		this._onResize = fitScreen.debounce(() => {
			if (this.active) this._layout();
		}, 150);

		$(document).on('documentinit', () => {
			this.stop();
			this._ready = false;
			this._width = [];
			this._height = [];
		});

		$(document).on('pagerendered', (evt) => {
			if (!this.active) return;
			var detail = (evt.originalEvent && evt.originalEvent.detail) || evt.detail || {};
			var pageNum = detail.pageNumber;
			if (!pageNum) return;
			var start = this.spread * 3 + 1;
			var end = start + 2;
			if (pageNum >= start && pageNum <= end) {
				this._measurePages();
				this._layout();
			}
		});

		$(document).on('scalechanging', () => {
			if (this.active) {
				this._measurePages();
				this._layout();
			}
		});

		$(document).on('rotationchanging', () => {
			if (this.active) {
				this._measurePages();
				this._layout();
			}
		});
	},

	start: function () {
		if (this.active || !this._ready) return;
		this.active = true;

		var viewer = PDFViewerApplication.pdfViewer;

		this._intoView = viewer.scrollPageIntoView;
		this._visPages = viewer._getVisiblePages;
		viewer.scrollPageIntoView = (data) => this._goToPage(data.pageNumber);
		viewer._getVisiblePages = () => this._visiblePages();

		this._measurePages();

		$('#viewer').removeClass('bookViewer').addClass('trifoldViewer');
		$('#mainContainer').addClass('trifoldMode');

		this._onViewerClick = (e) => this._handleEdgeClick(e);
		$('#viewer').on('click.trifold', this._onViewerClick);

		this._onNext = (e) => {
			if (!this.active) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			if (this.spread < this._maxSpread()) {
				this.setSpread(this.spread + 1, true);
			}
		};
		this._onPrevious = (e) => {
			if (!this.active) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			if (this.spread > 0) {
				this.setSpread(this.spread - 1, true);
			}
		};

		var nextBtn = document.getElementById('next');
		var prevBtn = document.getElementById('previous');
		if (nextBtn) nextBtn.addEventListener('click', this._onNext, true);
		if (prevBtn) prevBtn.addEventListener('click', this._onPrevious, true);
		window.addEventListener('resize', this._onResize);

		this._showBanner(PDFViewerApplication.pagesCount);
		this.setSpread(0, false);
	},

	stop: function () {
		if (!this.active) return;
		this.active = false;

		var viewer = PDFViewerApplication.pdfViewer;
		if (this._intoView) viewer.scrollPageIntoView = this._intoView;
		if (this._visPages) viewer._getVisiblePages = this._visPages;

		$('#viewer').off('click.trifold');
		this._onViewerClick = null;

		var nextBtn = document.getElementById('next');
		var prevBtn = document.getElementById('previous');
		if (nextBtn && this._onNext) nextBtn.removeEventListener('click', this._onNext, true);
		if (prevBtn && this._onPrevious) prevBtn.removeEventListener('click', this._onPrevious, true);
		this._onNext = null;
		this._onPrevious = null;

		window.removeEventListener('resize', this._onResize);

		$('#viewer .page').removeClass('trifold-hidden trifold-panel-left trifold-panel-center trifold-panel-right');
		$('#viewer').removeClass('trifoldViewer trifold-folding').removeAttr('style');
		$('#viewer .page').removeAttr('style');
		$('#mainContainer').removeClass('trifoldMode');

		if (this._banner) {
			this._banner.remove();
			this._banner = null;
		}
	},

	_measurePages: function () {
		var viewer = PDFViewerApplication.pdfViewer;
		var scale = viewer.currentScale;
		var parent = this;
		var pageViews = viewer._pages || [];

		$('#viewer .page').each(function () {
			var page = $(this).attr('data-page-number');
			var num = parseInt(page, 10);
			var w = $(this).width() / scale;
			var h = $(this).height() / scale;

			if ((!w || !h) && pageViews[num - 1] && pageViews[num - 1].viewport) {
				var vp = pageViews[num - 1].viewport;
				w = vp.width;
				h = vp.height;
			}

			if (w && h) {
				parent._width[page] = w;
				parent._height[page] = h;
			}
		});
	},

	setSpread: function (index, animate, targetPage) {
		this.spread = Math.max(0, Math.min(index, this._maxSpread()));

		var viewer = $('#viewer');
		if (animate) {
			viewer.addClass('trifold-folding');
			setTimeout(() => viewer.removeClass('trifold-folding'), 600);
		}

		this._showPagesForSpread(this.spread);
		var page = targetPage || this._spreadStart(this.spread);
		PDFViewerApplication.page = page;
		PDFViewerApplication.pdfViewer.update();
		this._layout();
	},

	_maxSpread: function () {
		var pages = PDFViewerApplication.pagesCount;
		return Math.max(0, Math.ceil(pages / 3) - 1);
	},

	_spreadStart: function (spreadIndex) {
		return spreadIndex * 3 + 1;
	},

	_spreadEnd: function (spreadIndex) {
		return Math.min(this._spreadStart(spreadIndex) + 2, PDFViewerApplication.pagesCount);
	},

	_showPagesForSpread: function (spreadIndex) {
		var start = this._spreadStart(spreadIndex);
		var end = this._spreadEnd(spreadIndex);
		var pages = PDFViewerApplication.pagesCount;

		$('#viewer .page').each(function () {
			var num = parseInt($(this).attr('data-page-number'), 10);
			var inSpread = num >= start && num <= end && num <= pages;
			$(this).toggleClass('trifold-hidden', !inSpread);
			$(this).removeClass('trifold-panel-left trifold-panel-center trifold-panel-right');
			if (inSpread) {
				var pos = num - start;
				var cls = pos === 0 ? 'trifold-panel-left' : (pos === 1 ? 'trifold-panel-center' : 'trifold-panel-right');
				$(this).addClass(cls);
			}
		});
	},

	_layout: function () {
		if (!this.active) return;
		var parent = this;
		var container = fitScreen.getContainerSize();
		var containerW = container.width;
		var containerH = container.height;
		var visible = 0;
		var maxNatH = 0;
		var maxNatW = 1;

		$('#viewer .page:not(.trifold-hidden)').each(function () {
			visible++;
			var page = $(this).attr('data-page-number');
			var natW = parent._width[page] || 1;
			var natH = parent._height[page] || 1;
			if (natH > maxNatH) maxNatH = natH;
			if (natW > maxNatW) maxNatW = natW;
		});

		if (!visible) return;

		var panelW = containerW / visible;
		var maxH = panelW * (maxNatH / maxNatW);

		if (maxH > containerH && containerH > 0) {
			var shrink = containerH / maxH;
			panelW *= shrink;
			maxH = containerH;
		}

		$('#viewer .page:not(.trifold-hidden)').each(function () {
			var page = $(this).attr('data-page-number');
			var natW = parent._width[page] || maxNatW;
			var natH = parent._height[page] || maxNatH;
			var h = panelW * (natH / natW);
			$(this).css({ width: panelW, height: h });
		});

		$('#viewer').css({
			width: panelW * visible,
			height: maxH || 400,
			margin: 'auto',
		});
	},

	_handleEdgeClick: function (e) {
		var $viewer = $('#viewer');
		var offset = $viewer.offset();
		if (!offset) return;
		var relX = e.pageX - offset.left;
		var w = $viewer.width();
		if (w <= 0) return;

		if (relX < w * 0.15 && this.spread > 0) {
			this.setSpread(this.spread - 1, true);
		} else if (relX > w * 0.85 && this.spread < this._maxSpread()) {
			this.setSpread(this.spread + 1, true);
		}
	},

	_goToPage: function (pageNumber) {
		if (!this.active) return;
		var targetSpread = Math.min(Math.floor((pageNumber - 1) / 3), this._maxSpread());
		if (targetSpread !== this.spread) {
			this.setSpread(targetSpread, false, pageNumber);
		} else {
			PDFViewerApplication.page = pageNumber;
		}
	},

	_visiblePages: function () {
		if (!this.active) return { first: null, last: null, views: [] };
		var views = PDFViewerApplication.pdfViewer._pages;
		var start = this.spread * 3;
		var arr = [];
		for (var i = start; i < start + 3 && i < views.length; i++) {
			arr.push({
				id: views[i].id,
				view: views[i],
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

	_showBanner: function (pages) {
		if (pages === 6) return;
		if (this._banner) this._banner.remove();
		this._banner = $(
			'<div class="trifold-banner">Flyer view shows 3 panels per spread. For print trifolds, use 6 pages (outside 1&ndash;3, inside 4&ndash;6).</div>',
		);
		$('#outerContainer').prepend(this._banner);
	},
};

trifold.init();
