$.getJSON('/config_resources/emoji-data.json', function(db) {
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      let results = search(request.query, db);
      sendResponse({results: results});
  });
});
