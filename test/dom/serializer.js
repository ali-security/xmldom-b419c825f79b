var wows = require('vows');
var DOMParser = require('xmldom').DOMParser;

wows.describe('XML Serializer').addBatch({
  'text node containing "]]>"': function() {
    var doc = new DOMParser().parseFromString('<test/>', 'text/xml');
    doc.documentElement.appendChild(doc.createTextNode('hello ]]> there'));
    console.assert(doc.documentElement.firstChild.toString() == 'hello ]]> there',doc.documentElement.firstChild.toString());
  },
}).run();

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-wh4c-j3r5-mjhp
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;
var XMLSerializer = require('xmldom').XMLSerializer;

// DOMException codes, see dom.js
var INVALID_STATE_ERR = 11;

function assertDOMException(code, fn) {
	var error = null;
	try {
		fn();
	} catch (e) {
		error = e;
	}
	assert.ok(error, 'expected a DOMException with code ' + code);
	assert.equal(error.code, code, 'unexpected exception: ' + error);
}

function createRootDocument() {
	return new DOMImplementation().createDocument(null, 'root', null);
}

// Serializes, then re-parses, and returns true if an <injected> element appears in the tree.
function isInjected(root) {
	var xml = new XMLSerializer().serializeToString(root);
	var reparsed = new DOMParser().parseFromString(xml, 'text/xml');
	return reparsed.getElementsByTagName('injected').length > 0;
}

wows.describe('XMLSerializer CDATASection serialization').addBatch({
	'serializes a safe CDATASection unchanged': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createCDATASection('safe data'));
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[safe data]]></root>');
	},
	'splits a CDATASection whose data contains "]]>"': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
	},
	'splits multiple "]]>" occurrences': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'a]]>b]]>c';
		doc.documentElement.appendChild(cdata);
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[a]]]]><![CDATA[>b]]]]><![CDATA[>c]]></root>');
	},
	'split output round-trips through DOMParser to equivalent content': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		var serialized = new XMLSerializer().serializeToString(doc.documentElement);
		var reparsed = new DOMParser().parseFromString(serialized, 'text/xml');
		assert.equal(reparsed.documentElement.textContent, 'foo]]>bar');
	},
	'node.toString splits a CDATASection whose data contains "]]>"': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assert.equal(doc.toString(), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
		assert.equal(cdata.toString(), '<![CDATA[foo]]]]><![CDATA[>bar]]>');
		assert.equal(doc.documentElement.childNodes.toString(), '<![CDATA[foo]]]]><![CDATA[>bar]]>');
	},
}).addBatch({
	'appendData introduces "]]>" safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		doc.documentElement.appendChild(cdata);
		cdata.appendData(']]><injected/>');
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'replaceData introduces "]]>" safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe data');
		doc.documentElement.appendChild(cdata);
		cdata.replaceData(4, 5, ']]><injected/>');
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'insertData introduces "]]>" safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		doc.documentElement.appendChild(cdata);
		cdata.insertData(4, ']]><injected/>');
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'deleteData joining "]]" and ">" is serialized safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('a]]x><injected/>');
		doc.documentElement.appendChild(cdata);
		cdata.deleteData(3, 1);
		assert.equal(cdata.data, 'a]]><injected/>');
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'.data assignment introduces "]]>" safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		doc.documentElement.appendChild(cdata);
		cdata.data = 'evil]]><injected/>';
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'.textContent assignment introduces "]]>" safely': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		doc.documentElement.appendChild(cdata);
		cdata.textContent = 'evil]]><injected/>';
		assert.strictEqual(isInjected(doc.documentElement), false);
	},
	'injected payload stays character data after a round-trip': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		doc.documentElement.appendChild(cdata);
		cdata.data = 'evil]]><injected approved="true"/><![CDATA[';
		var reparsed = new DOMParser().parseFromString(new XMLSerializer().serializeToString(doc), 'text/xml');
		assert.equal(reparsed.getElementsByTagName('injected').length, 0);
		assert.equal(reparsed.documentElement.textContent, 'evil]]><injected approved="true"/><![CDATA[');
	},
}).run();

