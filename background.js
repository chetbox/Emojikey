function search(emojis, index, query) {
  let index_matches = index[query] || {};
  let results = $.map(index_matches, function(p, index) {
    return {
      p: p,
      chars: emojis[index].chars
    };
  });
  results.sort( (a, b) => b.p - a.p );
  return results;
}

$.getJSON('/config_resources/emoji-data.json', function(data) {
  let emojis = data.emojis;
  let index = data.index;

  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      console.log(request);
      let results = search(emojis, index, request.query);
      sendResponse({results: results});
  });
});
