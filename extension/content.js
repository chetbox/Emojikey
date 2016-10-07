'use strict';

function insertText(text) {
  let $textField = $(document.activeElement);

  if (!$textField.is(':text, textarea, [contenteditable=true]')) {
    console.warn('No text field selected to insert "' + text + '"');
    return;
  }

  if ($textField.is(':text, textarea')) {
    let textRange = $textField.textrange();
    $textField
      .textrange('set', textRange.start, textRange.length)
      .textrange('replace', text)
      .textrange('set', textRange.start + text.length, 0);
  } else {
    // contenteditable
    let range = window.getSelection().getRangeAt(0).cloneRange();
    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    selection.collapseToEnd();
  }
}

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.insertText) {
      insertText(request.insertText);
    }
});
