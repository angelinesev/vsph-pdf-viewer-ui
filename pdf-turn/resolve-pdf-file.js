/**
 * Resolve /api/pdf/:token to a Supabase signed URL before PDF.js loads.
 * Avoids Netlify Function 6 MB response limit on large PDFs.
 */
(function resolvePdfFileBeforeViewer() {
  function loadViewer() {
    var script = document.createElement('script');
    script.src = 'viewer.js';
    document.head.appendChild(script);
  }

  function showError(message) {
    document.body.classList.remove('loadingInProgress');
    document.body.innerHTML = '<div style="padding:2rem;font-family:system-ui,sans-serif">'
      + '<h1>Could not load PDF</h1><p>' + message + '</p></div>';
  }

  var params = new URLSearchParams(window.location.search);
  var file = params.get('file');
  if (!file) {
    loadViewer();
    return;
  }

  var decoded;
  try {
    decoded = decodeURIComponent(file);
  } catch {
    decoded = file;
  }

  var match = decoded.match(/^\/api\/pdf\/(.+)$/);
  if (!match) {
    loadViewer();
    return;
  }

  var token = match[1];
  fetch('/api/pdf-url/' + encodeURIComponent(token))
    .then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    })
    .then(function (result) {
      if (!result.ok || !result.data.url) {
        throw new Error(result.data.error || 'Failed to resolve PDF URL');
      }
      params.set('file', result.data.url);
      var query = params.toString();
      var nextUrl = window.location.pathname + (query ? '?' + query : '');
      history.replaceState(null, '', nextUrl);
      loadViewer();
    })
    .catch(function (err) {
      showError(err.message || 'Failed to load PDF');
    });
})();
