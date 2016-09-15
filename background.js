$.getJSON('/config_resources/emoji-data.json', db => {
  chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      let results = search(request.query, db);
      sendResponse({results: results});
  });
});
