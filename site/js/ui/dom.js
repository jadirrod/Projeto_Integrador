export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function replaceOptions(select, options, { placeholder = null, keepValue = true } = {}) {
  const oldValues = keepValue
    ? new Set(select.multiple ? [...select.selectedOptions].map((option) => option.value) : [select.value])
    : new Set();
  select.replaceChildren();
  if (placeholder) {
    const empty = element('option', '', placeholder.label);
    empty.value = placeholder.value ?? '';
    select.append(empty);
  }
  for (const item of options) {
    const option = element('option', '', item.label);
    option.value = item.value;
    select.append(option);
  }
  if (keepValue && select.multiple) {
    for (const option of select.options) option.selected = oldValues.has(option.value);
  } else if (keepValue && [...select.options].some((option) => option.value === [...oldValues][0])) {
    select.value = [...oldValues][0];
  }
}

export function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = element('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function textCell(value, className) {
  return element('td', className, value ?? '—');
}

export function detailList(entries) {
  const list = element('ul', 'detail-list');
  for (const [label, value] of entries) {
    const item = element('li');
    const strong = element('strong', '', `${label}: `);
    item.append(strong, document.createTextNode(value));
    list.append(item);
  }
  return list;
}
