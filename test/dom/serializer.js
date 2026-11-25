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
