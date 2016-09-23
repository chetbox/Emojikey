'use strict';

$(() => {

    let MAX_RESULTS = 10;

    let $input = $('<input>')
        .attr({
            type: 'text',
            placeholder: 'Search'
        });
    let $results = $('<ol>').addClass('emojikey-results');
    let $ui = $('<div>')
        .attr('id', 'emojikey')
        .append(
            $('<div>')
                .addClass('emojikey-container')
                .append(
                  $('<span>').addClass('search-label').text('\uD83D\uDD0D'),
                  $input,
                  $('<hr>'),
                  $results
                )
        )
        .appendTo($('html'));

    var $textField = false;
    var textRange = false;
    var selectionRange = false;
    var lastQuery = false;

    function show(target) {
        $textField = $(target);
        // TODO: Fix: Sometimes textRange is [textarea] or [input], not object
        textRange = $textField.textrange();
        selectionRange = window.getSelection().getRangeAt(0).cloneRange();

        let text = $textField.is(':text, textarea')
            ? $textField.val()
            : $textField.text();
        let selectedText = $textField.is(':text, textarea')
            ? textRange.text
            : selectionRange.toString();
        let cursorPosition = $textField.is(':text, textarea')
            ? textRange.position
            : 0; // TODO: find cursor position for contenteditable
        let query = selectedText.length > 0
            ? selectedText
            : text.substring(0, cursorPosition).match(/(\w*)\s*$/)[1]; // Word before cursor

        $input.val(query);
        $ui.addClass('emojikey-showing');
        $input.select();
        // TODO: fix query selection lost after showing results
    }

    function hide() {
        $ui.removeClass('emojikey-showing');
        $textField.focus();
    }

    function insertText(text) {
        if ($textField.is(':text, textarea')) {
            $textField
                .textrange('set', textRange.start, textRange.length)
                .textrange('replace', text)
                .textrange('set', textRange.start + text.length, 0);
        } else {
            // contenteditable
            selectionRange.deleteContents();
            selectionRange.insertNode(document.createTextNode(text));

            let selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(selectionRange);
            selection.collapseToEnd();
        }
    }

    function insertSelected() {
        insertText($results.find('.emojikey-selected').text());
    }

    function selectAndInsert(e) {
        $results.find('.emojikey-selected')
            .removeClass('emojikey-selected');
        hide();
        $(e.target).addClass('emojikey-selected');
        insertSelected();
    }

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

    $ui.on('click', e => {
       	if ($ui.is(e.target)) { // Background div only, not descendents
            hide();
            e.preventDefault();
        }
    });

    $input.on('keydown', e => {
        switch (e.which) {
            case 27: // ESC
                e.preventDefault();
                hide();
                return;
            case 13: // Return
                e.preventDefault();
                hide();
                insertSelected();
                return;
            case 37: // Left arrow
            case 38: // Up arrow
                selectPrevious();
                e.preventDefault();
                return;
            case 39: // Right arrow
            case 40: // Down arrow
                selectNext();
                e.preventDefault();
                return;
            default:
                break;
        }
    });

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
                .map( (result) => $('<li>').text(result.chars).click(selectAndInsert) )
                .map( ($el, i) => i === 0 ? $el.addClass('emojikey-selected') : $el );
            $results.append($searchResults);
        });
    });

    $(document).on('keydown', ':text, textarea, [contenteditable=true]', e => {
        if (e.metaKey && e.which === 69) { // Meta + E
            e.preventDefault();
            if ($ui.is(':visible')) {
                hide();
            } else {
                show(e.target);
            }
        }
    });

});
