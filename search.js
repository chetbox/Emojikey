function dot(a,b) {
 var n = 0, lim = Math.min(a.length,b.length);
 for (var i = 0; i < lim; i++) n += a[i] * b[i];
 return n;
}

function norm(a) {
	return Math.sqrt(dot(a, a));
}

function tf_idf(term, n_docs, doc_length, term_in_doc_freqs, n_docs_with_term) {
	var tf = Math.sqrt(term_in_doc_freqs[term] || 0);
	var idf = 0.01 + Math.log(n_docs / ((n_docs_with_term[term] || 0) + 0.01));
	var norm = 1.0 / Math.sqrt(doc_length);
  return tf * idf * norm;
}

function document_vector(doc_length, all_terms, n_docs, term_in_doc_freqs, n_docs_with_term) {
	return all_terms.map(
		(term) => tf_idf(term, n_docs, doc_length, term_in_doc_freqs, n_docs_with_term)
	);
}

function cosine_similarity(a, b) {
	return dot(a, b) / norm(a) / norm(b);
}

// TODO: implement prefix search
function prefix_search(trie, query) {
	return [query];
}

function search(query_str, db) {
	var query = {};
	query_str
	.toLowerCase()
	.split(/[\s\-_\.]+/)
	.forEach((term) => {
		prefix_search(db.trie, term).forEach((prefix_match) => {
			query[prefix_match] = Math.max((query[prefix_match] || 0), Math.pow(term.length / prefix_match.length, 5));
		});
	});
	var query_vector = document_vector(Object.keys(query).length, db.unique_terms, db.document_vectors.length, query, db.n_docs_with_term);

	var matching_document_vectors = {};
	$.each(query, (term) => {
		var matching_documents = db.index[term];
		if (matching_documents) {
			matching_documents.forEach((doc_index) => {
				matching_document_vectors[doc_index] = db.document_vectors[doc_index];
			});
		}
	})

	var results = [];
	$.each(matching_document_vectors, (doc_index, document_vector) => {
		var similarity = cosine_similarity(query_vector, document_vector);
		if (similarity) {
			results.push([similarity, doc_index]);
		}
	});
	results.sort((a, b) => b[0] - a[0]);
	return results.map(
		([score, index]) => ({
			score: score,
			chars: db.emojis[index].chars
		})
	);
}
