'use strict';

let MAX_RESULTS = 10;
let $emojikey = $('#emojikey');
let $input = $emojikey.find('input[type=text]');
let $results = $emojikey.find('.emojikey-results');

var lastQuery = false;

function selectNext() {
  $results.find('.emojikey-selected:not(:last-child)')
    .removeClass('emojikey-selected')
    .next()
    .addClass('emojikey-selected');
}

function selectPrevious() {
  $results.find('.emojikey-selected:not(:first-child)')
    .removeClass('emojikey-selected')
    .prev()
    .addClass('emojikey-selected');
}

$input.on('keydown', e => {
  switch (e.which) {
    case 27: // ESC
      e.preventDefault();
      window.close();
      break;
    case 13: // Return
      e.preventDefault();
      insertAndClose();
      break;
    case 37: // Left arrow
    case 38: // Up arrow
      selectPrevious();
      e.preventDefault();
      break;
    case 39: // Right arrow
    case 40: // Down arrow
      selectNext();
      e.preventDefault();
      break;
    default:
      break;
  }
});

function getSelected() {
  return $results.find('.emojikey-selected').text();
}

function insertAndClose() {
  let message = {insertText: getSelected()};
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, message);
  });
  window.close();
}

$input.on('keyup', (e) => {
  let query = $input.val();
  if (query === lastQuery) {
    // Same query as last time, nothing to do
    return;
  }
  lastQuery = query;

  $results.empty();

  if (!query) {
    return;
  }

  chrome.runtime.sendMessage({query: query}, response => {
    if (query !== lastQuery) {
      // Query has changed, abort
      return;
    }
    let $searchResults = response.results
      .slice(0, MAX_RESULTS)
      .map( (result) => $('<li>').text(result.chars).click(insertAndClose) )
      .map( ($el, i) => i === 0 ? $el.addClass('emojikey-selected') : $el );
    $results.append($searchResults);
  });
});
