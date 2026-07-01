(function () {
	var BRAND_URL = 'https://www.virtualstudios.ph/';
	var LOGO_SRC = '../../../pdf-turn/assets/vs-flipbook-logo.png';

	function mountBrandingOverlay() {
		if (document.getElementById('vsFlipbookBranding')) {
			return;
		}

		var link = document.createElement('a');
		link.id = 'vsFlipbookBranding';
		link.className = 'vs-flipbook-branding';
		link.href = BRAND_URL;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.setAttribute('aria-label', 'Virtual Studios');

		var img = document.createElement('img');
		img.src = LOGO_SRC;
		img.alt = 'Flipbook by Virtual Studios';

		link.appendChild(img);
		document.body.appendChild(link);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mountBrandingOverlay);
	} else {
		mountBrandingOverlay();
	}
})();
