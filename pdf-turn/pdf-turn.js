/********************************************************/
/**     HERE MAIN MODIFIED PART FOR turnjs SUPPORT     **/
/********************************************************/
/// requires jquery and turnjs
/// all code added in viewer.js (from pdfjs build) in order to support
/// flipbook is commented with '$FB:' string to allow to find it easilly

var bookFlip = {
	_width: [],
	_height: [],
	active: false,
	_spreadBk: NaN,
	_evSpread: null,
	_spread: NaN,
	toStart: false,
	_intoView: null,
	_visPages: null,
	_ready: false,
	_onResize: null,

	init: function () {
		this._onResize = fitScreen.debounce(() => {
			if (this.active) this.fitToScreen();
		}, 150);

		$(document).on('rotationchanging', () => { this.rotate(); });
		$(document).on('scalechanging', () => {
			if (this.active) {
				this._measurePages();
				this.resize();
			}
		});
		$(document).on('pagechanging', () => { this.flip(); });

		$(document).on('documentinit', () => {
			this.stop();
			this._ready = false;
			this.toStart = false;
		});

		$(document).on('scrollmodechanged', () => {
			var scroll = PDFViewerApplication.pdfViewer.scrollMode;
			if (scroll === 3) this.start();
			else this.stop();
			var button = PDFViewerApplication.appConfig.secondaryToolbar.bookFlipButton;
			button.classList.toggle('toggled', scroll === 3);
		});

		$(document).on('switchspreadmode', (evt) => {
			this.spread(evt.originalEvent.detail.mode);
			PDFViewerApplication.eventBus.dispatch('spreadmodechanged', {
				source: PDFViewerApplication,
				mode: evt.originalEvent.detail.mode,
			});
		});

		$(document).on('pagerendered', (evt) => {
			if (!this.active) return;
			var detail = (evt.originalEvent && evt.originalEvent.detail) || evt.detail || {};
			var pageNum = detail.pageNumber;
			if (!pageNum) return;
			var page = PDFViewerApplication.page;
			var min = Math.max(page - 3, 1);
			var max = Math.min(page + 3, PDFViewerApplication.pagesCount);
			if (pageNum >= min && pageNum <= max) {
				this._measurePages();
				this.resize();
			}
		});

		$(document).on('pagesloaded', () => {
			if (typeof viewMode !== 'undefined' && viewMode.get() === 'flyer') return;
			this._ready = true;
		});

		$(document).on('baseviewerinit', () => {
			this._intoView = PDFViewerApplication.pdfViewer.scrollPageIntoView;
			this._visPages = PDFViewerApplication.pdfViewer._getVisiblePages;
		});
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

	fitToScreen: function () {
		if (!this.active) return;
		var page = PDFViewerApplication.page;
		var pw = this._width[page];
		var ph = this._height[page];
		if (!pw || !ph) return;

		var fitScale = fitScreen.scaleToFit(pw, ph, this._spreadMult());
		var viewer = PDFViewerApplication.pdfViewer;
		if (Math.abs(viewer.currentScale - fitScale) > 0.001) {
			viewer.currentScale = fitScale;
		}
		this._measurePages();
		this.resize();
	},

	start: function () {
		if (this.active || !this._ready) return;
		this.active = true;

		var viewer = PDFViewerApplication.pdfViewer;

		$('.scrollModeButtons').removeClass('toggled');

		this._spreadBk = viewer.spreadMode;
		var selected = $('.spreadModeButtons.toggled').attr('id');
		this._spread = (this._spreadBk !== 2) ? 0 : 2;
		viewer.spreadMode = 0;
		viewer._spreadMode = -1;
		$('.spreadModeButtons').removeClass('toggled');
		$('#' + selected).addClass('toggled');

		this._evSpread = PDFViewerApplication.eventBus._listeners.switchspreadmode;
		PDFViewerApplication.eventBus._listeners.switchspreadmode = null;

		viewer.scrollPageIntoView = (data) => this.link(data);
		viewer._getVisiblePages = () => this.load();

		this._measurePages();

		$('#mainContainer').addClass('bookFlipMode');
		$('#viewer').removeClass('pdfViewer').addClass('bookViewer').css({ opacity: 1 });
		window.addEventListener('resize', this._onResize);

		$('#spreadOdd').prop('disabled', true);
		var pages = PDFViewerApplication.pagesCount;
		for (var p = 3; p < pages + (pages % 2); p++) {
			if (this._height[p] != this._height[p - 1] || this._width[p] != this._width[p - 1]) {
				$('#spreadEven').prop('disabled', true);
				this._spread = 0;
			}
		}

		if (this.toStart && pages > 1 && this._spread === 0) {
			var equalSizes = true;
			for (var i = 2; i <= pages; i++) {
				if (this._height[i] != this._height[i - 1] || this._width[i] != this._width[i - 1]) {
					equalSizes = false;
					break;
				}
			}
			if (equalSizes) {
				this._spread = 2;
			}
		}

		$('#viewer').turn({
			elevation: 50,
			width: this._size(PDFViewerApplication.page, 'width') * this._spreadMult(),
			height: this._size(PDFViewerApplication.page, 'height'),
			page: PDFViewerApplication.page,
			when: {
				turned: function (event, page) {
					PDFViewerApplication.page = page;
					viewer.update();
				},
			},
			display: this._spreadType(),
		});

		this.toStart = false;
		this.fitToScreen();
	},

	stop: function () {
		if (!this.active) return;
		this.active = false;

		window.removeEventListener('resize', this._onResize);

		var viewer = PDFViewerApplication.pdfViewer;

		$('#viewer').turn('destroy');

		viewer.scrollPageIntoView = this._intoView;
		viewer._getVisiblePages = this._visPages;

		PDFViewerApplication.eventBus._listeners.switchspreadmode = this._evSpread;
		viewer.spreadMode = this._spreadBk;

		$('#viewer .page').removeAttr('style');
		$('#viewer').removeAttr('style').removeClass('shadow bookViewer').addClass('pdfViewer');
		$('#mainContainer').removeClass('bookFlipMode');

		var parent = this;
		$('#viewer .page').each(function () {
			var page = $(this).attr('data-page-number');
			$(this).css('width', parent._size(page, 'width')).css('height', parent._size(page, 'height'));
		});
	},

	resize: function () {
		if (!this.active) return;
		var page = PDFViewerApplication.page;
		$('#viewer').turn('size', this._size(page, 'width') * this._spreadMult(), this._size(page, 'height'));
	},

	rotate: function () {
		if (!this.active) return;
		[this._height, this._width] = [this._width, this._height];
		this.fitToScreen();
	},

	spread: function (spreadMode) {
		if (!this.active) return;
		this._spread = spreadMode;
		$('#viewer').turn('display', this._spreadType());
		this.fitToScreen();
	},

	flip: function () {
		if (!this.active) return;
		$('#viewer').turn('page', PDFViewerApplication.page);
		if (!PDFViewerApplication.pdfViewer.hasEqualPageSizes) this.resize();
	},

	link: function (data) {
		if (!this.active) return;
		PDFViewerApplication.page = data.pageNumber;
	},

	load: function () {
		if (!this.active) return;
		var views = PDFViewerApplication.pdfViewer._pages;
		var arr = [];
		var page = PDFViewerApplication.page;
		var min = Math.max(page - ((this._spread === 0) ? 2 : 3 + (page % 2)), 0);
		var max = Math.min(page + ((this._spread === 0) ? 1 : 3 - (page % 2)), views.length);

		for (var i = min, ii = max; i < ii; i++) {
			arr.push({
				id: views[i].id,
				view: views[i],
				x: 0, y: 0, percent: 100,
			});
		}

		return { first: arr[page - min - 1], last: arr[arr.length - 1], views: arr };
	},

	_spreadType: function () {
		return (this._spread === 0) ? 'single' : 'double';
	},

	_spreadMult: function () {
		return (this._spread === 0) ? 1 : 2;
	},

	_size: function (page, request) {
		var size;
		if (request === 'width') size = this._width[page];
		if (request === 'height') size = this._height[page];
		return size * PDFViewerApplication.pdfViewer.currentScale;
	},
};

bookFlip.init();
