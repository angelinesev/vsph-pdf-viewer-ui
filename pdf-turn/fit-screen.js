/********************************************************/
/**  Viewport fit helpers for brochure flip & flyer    **/
/********************************************************/

var fitScreen = {
	PADDING: 8,
	SHADOW_INSET: 16,
	FIT_MARGIN: 0.985,

	getContainerSize: function () {
		var el = document.getElementById('viewerContainer');
		if (!el) {
			return { width: 0, height: 0 };
		}
		var style = window.getComputedStyle(el);
		var padTop = parseFloat(style.paddingTop) || 0;
		var padBottom = parseFloat(style.paddingBottom) || 0;
		var padLeft = parseFloat(style.paddingLeft) || 0;
		var padRight = parseFloat(style.paddingRight) || 0;
		var width = el.clientWidth - padLeft - padRight;
		var height = el.clientHeight - padTop - padBottom;
		var isFullscreen = document.fullscreenElement === el
			|| document.webkitFullscreenElement === el
			|| document.mozFullScreenElement === el
			|| document.msFullscreenElement === el;
		if (isFullscreen && (width < 50 || height < 50)) {
			width = window.innerWidth - padLeft - padRight;
			height = window.innerHeight - padTop - padBottom;
		}
		return { width: Math.max(width, 1), height: Math.max(height, 1) };
	},

	bindPresentationReflow: function (callback) {
		var debounced = this.debounce(callback, 150);
		var schedule = function () {
			debounced();
			requestAnimationFrame(debounced);
			setTimeout(debounced, 300);
		};
		$(document).on('presentationmodechanged', schedule);
		window.addEventListener('fullscreenchange', schedule);
		window.addEventListener('webkitfullscreenchange', schedule);
		window.addEventListener('mozfullscreenchange', schedule);
		window.addEventListener('MSFullscreenChange', schedule);
	},

	scaleToFit: function (pageW, pageH, columns, padding) {
		var pad = padding != null ? padding : this.PADDING;
		var bleed = this.SHADOW_INSET;
		var size = this.getContainerSize();
		if (!pageW || !pageH || !size.width || !size.height) {
			return 1;
		}
		var cols = Math.max(columns, 1);
		var availW = Math.max(size.width - pad * 2 - bleed, 1);
		var availH = Math.max(size.height - pad * 2 - bleed, 1);
		var scaleW = availW / (pageW * cols);
		var scaleH = availH / pageH;
		return Math.min(scaleW, scaleH) * this.FIT_MARGIN;
	},

	debounce: function (fn, ms) {
		var timer;
		return function () {
			var args = arguments;
			var self = this;
			clearTimeout(timer);
			timer = setTimeout(function () {
				fn.apply(self, args);
			}, ms);
		};
	},
};