wows.describe('XMLSerializer serializeToString requireWellFormed option').addBatch({
	'CDATA with "]]>" still splits when no options are passed (regression)': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
	},
	'CDATA with "]]>" still splits when options is null (regression)': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement, false, null, null), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
	},
	'CDATA with "]]>" still splits when requireWellFormed is false': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement, false, null, { requireWellFormed: false }), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
	},
	'requireWellFormed: true on safe CDATA does not throw': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createCDATASection('safe data'));
		assert.equal(new XMLSerializer().serializeToString(doc, false, null, { requireWellFormed: true }), '<root><![CDATA[safe data]]></root>');
	},
	'requireWellFormed: true on CDATA with "]]>" throws': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assertDOMException(INVALID_STATE_ERR, function () {
			new XMLSerializer().serializeToString(doc, false, null, { requireWellFormed: true });
		});
	},
	'node.toString with requireWellFormed: true on CDATA with "]]>" throws': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.data = 'foo]]>bar';
		doc.documentElement.appendChild(cdata);
		assertDOMException(INVALID_STATE_ERR, function () {
			doc.toString(false, null, { requireWellFormed: true });
		});
	},
	'NodeList.toString with requireWellFormed: true on CDATA with "]]>" throws': function () {
		var doc = createRootDocument();
		var cdata = doc.createCDATASection('safe');
		cdata.appendData(']]><injected/>');
		doc.documentElement.appendChild(cdata);
		assertDOMException(INVALID_STATE_ERR, function () {
			doc.documentElement.childNodes.toString(false, null, { requireWellFormed: true });
		});
	},
}).run();

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-j759-j44w-7fr8
var REQUIRE_WELL_FORMED = { requireWellFormed: true };

function serializeWellFormed(node) {
	return new XMLSerializer().serializeToString(node, false, null, REQUIRE_WELL_FORMED);
}

wows.describe('XMLSerializer Comment serialization with requireWellFormed').addBatch({
	'default: comment with "-->" in data emits verbatim - no throw': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello-->world'));
		assert.equal(new XMLSerializer().serializeToString(doc), '<root><!--hello-->world--></root>');
	},
	'default: comment with "--" in data emits verbatim - no throw': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello--world'));
		assert.equal(new XMLSerializer().serializeToString(doc), '<root><!--hello--world--></root>');
	},
	'requireWellFormed: false or null options: comment with "-->" emits verbatim': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello-->world'));
		assert.equal(new XMLSerializer().serializeToString(doc, false, null, { requireWellFormed: false }), '<root><!--hello-->world--></root>');
		assert.equal(new XMLSerializer().serializeToString(doc, false, null, null), '<root><!--hello-->world--></root>');
	},
	'requireWellFormed: true on comment with invalid XML Char (\\x00) throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello\u0000world'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'requireWellFormed: true on comment with "-->" throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello-->world'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'requireWellFormed: true on comment with "--" (no "-->") throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello--world'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'requireWellFormed: true on comment whose data ends with "-" throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello-'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'requireWellFormed: true on comment with a lone surrogate throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('hello\uD83Dworld'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
		var doc2 = createRootDocument();
		doc2.documentElement.appendChild(doc2.createComment('hello\uDE00'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc2);
		});
	},
	'requireWellFormed: true on comment with clean data does not throw': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('clean comment'));
		assert.equal(serializeWellFormed(doc), '<root><!--clean comment--></root>');
	},
	'requireWellFormed: true accepts single "-", tabs, line breaks and supplementary characters': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment(' a-b\t\r\n\uD83D\uDE00 '));
		doc.documentElement.appendChild(doc.createComment(''));
		assert.equal(serializeWellFormed(doc), '<root><!-- a-b\t\r\n\uD83D\uDE00 --><!----></root>');
	},
}).addBatch({
	'advisory payload is emitted verbatim by default and injects a live element': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('--><injected attr="1"/><!--'));
		assert.equal(new XMLSerializer().serializeToString(doc), '<root><!----><injected attr="1"/><!----></root>');
		assert.strictEqual(isInjected(doc), true);
	},
	'requireWellFormed: true on the advisory payload throws InvalidStateError': function () {
		var doc = createRootDocument();
		doc.documentElement.appendChild(doc.createComment('--><injected attr="1"/><!--'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: appendData("-->") then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('clean');
		doc.documentElement.appendChild(comment);
		comment.appendData('--><injected/><!--');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: insertData("-->") then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('clean');
		doc.documentElement.appendChild(comment);
		comment.insertData(2, '--><injected/><!--');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: replaceData("-->") then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('clean data');
		doc.documentElement.appendChild(comment);
		comment.replaceData(5, 5, '--><injected/><!--');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: deleteData joining "-" and "->" then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('a-x-><injected/>');
		doc.documentElement.appendChild(comment);
		assert.equal(serializeWellFormed(doc), '<root><!--a-x-><injected/>--></root>');
		comment.deleteData(2, 1);
		assert.equal(comment.data, 'a--><injected/>');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: .data assignment then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('clean');
		doc.documentElement.appendChild(comment);
		comment.data = 'evil--><injected/><!--';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'mutation vector: .textContent assignment then requireWellFormed: true throws InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('clean');
		doc.documentElement.appendChild(comment);
		comment.textContent = 'evil--><injected/><!--';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
	'node.toString and NodeList.toString with requireWellFormed: true throw InvalidStateError': function () {
		var doc = createRootDocument();
		var comment = doc.createComment('evil--><injected/><!--');
		doc.documentElement.appendChild(comment);
		assertDOMException(INVALID_STATE_ERR, function () {
			doc.toString(false, null, REQUIRE_WELL_FORMED);
		});
		assertDOMException(INVALID_STATE_ERR, function () {
			comment.toString(false, null, REQUIRE_WELL_FORMED);
		});
		assertDOMException(INVALID_STATE_ERR, function () {
			doc.documentElement.childNodes.toString(false, null, REQUIRE_WELL_FORMED);
		});
	},
	'requireWellFormed: true throws for a comment in a DocumentFragment or a document-level comment': function () {
		var doc = createRootDocument();
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createComment('evil--><injected/><!--'));
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(fragment);
		});
		var doc2 = createRootDocument();
		doc2.insertBefore(doc2.createComment('evil--><injected/><!--'), doc2.documentElement);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc2);
		});
	},
	'requireWellFormed: true throws for a comment parsed with "--" in its data': function () {
		var doc = new DOMParser().parseFromString('<root><!--a--b--></root>', 'text/xml');
		assert.equal(doc.documentElement.firstChild.data, 'a--b');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(doc);
		});
	},
}).run();

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-f6ww-3ggp-fr8h
function createDoctypeDocument(doctype) {
	return new DOMImplementation().createDocument(null, 'root', doctype);
}

