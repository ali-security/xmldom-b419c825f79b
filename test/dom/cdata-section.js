var wows = require('vows');
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;
var DOMParser = require('xmldom').DOMParser;

// DOMException codes, see dom.js
var INVALID_CHARACTER_ERR = 5;

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

function createDocument() {
	return new DOMImplementation().createDocument(null, 'xml');
}

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-wh4c-j3r5-mjhp
wows.describe('Document.prototype.createCDATASection').addBatch({
	'throws InvalidCharacterError when data is exactly "]]>"': function () {
		var doc = createDocument();
		assertDOMException(INVALID_CHARACTER_ERR, function () {
			doc.createCDATASection(']]>');
		});
	},
	'throws InvalidCharacterError when data starts with safe content then contains "]]>"': function () {
		var doc = createDocument();
		assertDOMException(INVALID_CHARACTER_ERR, function () {
			doc.createCDATASection('safe]]>data');
		});
	},
	'throws InvalidCharacterError when data contains multiple "]]>" occurrences': function () {
		var doc = createDocument();
		assertDOMException(INVALID_CHARACTER_ERR, function () {
			doc.createCDATASection('before]]>after]]>after');
		});
	},
	'throws InvalidCharacterError for an injection payload and creates no node': function () {
		var doc = createDocument();
		assertDOMException(INVALID_CHARACTER_ERR, function () {
			doc.documentElement.appendChild(doc.createCDATASection('x]]><injected/><![CDATA[y'));
		});
		assert.strictEqual(doc.documentElement.firstChild, null);
		assert.equal(doc.toString(), '<xml/>');
	},
	'does not throw when data is safe': function () {
		var doc = createDocument();
		var cdata = doc.createCDATASection('safe');
		assert.equal(cdata.nodeType, 4);
		assert.equal(cdata.data, 'safe');
	},
	'does not throw when data contains "]]" or ">" but not "]]>"': function () {
		var doc = createDocument();
		var cdata = doc.createCDATASection('a]]b>c]');
		assert.equal(cdata.data, 'a]]b>c]');
	},
	'does not throw when data is empty string': function () {
		var doc = createDocument();
		var cdata = doc.createCDATASection('');
		assert.equal(cdata.data, '');
	},
	'parsing XML containing a CDATA section does not throw': function () {
		var doc = new DOMParser().parseFromString('<root><![CDATA[some data]]></root>', 'text/xml');
		assert.equal(doc.documentElement.firstChild.nodeType, 4);
		assert.equal(doc.documentElement.firstChild.data, 'some data');
		assert.equal(doc.toString(), '<root><![CDATA[some data]]></root>');
	},
}).run();
