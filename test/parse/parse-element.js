var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var XMLSerializer = require('xmldom').XMLSerializer;
var parser = new DOMParser();
function elementChildCount(node) {
	var count = 0;
	for (var child = node.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === 1) {
			count++;
		}
	}
	return count;
}
// Create a Test Suite
wows.describe('XML Node Parse').addBatch({
    'noAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml />','text/xml');
    	var dom = new DOMParser().parseFromString('<xml/>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml/>','text/xml');
	},
    'simpleAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2"></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2" ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b=\'\'></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b=\'\' ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2/">','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2" />','text/xml');
    	var dom = new DOMParser().parseFromString('<xml  a="1" b=\'\'/>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml  a="1" b=\'\' />','text/xml');
	},
    'nsAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3"></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3" ></xml>','text/xml');
     	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3/">','text/xml');
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3" />','text/xml');
	}
}).addBatch({
	// see https://github.com/xmldom/xmldom/security/advisories/GHSA-crh6-fp67-6883
	'multiple root elements: only the first one is added to the document': function () {
		var errors = [];
		var doc = new DOMParser({errorHandler: {error: function (msg) { errors.push(msg); }}})
			.parseFromString('<doc/><doc/>', 'text/xml');
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.documentElement.tagName, 'doc');
		assert.ok(/Hierarchy request error/.test(errors.join('\n')), 'reported errors: ' + errors);
		assert.equal(doc.toString(), '<doc/>&lt;doc/>');
	},
	'multiple root elements: nodes inside a second root element are not added to the document': function () {
		var errors = [];
		var doc = new DOMParser({errorHandler: {error: function (msg) { errors.push(msg); }}})
			.parseFromString('<root><a/></root>\n<root><evil/></root>', 'text/xml');
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.getElementsByTagName('root').length, 1);
		assert.equal(doc.getElementsByTagName('a').length, 1);
		assert.equal(doc.getElementsByTagName('evil').length, 0);
		assert.ok(/Hierarchy request error/.test(errors.join('\n')), 'reported errors: ' + errors);
	},
	'doctype after the root element is not added to the document': function () {
		var errors = [];
		var doc = new DOMParser({errorHandler: {error: function (msg) { errors.push(msg); }}})
			.parseFromString('<a/><!DOCTYPE a>', 'text/xml');
		for (var child = doc.firstChild; child; child = child.nextSibling) {
			assert.notEqual(child.nodeType, 10, 'unexpected doctype in ' + doc);
		}
		assert.equal(elementChildCount(doc), 1);
		assert.ok(/Hierarchy request error/.test(errors.join('\n')), 'reported errors: ' + errors);
	},
	'well-formed document with doctype, comments and whitespace around the root element': function () {
		var errors = [];
		var source = '<!DOCTYPE a><!--c--><a/>\n<!--after-->';
		var doc = new DOMParser({errorHandler: {error: function (msg) { errors.push(msg); }}})
			.parseFromString(source, 'text/xml');
		assert.equal(errors.length, 0, 'reported errors: ' + errors);
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.firstChild.nodeType, 10);
		assert.equal(doc.toString(), source);
	}
}).addBatch((function () {
	/**
	 * The XML `ETag` production is `'</' Name S? '>'`: only optional whitespace may follow the `Name`.
	 * A valid `Name` followed by whitespace and non-whitespace residue (e.g. `</a\njunk>` or
	 * `</a junk>`) is not well-formed, but historically it was silently accepted. It is now reported
	 * as a recoverable `error` (in both XML and HTML) while parsing recovers to byte-identical DOM.
	 */
	var TRAILING_CONTENT = /followed by whitespace and trailing content/;
	function collectingParser(errors) {
		function collect(level) {
			return function (msg) {
				(errors[level] = errors[level] || []).push(msg);
			};
		}
		return new DOMParser({
			locator: {},
			errorHandler: {warning: collect('warning'), error: collect('error'), fatalError: collect('fatalError')}
		});
	}
	function reportsTrailingContent(errors) {
		for (var i = 0; errors.error && i < errors.error.length; i++) {
			if (TRAILING_CONTENT.test(errors.error[i])) {
				return true;
			}
		}
		return false;
	}
	var batch = {};
	[
		['a space', ' '],
		['a tab', '\t'],
		['a line feed', '\n'],
		['a carriage return', '\r']
	].forEach(function (testCase) {
		batch['end tag with ' + testCase[0] + ' residue: reports a recoverable error and recovers to byte-identical DOM'] = function () {
			var source = '<a></a' + testCase[1] + 'junk>';

			var cleanXml = new DOMParser().parseFromString('<a></a>', 'text/xml').toString();
			var xmlErrors = {};
			assert.equal(collectingParser(xmlErrors).parseFromString(source, 'text/xml').toString(), cleanXml);
			assert.ok(reportsTrailingContent(xmlErrors), 'reported errors: ' + xmlErrors.error);
			assert.equal(xmlErrors.fatalError, undefined);

			var cleanHtml = new DOMParser().parseFromString('<a></a>', 'text/html').toString();
			var htmlErrors = {};
			assert.equal(collectingParser(htmlErrors).parseFromString(source, 'text/html').toString(), cleanHtml);
			assert.ok(reportsTrailingContent(htmlErrors), 'reported errors: ' + htmlErrors.error);
		};
	});
	batch['end tag with residue after several whitespace characters is reported'] = function () {
		var errors = {};
		collectingParser(errors).parseFromString('<root><a>x</a \r\n\tjunk="1" \n><b/></root>', 'text/xml');
		assert.ok(reportsTrailingContent(errors), 'reported errors: ' + errors.error);
	};
	batch['end tag with residue: an errorHandler.error that throws rejects the document'] = function () {
		var parser = new DOMParser({
			errorHandler: {
				error: function (msg) {
					throw new Error(msg);
				}
			}
		});
		assert['throws'](function () {
			parser.parseFromString('<a></a\njunk>', 'text/xml');
		}, TRAILING_CONTENT);
		assert['throws'](function () {
			parser.parseFromString('<root><a>safe</a\nevil><b/></root>', 'text/xml');
		}, TRAILING_CONTENT);
	};
	batch['does not report a clean end tag with only trailing whitespace'] = function () {
		var errors = {};
		assert.equal(collectingParser(errors).parseFromString('<a></a\r\n>', 'text/xml').toString(), '<a/>');
		assert.equal(errors.error, undefined);
		collectingParser(errors).parseFromString('<a><b></b \t\r\n></a >', 'text/xml');
		assert.equal(errors.error, undefined);
	};
	batch['does not report the new error for an end tag that is maybe not complete'] = function () {
		var errors = {};
		collectingParser(errors).parseFromString('<xml><inner></inner </xml>', 'text/xml');
		assert.ok(/maybe not complete/.test(errors.error), 'reported errors: ' + errors.error);
		assert.ok(!reportsTrailingContent(errors), 'reported errors: ' + errors.error);
	};
	return batch;
})()).run();