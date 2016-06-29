let MAX_RESULTS = 10;

$(function() {

    let $input = $('<input>')
        .attr({
            type: 'text',
            placeholder: 'Search for emoji'
        });
    let $results = $('<ol>').addClass('results');
    let $ui = $('<div>')
        .attr('id', 'emojikey')
        .append($input, $results)
        .hide()
        .appendTo($('html'));

    var $textField = false;
    var textRange = false;
    var request = false;
    var lastQuery = false;

    function show(target) {
        $textField = $(target);
        textRange = $textField.textrange();

        let text = $textField.attr('contenteditable')
            ? $textField.text()
            : $textField.val();
        var query = textRange.length === 0
            ? text.substring(0, textRange.position).match(/(\w*)\s*$/)[1] // Word before cursor
            : textRange.text;
        
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
        $textField
            .textrange('set', textRange.start, textRange.length)
            .textrange('replace', text)
            .textrange('set', textRange.start + 1, 0);
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

    $input.on('keyup', function(e) {
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

        let query = $input.val();
        if (query === lastQuery) {
            // Same query as last time, nothing to do
            return;
        }

        $results.empty();

        if (!query) {
            return;
        }

        // Cancel previous search
        if (request) {
            request.abort();
        }

        lastQuery = query;

        request = $.ajax('http://emojipedia.org/?s=' + encodeURIComponent(query), {
            success: function(emojipediaResultsHtml) {
                let $emojipediaResults = $($.parseHTML(emojipediaResultsHtml))
                    .find('.search-results li .emoji')
                    .slice(0, MAX_RESULTS)
                    .map( (_, el) => $(el).text() )
                    .map( (_, emoji) => $('<li>').text(emoji).click(selectAndInsert) )
                    .map( (i, $el) => i === 0 ? $el.addClass('selected') : $el );
                $results.append($emojipediaResults.get());
            }
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
