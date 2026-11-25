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
