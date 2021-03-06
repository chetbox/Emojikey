#!/usr/bin/env python3

from lxml import html
import requests
from os.path import isfile, abspath, dirname, isdir
from os import makedirs
import re
import json
from math import sqrt, log, pow
from numpy import dot
from numpy.linalg import norm
import time

DATA_CACHE_FILE = abspath('./data/full-emoji-list.html')
OUTPUT_FILE = abspath('./extension/config_resources/emoji-data.json')
STOP_WORDS = {'with', 'of', 'on', 'the'}
MODIFIERS = {
    'fitzpatrick': ['\U0001f3fb', '\U0001f3fc', '\U0001f3fd', '\U0001f3fe', '\U0001f3ff']
}
MODIFIERS_INDEX = {modifier:mtype for mtype, modifiers in MODIFIERS.items() for modifier in modifiers}

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
            if not isdir(dirname(DATA_CACHE_FILE)):
                makedirs(dirname(DATA_CACHE_FILE))
            with open(DATA_CACHE_FILE, 'w', encoding='utf-8') as f:
                f.write(str(content))

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
    info = {
        'chars': code_to_emoji(first(tr.xpath('td[@class="code"]//text()'))),
        'code': first(tr.xpath('td[@class="code"]//text()')),
        'name': first(tr.xpath('td[@class="name"]/text()')),
        'keywords': tr.xpath('td[@class="name"]/a[@target="annotate"]/text()'),
        'age': year(first(tr.xpath('td[@class="age"]//text()')))
    }
    while len(info['chars']) > 1 and MODIFIERS_INDEX.get(info['chars'][-1], False):
        info['modifiers'] = info.get('modifiers', '') + info['chars'][-1]
        info['chars'] = info['chars'][:-1]
    return info

def extract_emojis(emoji_html):
    tree = html.fromstring(emoji_html)
    return [emoji_info(e) for e in each_emoji(tree)]

def terms(emoji):
    return re.split(r'[ \-]+', emoji['name'].lower()) + emoji['keywords']

def unique(terms):
    return list(set(terms))

def remove_stopwords(terms):
    return [term for term in terms if term not in STOP_WORDS]

def frequencies(terms):
    term_freqs = {}
    for term in terms:
        term_freqs[term] = term_freqs.get(term, 0) + 1
    return term_freqs

def documents_containing(term, docs):
    return [doc for doc in docs if term in doc]

def tf_idf(term, n_docs, doc_length, term_in_doc_freqs, n_docs_with_term):
    """Based on Elasticsearch scoring model:
    https://www.elastic.co/guide/en/elasticsearch/guide/current/scoring-theory.html"""
    tf = sqrt(term_in_doc_freqs.get(term, 0))
    idf = 0.01 + log(n_docs / (n_docs_with_term.get(term, 0) + 0.01))
    norm = 1.0 / sqrt(doc_length)
    return tf * idf * norm

def document_vector(doc_length, all_terms, n_docs, term_in_doc_freqs, n_docs_with_term):
    return [tf_idf(term, n_docs, doc_length, term_in_doc_freqs, n_docs_with_term) for term in all_terms]

def cosine_similarity(a, b):
    return dot(a, b) / norm(a) / norm(b)

def build_trie(words, current_prefix=''):
    trie = {}
    if any([len(word) == 0 for word in words]):
        trie[''] = current_prefix
    for char in {word[0].lower() for word in words if len(word) > 0}:
        next_words = [word[1:] for word in words if len(word) > 0 and word[0] == char]
        trie[char] = build_trie(next_words, current_prefix + char)
    return trie

def prefix_search(trie, query):
    def all_values(trie):
        value = trie.get('')
        subtries = [subtrie for (char, subtrie) in trie.items() if char]
        return ([value] if value else []) \
            + [word for subtrie in subtries for word in all_values(subtrie)]
    def find_node(trie, query):
        if not query:
            return trie
        return trie and find_node(trie.get(query[0]), query[1:])
    node = find_node(trie, query)
    return all_values(node) if node else []

def emoji_description(emoji):
    return emoji['chars'] + ' ' + emoji['name']

def save_data(file, data):
    with open(file, 'w', encoding='utf-8') as f:
        json.dump(data, f)

def load_data(file):
    if not isdir(dirname(file)):
        makedirs(dirname(file))
    if isfile(file):
        with open(file, 'r', encoding='utf-8') as f:
            return json.load(f)

def search(query_str, unique_terms, n_docs_with_term, document_vectors, trie, emojis, index):
    query_terms = re.split(r'[\s\-_\.]+', query_str.lower())
    query = {}
    for term in query_terms:
        for prefix_match in prefix_search(trie, term):
            query[prefix_match] = max(query.get(prefix_match, 0.0), pow(1.0 / (len(prefix_match) - len(term) + 1), 2))
    query_vector = document_vector(len(query.keys()), unique_terms, len(document_vectors), query, n_docs_with_term)
    matching_document_vectors = {doc_index:document_vectors[doc_index] for term in query.keys() for doc_index in index[term]}
    results = [(cosine_similarity(query_vector, v), i) for i, v in matching_document_vectors.items()]
    results = [(score, i) for score, i in results if score] # filter out zeros
    results.sort(key=lambda r: -r[0])
    return results

def build_db():
    emoji_html = fetch_emojis()
    db = {}
    db['emojis'] = \
        [emoji for emoji in extract_emojis(emoji_html) if not emoji.get('modifiers', False)]
    docs = [remove_stopwords(terms(e)) for e in db['emojis']]
    db['unique_terms'] = \
        unique([term for doc in docs for term in doc])
    db['index'] = \
        {term:[i for i, doc in enumerate(docs) if term in doc] for term in db['unique_terms']}
    db['n_docs_with_term'] = \
        {term:len(documents_containing(term, docs)) for term in db['unique_terms']}
    db['document_vectors'] = \
        [document_vector(len(doc), db['unique_terms'], len(docs), frequencies(doc), db['n_docs_with_term']) for doc in docs]
    db['trie'] = \
        build_trie(db['unique_terms'])
    return db

def repl(fn):
    try:
        while True:
            query = input('> ')
            fn(query)
    except EOFError:
        print('')
    except KeyboardInterrupt:
        print('')

if __name__ == '__main__':
    from argparse import ArgumentParser
    parser = ArgumentParser(description='Fetch emoji information and make it searchable')
    parser.add_argument('--repl', action='store_const', const='repl', default=False, help='Run a REPL to search for emoji on the console')
    args = parser.parse_args()

    db = load_data(OUTPUT_FILE)
    if not db:
        db = build_db()
        save_data(OUTPUT_FILE, db)

    if args.repl:
        def search_and_print_results(query):
            for score, index in search(query, **db)[:5]:
                print('\t%f -> %s' % (score, emoji_description(db['emojis'][index])))
        repl(search_and_print_results)