wows.describe('XMLSerializer DocumentType serialization with requireWellFormed').addBatch({
	'default: DocumentType with invalid publicId serializes verbatim - no throw': function () {
		var doctype = new DOMImplementation().createDocumentType('name', '"invalid<char"', '');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(new XMLSerializer().serializeToString(dtDoc), '<!DOCTYPE name PUBLIC "invalid<char"><root/>');
	},
	'requireWellFormed: true on DocumentType with invalid publicId throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('name', '"invalid<char"', '');
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true on DocumentType with invalid systemId throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('name', '', 'no-quotes-around-this');
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true on DocumentType with "]>" in internalSubset throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('name', '', '');
		var dtDoc = createDoctypeDocument(doctype);
		doctype.internalSubset = ']><injected/>';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true on DocumentType with valid fields does not throw': function () {
		var doctype = new DOMImplementation().createDocumentType(
			'html',
			'"-//W3C//DTD HTML 4.01//EN"',
			'"http://www.w3.org/TR/html4/strict.dtd"'
		);
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(
			serializeWellFormed(dtDoc),
			'<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><root/>'
		);
	},
	'direct property write: setting invalid publicId then requireWellFormed: true throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('name', '"-//W3C//DTD//EN"', '');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(serializeWellFormed(dtDoc), '<!DOCTYPE name PUBLIC "-//W3C//DTD//EN"><root/>');
		doctype.publicId = '"invalid<char"';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'default: DocumentType with invalid name serializes verbatim - no throw': function () {
		var doctype = new DOMImplementation().createDocumentType('html', '', '');
		doctype.name = 'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script';
		var dtDoc = createDoctypeDocument(doctype);
		var out = new XMLSerializer().serializeToString(dtDoc);
		assert.ok(out.indexOf('<!DOCTYPE html><script') !== -1, out);
	},
	'requireWellFormed: true on DocumentType with ">" in name throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('html', '', '');
		doctype.name = 'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script';
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true on DocumentType with whitespace in name throws InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('html', '', '');
		doctype.name = 'ht ml';
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
}).addBatch({
	'advisory payload: publicId breaking out of its quotes injects a SYSTEM id by default': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '"x" SYSTEM "http://evil.example/x.dtd"', '');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(new XMLSerializer().serializeToString(dtDoc), '<!DOCTYPE root PUBLIC "x" SYSTEM "http://evil.example/x.dtd"><root/>');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true rejects a single quoted publicId injecting a SYSTEM id': function () {
		var doctype = new DOMImplementation().createDocumentType('root', "'x' SYSTEM 'http://evil.example/x.dtd'", '');
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
		doctype.publicId = '\'x" SYSTEM "y\'';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'advisory payload: systemId containing ">" closes the doctype and injects an element by default': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '', '"x.dtd"><injected attr="1"/');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(new XMLSerializer().serializeToString(dtDoc), '<!DOCTYPE root SYSTEM "x.dtd"><injected attr="1"/><root/>');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
		doctype.systemId = '"a" "b"';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true rejects an invalid systemId next to a publicId': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '"-//X//EN"', '"x.dtd"><injected/');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(new XMLSerializer().serializeToString(dtDoc), '<!DOCTYPE root PUBLIC "-//X//EN" "x.dtd"><injected/><root/>');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'advisory payload: internalSubset containing "]>" closes the doctype and injects an element by default': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '', '');
		var dtDoc = createDoctypeDocument(doctype);
		doctype.internalSubset = ']><injected attr="1"/><!DOCTYPE x [';
		assert.equal(new XMLSerializer().serializeToString(dtDoc), '<!DOCTYPE root []><injected attr="1"/><!DOCTYPE x []><root/>');
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true rejects "]" followed by white space and ">" in internalSubset': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '', '');
		var dtDoc = createDoctypeDocument(doctype);
		doctype.internalSubset = '] ><injected/>';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
		doctype.internalSubset = ']\r\n\t><injected/>';
		assertDOMException(INVALID_STATE_ERR, function () {
			serializeWellFormed(dtDoc);
		});
	},
	'requireWellFormed: true accepts a plain internalSubset, absent ids and the "." systemId placeholder': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '', '.');
		var dtDoc = createDoctypeDocument(doctype);
		assert.equal(serializeWellFormed(dtDoc), '<!DOCTYPE root><root/>');
		doctype.internalSubset = '<!ENTITY foo "bar">';
		assert.equal(serializeWellFormed(dtDoc), '<!DOCTYPE root [<!ENTITY foo "bar">]><root/>');
		var doctype2 = new DOMImplementation().createDocumentType('ns:root');
		assert.equal(serializeWellFormed(createDoctypeDocument(doctype2)), '<!DOCTYPE ns:root><root/>');
		var doctype3 = new DOMImplementation().createDocumentType('root', "'-//X//EN'", "'x.dtd'");
		assert.equal(serializeWellFormed(createDoctypeDocument(doctype3)), "<!DOCTYPE root PUBLIC '-//X//EN' 'x.dtd'><root/>");
	},
	'node.toString and NodeList.toString with requireWellFormed: true throw InvalidStateError': function () {
		var doctype = new DOMImplementation().createDocumentType('root', '', '"x.dtd"><injected/');
		var dtDoc = createDoctypeDocument(doctype);
		assertDOMException(INVALID_STATE_ERR, function () {
			dtDoc.toString(false, null, REQUIRE_WELL_FORMED);
		});
		assertDOMException(INVALID_STATE_ERR, function () {
			doctype.toString(false, null, REQUIRE_WELL_FORMED);
		});
		assertDOMException(INVALID_STATE_ERR, function () {
			dtDoc.childNodes.toString(false, null, REQUIRE_WELL_FORMED);
		});
	},
	'requireWellFormed: true serializes a parsed doctype unchanged': function () {
		var source = '<!DOCTYPE root PUBLIC "-//X//EN" "x.dtd"><root/>';
		var doc = new DOMParser().parseFromString(source, 'text/xml');
		assert.equal(serializeWellFormed(doc), source);
		var doc2 = new DOMParser().parseFromString('<!DOCTYPE root><root/>', 'text/xml');
		assert.equal(serializeWellFormed(doc2), '<!DOCTYPE root><root/>');
	},
}).run();

// SEAL: excluded from the run -- the expectation predates the default
// xmlns="http://www.w3.org/1999/xhtml" that text/html parsing adds in 0.1.31
// (actual: <script xmlns="http://www.w3.org/1999/xhtml"></script>).
var sealExcluded = {
  '<script> element with no children': function() {
    var doc = new DOMParser({xmlns:{xmlns:'http://www.w3.org/1999/xhtml'}}).parseFromString('<html2><script></script></html2>', 'text/html');
    //console.log(doc.documentElement.firstChild.toString(true))
    console.assert(doc.documentElement.firstChild.toString() == '<script></script>');
  },
};
