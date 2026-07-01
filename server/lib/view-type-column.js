/** Probe and cache whether pdf_documents.view_type exists in PostgREST schema. */

let hasViewTypeColumn = null;

function isMissingViewTypeError(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    msg.includes('view_type')
    || msg.includes('PGRST204')
    || /column .*view_type.* does not exist/i.test(msg)
  );
}

async function probeViewTypeColumn(supabase) {
  if (hasViewTypeColumn !== null) return hasViewTypeColumn;

  const { error } = await supabase.from('pdf_documents').select('view_type').limit(0);
  hasViewTypeColumn = !isMissingViewTypeError(error);
  return hasViewTypeColumn;
}

function invalidateViewTypeColumnCache() {
  hasViewTypeColumn = null;
}

module.exports = {
  probeViewTypeColumn,
  isMissingViewTypeError,
  invalidateViewTypeColumnCache,
};
