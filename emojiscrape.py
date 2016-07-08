#!/usr/bin/env python3

from lxml import html
import requests
from os.path import isfile
import re
import json

DATA_CACHE_FILE = 'data/full-emoji-list.html'
OUTPUT_FILE = 'config_resources/emoji-data.json'

def fetch_emojis():

    def http_get():
        print('Fetching emojis')
        return requests.get('http://unicode.org/emoji/charts/full-emoji-list.html').content

    def is_cached():
        return DATA_CACHE_FILE and isfile(DATA_CACHE_FILE)

    def read_cached():
        return open(DATA_CACHE_FILE, encoding='utf-8').read()

    def write_cached(content):
        if DATA_CACHE_FILE:
            with open(DATA_CACHE_FILE, 'w', encoding='utf-8') as f:
                f.write(content)

    if is_cached():
        page = read_cached()
    else:
        page = http_get()
        write_cached(page)
    return page

def each_emoji(tree):
    return tree.xpath('//div[@class="main"]/table/tr[td]')

def emoji_info(tr):
    def first(node):
        return ''.join(node[:1])
    def year(s):
        return re.match(r'[0-9]{4}', s).group()
    def code_to_emoji(code):
        return re.sub(r'U\+([0-9A-Z]+) *', lambda m: chr(int(m.groups()[0], 16)), code)
    return {
        'chars': code_to_emoji(first(tr.xpath('td[@class="code"]//text()'))),
        'code': first(tr.xpath('td[@class="code"]//text()')),
        'name': first(tr.xpath('td[@class="name"]/text()')),
        'keywords': tr.xpath('td[@class="name"]/a[@target="annotate"]/text()'),
        'age': year(first(tr.xpath('td[@class="age"]//text()')))
    }

def extract_emojis(emoji_html):
    tree = html.fromstring(emoji_html)
    return [emoji_info(e) for e in each_emoji(tree)]

def all_keywords(emojis):
    return [keyword for emoji in emojis if emoji for keyword in emoji.get('keywords', [])]

def build_index(emojis):
    keyword_freq = {}
    for keyword in [keyword for emoji in emojis for keyword in emoji['keywords']]:
        keyword_freq[keyword] = keyword_freq.get(keyword, 0.0) + 1.0
    p_emoji = 1.0 / len(emojis)

    index = {}
    for (i, emoji) in enumerate(emojis):
        p_keyword_given_emoji = (1.0 / len(emoji['keywords'])) if emoji['keywords'] else 0.0
        for keyword in emoji['keywords']:
            p_keyword = 1.0 / keyword_freq[keyword]
            keywords = index.get(keyword, {})
            keywords[i] = p_keyword_given_emoji * p_emoji / p_keyword
            index[keyword] = keywords
    return index

def search(emojis, index, query):
    results = list(index.get(query, {}).items())
    results.sort(key=lambda r: -r[1])
    return [(p, emojis[int(index)]) for (index, p) in results]

def build_trie(words, current_prefix=''):
    trie = {}
    if any([len(word) == 0 for word in words]):
        trie[None] = current_prefix
    for char in {word[0].lower() for word in words if len(word) > 0}:
        next_words = [word[1:] for word in words if len(word) > 0 and word[0] == char]
        trie[char] = build_trie(next_words, current_prefix + char)
    return trie

def all_values(trie):
    value = trie.get(None)
    subtries = [subtrie for (char, subtrie) in trie.items() if char]
    return ([value] if value else []) \
        + [word for subtrie in subtries for word in all_values(subtrie)]

def prefix_search(emojis, index, trie, query):
    def find_node(trie, query):
        if not query:
            return trie
        return trie and find_node(trie.get(query[0]), query[1:])
    def keywords(trie, query):
        node = find_node(trie, query)
        return all_values(node) if node else []
    return [result for keyword in keywords(trie, query) for result in search(emojis, index, keyword)]


def emoji_description(emoji):
    return emoji['chars'] + ' ' + emoji['name']

def print_prefix_search(query):
    print(query + '|')
    for (p, result) in prefix_search(emojis, index, trie, query):
        print('\t%0.4f\t%s' % (p, emoji_description(result))) 

def save_data(emojis, index):
    data = {
        'emojis': emojis,
        'index': index
    }
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f)

def load_data():
    if isfile(OUTPUT_FILE):
        with open(OUTPUT_FILE, encoding='utf-8') as f:
            return json.load(f)

if __name__ == '__main__':
    from pprint import pprint
    data = load_data()
    if not data:
        emoji_html = fetch_emojis()
        emojis = extract_emojis(emoji_html)
        index = build_index(emojis)
        save_data(emojis, index)
    else:
        emojis = data['emojis']
        index = data['index']
    trie = build_trie(all_keywords(emojis))

    print_prefix_search('smil')
