$.getJSON('/config_resources/emoji-data.json', function(db) {
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      console.log(request);
      let results = search(request.query, db);
      console.log(results);
      sendResponse({results: results});
  });
});
