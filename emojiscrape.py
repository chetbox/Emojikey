#!/usr/bin/env python3

from lxml import html
import requests
from os.path import isfile
import re
import json
from math import sqrt, log
from numpy import dot
from numpy.linalg import norm

DATA_CACHE_FILE = 'data/full-emoji-list.html'
OUTPUT_FILE = 'config_resources/emoji-data.json'
STOP_WORDS = {'with', 'of', 'on', 'the'}

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

def tf_idf(term, docs, doc, term_in_doc_freqs, docs_with_term_freqs):
    """Based on Elasticsearch scoring model:
    https://www.elastic.co/guide/en/elasticsearch/guide/current/scoring-theory.html"""
    tf = sqrt(term_in_doc_freqs.get(term, 0))
    idf = 0.01 + log(len(docs) / (docs_with_term_freqs.get(term, 0) + 0.01))
    norm = 1.0 / sqrt(len(doc))
    return tf * idf * norm

def document_vector(doc, terms, docs, term_in_doc_freqs, docs_with_term_freqs):
    return [tf_idf(term, docs, doc, term_in_doc_freqs, docs_with_term_freqs) for term in terms]

def cosine_similarity(a, b):
    return dot(a, b) / norm(a) / norm(b)

def build_trie(words, current_prefix=''):
    trie = {}
    if any([len(word) == 0 for word in words]):
        trie[None] = current_prefix
    for char in {word[0].lower() for word in words if len(word) > 0}:
        next_words = [word[1:] for word in words if len(word) > 0 and word[0] == char]
        trie[char] = build_trie(next_words, current_prefix + char)
    return trie

def prefix_search(emojis, index, trie, query):
    def all_values(trie):
        value = trie.get(None)
        subtries = [subtrie for (char, subtrie) in trie.items() if char]
        return ([value] if value else []) \
            + [word for subtrie in subtries for word in all_values(subtrie)]
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

def save_data(file, data):
    with open(file, 'w', encoding='utf-8') as f:
        json.dump(data, f)

def load_data(file):
    if isfile(file):
        with open(OUTPUT_FILE, encoding='utf-8') as f:
            return json.load(f)

def search(query, unique_terms, docs, docs_with_term_freqs, document_vectors, emojis):
    # TODO: prefix search
    query_terms = re.split(r'[\s\-_\.]+', query.lower())
    query_vector = document_vector(query_terms, unique_terms, docs, frequencies(query_terms), docs_with_term_freqs)
    results = [(cosine_similarity(query_vector, v), i) for i, v in enumerate(document_vectors)]
    results = [(score, i) for score, i in results if score] # filter out zeros
    results.sort(key=lambda r: -r[0])
    return results

def build_db():
    emoji_html = fetch_emojis()
    db = {}
    db['emojis'] = \
        extract_emojis(emoji_html)
    db['docs'] = \
        [remove_stopwords(terms(e)) for e in db['emojis']]
    db['unique_terms'] = \
        unique([term for doc in db['docs'] for term in doc])
    db['docs_with_term_freqs'] = \
        {term:len(documents_containing(term, db['docs'])) for term in db['unique_terms']}
    db['document_vectors'] = \
        [document_vector(doc, db['unique_terms'], db['docs'], frequencies(doc), db['docs_with_term_freqs']) for doc in db['docs']]
    # db['trie'] = \
    #     build_trie(['unique_terms'])
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
    db = load_data(OUTPUT_FILE)
    if not db:
        db = build_db()
        save_data(OUTPUT_FILE, db)

    def search_and_print_results(query):
        for score, index in search(query, **db)[:5]:
            print('\t%f -> %s' % (score, emoji_description(db['emojis'][index])))

    repl(search_and_print_results)
