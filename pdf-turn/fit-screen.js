/********************************************************/
/**  Viewport fit helpers for brochure flip & flyer    **/
/********************************************************/

var fitScreen = {
	PADDING: 16,

	getContainerSize: function () {
		var el = document.getElementById('viewerContainer');
		if (!el) {
			return { width: 0, height: 0 };
		}
		var width = el.clientWidth;
		var height = el.clientHeight;
		var isFullscreen = document.fullscreenElement === el
			|| document.webkitFullscreenElement === el
			|| document.mozFullScreenElement === el
			|| document.msFullscreenElement === el;
		if (isFullscreen && (width < 50 || height < 50)) {
			width = window.innerWidth;
			height = window.innerHeight;
		}
		return { width: width, height: height };
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
		var size = this.getContainerSize();
		if (!pageW || !pageH || !size.width || !size.height) {
			return 1;
		}
		var cols = Math.max(columns, 1);
		var availW = Math.max(size.width - pad * 2, 1);
		var availH = Math.max(size.height - pad * 2, 1);
		var scaleW = availW / (pageW * cols);
		var scaleH = availH / pageH;
		return Math.min(scaleW, scaleH);
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
