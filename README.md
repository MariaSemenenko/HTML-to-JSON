
## Converter output

`html2json(htmlText)` returns a document node with `tag: "#document"`, an empty `attributes` object, and a `children` array. Element nodes contain `tag`, `attributes`, and `children`; text nodes contain `text`; comments contain `comment`. This keeps sibling order and repeated elements while handling fragments, common entities, void elements, quoted attributes, comments, and raw-text elements without using a DOM parser. Invalid or non-string input is normalized to a string (nullish input becomes an empty document).

The HTML samples in `html_samples/` cover a full document, fragments, nested elements, attributes, entities, comments, void tags, and raw text.
