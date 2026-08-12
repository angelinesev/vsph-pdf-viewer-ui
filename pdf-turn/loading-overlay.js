/********************************************************/
/**  Loading overlay shown until the first page paints  **/
/********************************************************/

(function () {
	var overlay = null;
	var hidden = false;
	var safetyTimer = null;

	function mount() {
		if (document.getElementById('vsLoadingOverlay')) return;
		overlay = document.createElement('div');
		overlay.id = 'vsLoadingOverlay';
		overlay.className = 'vs-loading-overlay';
		overlay.innerHTML = '<div class="vs-loading-spinner"></div><div class="vs-loading-text">Loading document&hellip;</div>';
		document.body.appendChild(overlay);
	}

	function hide() {
		if (hidden) return;
		hidden = true;
		if (safetyTimer) {
			clearTimeout(safetyTimer);
			safetyTimer = null;
		}
		if (overlay) {
			overlay.classList.add('vs-loading-overlay--hidden');
			setTimeout(function () {
				if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
				overlay = null;
			}, 300);
		}
	}

	function init() {
		mount();
		safetyTimer = setTimeout(hide, 25000);
		if (typeof $ !== 'undefined') {
			$(document).one('pagerendered', hide);
		}
		window.addEventListener('vsPagesFailed', hide);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
