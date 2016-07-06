$(function() {

    let MAX_RESULTS = 10;
    let SPINNER_HTML = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';

    let $input = $('<input>')
        .attr({
            type: 'text',
            placeholder: 'Search for emoji'
        });
    let $spinner = $(SPINNER_HTML).hide();
    let $results = $('<ol>').addClass('results');
    let $ui = $('<div>')
        .attr('id', 'emojikey')
        .append(
            $('<div>')
                .addClass('container')
                .append($input, $spinner, $results)
        )
        .hide()
        .appendTo($('html'));

    $(document)
        .ajaxStart( () => $spinner.show() )
        .ajaxStop( () => $spinner.hide() );

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
        console.log('selectedText', selectedText);
        let query = selectedText.length > 0
            ? selectedText
            : text.substring(0, cursorPosition).match(/(\w*)\s*$/)[1]; // Word before cursor

        console.log(textRange);
        console.log(query);
        
        $input.val(query);
        $ui.show();
        $input.select();
        // TODO: fix query selection lost after showing results
    }

    function hide() {
        $ui.hide();
        $textField.focus();
    }

    function insertText(text) {
        if ($textField.is(':text, textarea')) {
            $textField
                .textrange('set', textRange.start, textRange.length)
                .textrange('replace', text)
                .textrange('set', textRange.start + 1, 0);
        } else {
            // contenteditable
            let selection = window.getSelection();
            console.log(selectionRange);
            selection.removeAllRanges();
            selection.addRange(selectionRange);
            selectionRange.deleteContents();
            selectionRange.insertNode(document.createTextNode(text));
        }
    }

    function insertSelected() {
        insertText($results.find('.selected').text());
    }

    function selectAndInsert(e) {
        $results.find('.selected')
            .removeClass('selected');
        hide();
        $(e.target).addClass('selected');        
        insertSelected();
    }

    function selectNext() {
        $results.find('.selected:not(:last-child)')
            .removeClass('selected')
            .next()
            .addClass('selected');
    }

    function selectPrevious() {
        $results.find('.selected:not(:first-child)')
            .removeClass('selected')
            .prev()
            .addClass('selected');
    }

    $ui.on('click', function(e) {
       	if ($ui.is(e.target)) { // Background div only, not descendents
            hide();
            e.preventDefault();
        }
    });

    $input.on('keydown', function(e) {
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

    $input.on('keyup', function(e) {
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

        chrome.runtime.sendMessage({query: query}, function(response) {
            if (query !== lastQuery) {
                // Query has changed, abort
                return;
            }
            let $searchResults = response.results
                .slice(0, MAX_RESULTS)
                .map( (result) => $('<li>').text(result.chars).click(selectAndInsert) )
                .map( ($el, i) => i === 0 ? $el.addClass('selected') : $el );
            $results.append($searchResults);
        });
    });

    $(document).on('keydown', ':text, textarea, [contenteditable=true]', function(e) {
        if (e.metaKey && e.which === 69) { // Meta + E
            if ($ui.is(':visible')) {
                hide();
            } else {
                show(e.target);
            }
        }
    });

});
