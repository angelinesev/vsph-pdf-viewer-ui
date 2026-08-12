/********************************************************/
/**     View mode: brochure (flip) vs flyer (trifold)   **/
/********************************************************/

var viewMode = {
	_mode: null,

	get: function () {
		if (this._mode === null) {
			var params = new URLSearchParams(window.location.search);
			this._mode = params.get('view') === 'flyer' ? 'flyer' : 'brochure';
		}
		return this._mode;
	},

	init: function () {
		$(document).on('pagesloaded', () => {
			if (this.get() === 'flyer') {
				var trifoldTries = 0;
				var startTrifold = () => {
					if (trifold.active) return;
					if (typeof bookFlip !== 'undefined' && bookFlip.active) {
						bookFlip.stop();
					}
					if (typeof trifold.pagesReady === 'function' && !trifold.pagesReady() && trifoldTries < 50) {
						trifoldTries += 1;
						setTimeout(startTrifold, 100);
						return;
					}
					trifold._ready = true;
					trifold.start();
				};

				var viewer = PDFViewerApplication.pdfViewer;
				if (viewer && viewer.onePageRendered) {
					viewer.onePageRendered.then(startTrifold).catch(startTrifold);
				} else {
					startTrifold();
				}

				setTimeout(() => {
					if (!trifold.active) {
						startTrifold();
					}
				}, 3000);
				return;
			}

			var startBrochureFlip = () => {
				if (bookFlip.active) return;
				var viewer = PDFViewerApplication.pdfViewer;
				if (viewer.pagesCount > 1) {
					viewer.spreadMode = 2;
				}
				bookFlip._ready = true;
				bookFlip.toStart = true;
				viewer.scrollMode = 3;
				if (!bookFlip.active) {
					bookFlip.start();
				}
			};

			var viewer = PDFViewerApplication.pdfViewer;
			if (viewer && viewer.onePageRendered) {
				viewer.onePageRendered.then(startBrochureFlip).catch(startBrochureFlip);
			} else {
				startBrochureFlip();
			}

			setTimeout(() => {
				if (!bookFlip.active) {
					startBrochureFlip();
				}
			}, 3000);
		});
	},
};

viewMode.init();
