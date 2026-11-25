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
}).run();