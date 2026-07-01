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
		return {
			width: el.clientWidth,
			height: el.clientHeight,
		};
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
