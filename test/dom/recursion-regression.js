var wows = require('vows');
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;
var DOMParser = require('xmldom').DOMParser;
var XMLSerializer = require('xmldom').XMLSerializer;
var walkDOM = require('xmldom/dom').walkDOM;

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-2v35-w6hq-6mfw

// Must exceed the depth at which a recursive tree walk overflows the default call stack,
// so that re-introducing any recursive tree walk makes these tests fail.
var DEEP_TREE_DEPTH = 100000;

function repeat(str, count) {
	return new Array(count + 1).join(str);
}

// The XML of a <root> holding DEEP_TREE_DEPTH nested <n> elements, the deepest with an id and a text child.
var DEEP_XML = '<root>' + repeat('<n>', DEEP_TREE_DEPTH - 1) + '<n id="deepest">x</n>' + repeat('</n>', DEEP_TREE_DEPTH - 1) + '</root>';

function createDeepDocument() {
	var doc = new DOMImplementation().createDocument(null, 'root', null);
	var current = doc.documentElement;
	for (var i = 0; i < DEEP_TREE_DEPTH; i++) {
		var child = doc.createElement('n');
		current.appendChild(child);
		current = child;
	}
	current.setAttribute('id', 'deepest');
	current.appendChild(doc.createTextNode('x'));
	return doc;
}

var sharedDeepDocument = null;
// a deep document for the tests that do not modify it
function deepDocument() {
	if (!sharedDeepDocument) {
		sharedDeepDocument = createDeepDocument();
	}
	return sharedDeepDocument;
}

// follows the first element child down, returns the number of levels and the last element
function descend(node) {
	var depth = 0;
	while (node.firstChild && node.firstChild.nodeType === 1) {
		node = node.firstChild;
		depth++;
	}
	return { depth: depth, deepest: node };
}

wows.describe('deep tree stack overflow guard (GHSA-2v35-w6hq-6mfw)').addBatch({
	'a recursive function overflows within DEEP_TREE_DEPTH frames': function () {
		var depth = 0;
		function recurse() {
			depth++;
			recurse();
		}
		try {
			recurse();
		} catch (e) {
			// stack exhausted
		}
		assert.ok(depth < DEEP_TREE_DEPTH, 'recursion reached ' + depth + ' frames');
	},
}).addBatch({
	'DOMParser.parseFromString on a deeply nested document does not throw RangeError': function () {
		var doc = new DOMParser().parseFromString(DEEP_XML, 'text/xml');
		var result = descend(doc.documentElement);
		assert.equal(result.depth, DEEP_TREE_DEPTH);
		assert.equal(result.deepest.getAttribute('id'), 'deepest');
		assert.equal(result.deepest.firstChild.data, 'x');
		assert.equal(doc.toString(), DEEP_XML);
		assert.equal(doc.documentElement.textContent, 'x');
	},
	'walkDOM visits every node of a deep tree': function () {
		var count = 0;
		walkDOM(deepDocument().documentElement, null, {
			enter: function () {
				count++;
				return true;
			}
		});
		// root, DEEP_TREE_DEPTH <n> elements and the text node
		assert.equal(count, DEEP_TREE_DEPTH + 2);
	},
	'getElementsByTagName on a deep tree does not throw RangeError': function () {
		var doc = deepDocument();
		assert.equal(doc.getElementsByTagName('n').length, DEEP_TREE_DEPTH);
		assert.equal(doc.documentElement.getElementsByTagName('*').length, DEEP_TREE_DEPTH);
	},
	'getElementsByTagNameNS on a deep tree does not throw RangeError': function () {
		// elements made by createElement have no localName, so match any name
		assert.equal(deepDocument().documentElement.getElementsByTagNameNS('*', '*').length, DEEP_TREE_DEPTH);
	},
	'getElementById on a deep tree does not throw RangeError': function () {
		var doc = deepDocument();
		var deepest = doc.getElementById('deepest');
		assert.ok(deepest);
		assert.strictEqual(deepest, descend(doc.documentElement).deepest);
	},
	'textContent on a deep tree does not throw RangeError': function () {
		assert.equal(deepDocument().documentElement.textContent, 'x');
	},
	'XMLSerializer.serializeToString on a deep tree does not throw RangeError': function () {
		var doc = deepDocument();
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement), DEEP_XML);
		assert.equal(new XMLSerializer().serializeToString(doc), DEEP_XML);
	},
	'XMLSerializer.serializeToString with a nodeFilter on a deep tree does not throw RangeError': function () {
		var calls = 0;
		var xml = new XMLSerializer().serializeToString(deepDocument().documentElement, false, function (node) {
			calls++;
			return node;
		});
		assert.equal(xml, DEEP_XML);
		// root, DEEP_TREE_DEPTH <n> elements, the id attribute and the text node
		assert.equal(calls, DEEP_TREE_DEPTH + 3);
	},
	'Node.toString and NodeList.toString on a deep tree do not throw RangeError': function () {
		var doc = deepDocument();
		assert.equal(doc.toString(), DEEP_XML);
		assert.equal(doc.documentElement.toString(), DEEP_XML);
		assert.equal(doc.documentElement.childNodes.toString(), DEEP_XML.slice('<root>'.length, -'</root>'.length));
	},
	'cloneNode(true) on a deep tree does not throw RangeError': function () {
		var doc = deepDocument();
		var clone = doc.documentElement.cloneNode(true);
		var result = descend(clone);
		assert.equal(result.depth, DEEP_TREE_DEPTH);
		assert.equal(result.deepest.getAttribute('id'), 'deepest');
		assert.equal(result.deepest.firstChild.data, 'x');
		assert.notStrictEqual(result.deepest, descend(doc.documentElement).deepest);
		assert.equal(clone.toString(), DEEP_XML);
	},
	'importNode(node, true) on a deep tree does not throw RangeError': function () {
		var destDoc = new DOMImplementation().createDocument(null, 'dest', null);
		var imported = destDoc.importNode(deepDocument().documentElement, true);
		var result = descend(imported);
		assert.equal(result.depth, DEEP_TREE_DEPTH);
		assert.strictEqual(imported.ownerDocument, destDoc);
		assert.strictEqual(result.deepest.ownerDocument, destDoc);
		assert.strictEqual(result.deepest.firstChild.ownerDocument, destDoc);
		assert.equal(imported.toString(), DEEP_XML);
	},
	'normalize on a deep tree does not throw RangeError': function () {
		var doc = createDeepDocument();
		var deepest = descend(doc.documentElement).deepest;
		deepest.appendChild(doc.createTextNode('y'));
		assert.equal(deepest.childNodes.length, 2);
		doc.normalize();
		assert.equal(deepest.childNodes.length, 1);
		assert.equal(deepest.firstChild.data, 'xy');
	},
}).run();

wows.describe('iterative tree walks keep the results of the recursive ones').addBatch({
	'getElementsByTagName and getElementById visit nodes in document order': function () {
		var doc = new DOMParser().parseFromString('<r><a id="1"><b id="2"/><a id="3"/></a><b id="4"><a id="5"/></b></r>', 'text/xml');
		function ids(list) {
			var result = [];
			for (var i = 0; i < list.length; i++) {
				result.push(list.item(i).getAttribute('id'));
			}
			return result.join(',');
		}
		assert.equal(ids(doc.getElementsByTagName('a')), '1,3,5');
		assert.equal(ids(doc.documentElement.getElementsByTagName('*')), '1,2,3,4,5');
		assert.equal(ids(doc.getElementsByTagNameNS('*', 'b')), '2,4');
		assert.equal(doc.getElementById('4').tagName, 'b');
		assert.strictEqual(doc.getElementById('6'), null);
	},
	'textContent skips comments and processing instructions at every level': function () {
		var doc = new DOMParser().parseFromString('<root>a<!--c--><x>b<?p q?>c<y>d<!--e--></y></x>f<![CDATA[g]]></root>', 'text/xml');
		assert.equal(doc.documentElement.textContent, 'abcdfg');
		assert.equal(doc.documentElement.firstChild.textContent, 'a');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createTextNode('h'));
		var el = doc.createElement('i');
		el.appendChild(doc.createTextNode('j'));
		fragment.appendChild(el);
		assert.equal(fragment.textContent, 'hj');
	},
	'normalize merges adjacent text nodes at every level': function () {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var root = doc.documentElement;
		root.appendChild(doc.createTextNode('a'));
		root.appendChild(doc.createTextNode('b'));
		var x = doc.createElement('x');
		x.appendChild(doc.createTextNode('c'));
		x.appendChild(doc.createTextNode('d'));
		x.appendChild(doc.createTextNode('e'));
		root.appendChild(x);
		root.appendChild(doc.createTextNode('f'));
		root.normalize();
		assert.equal(root.childNodes.length, 3);
		assert.equal(root.firstChild.data, 'ab');
		assert.equal(x.childNodes.length, 1);
		assert.equal(x.firstChild.data, 'cde');
		assert.equal(root.lastChild.data, 'f');
		assert.equal(root.toString(), '<root>ab<x>cde</x>f</root>');
	},
	'cloneNode copies attributes and children, or only the node when not deep': function () {
		var doc = new DOMParser().parseFromString('<root a="1"><x b="2">t<y/></x><!--c--></root>', 'text/xml');
		var root = doc.documentElement;
		var clone = root.cloneNode(true);
		assert.notStrictEqual(clone, root);
		assert.notStrictEqual(clone.firstChild, root.firstChild);
		assert.equal(clone.toString(), '<root a="1"><x b="2">t<y/></x><!--c--></root>');
		assert.equal(clone.firstChild.getAttribute('b'), '2');
		assert.strictEqual(clone.firstChild.parentNode, clone);
		assert.equal(root.cloneNode(false).toString(), '<root a="1"/>');
		assert.equal(doc.cloneNode(true).toString(), doc.toString());
		var attr = root.getAttributeNode('a').cloneNode(false);
		assert.equal(attr.value, '1');
	},
	'importNode copies the node into the target document': function () {
		var doc = new DOMParser().parseFromString('<root a="1"><x b="2">t<y/></x><!--c--></root>', 'text/xml');
		var destDoc = new DOMImplementation().createDocument(null, 'dest', null);
		var imported = destDoc.importNode(doc.documentElement, true);
		assert.equal(imported.toString(), '<root a="1"><x b="2">t<y/></x><!--c--></root>');
		assert.strictEqual(imported.parentNode, null);
		assert.strictEqual(imported.ownerDocument, destDoc);
		assert.strictEqual(imported.firstChild.ownerDocument, destDoc);
		assert.strictEqual(imported.firstChild.firstChild.ownerDocument, destDoc);
		assert.strictEqual(imported.lastChild.ownerDocument, destDoc);
		assert.equal(destDoc.importNode(doc.documentElement, false).toString(), '<root a="1"/>');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createElement('f'));
		fragment.firstChild.appendChild(doc.createTextNode('g'));
		var importedFragment = destDoc.importNode(fragment, true);
		assert.equal(importedFragment.nodeType, 11);
		assert.equal(importedFragment.toString(), '<f>g</f>');
		assert.strictEqual(importedFragment.firstChild.firstChild.ownerDocument, destDoc);
	},
	'serializeToString applies nodeFilter to elements, attributes and text in document order': function () {
		var doc = new DOMParser().parseFromString('<root a="1" b="2"><x>text</x><y/><z>keep</z></root>', 'text/xml');
		var calls = [];
		var xml = new XMLSerializer().serializeToString(doc.documentElement, false, function (node) {
			calls.push(node.nodeName);
			if (node.nodeName == 'x') return '[x]';
			if (node.nodeName == 'y') return null;
			if (node.nodeType == 2 && node.name == 'b') return null;
			return node;
		});
		assert.equal(xml, '<root a="1">[x]<z>keep</z></root>');
		assert.equal(calls.join(','), 'root,a,b,x,y,z,#text');
	},
	'serializeToString serializes the node a nodeFilter returns in place of the original': function () {
		var doc = new DOMParser().parseFromString('<root><x>X</x><w>W</w></root>', 'text/xml');
		var x = doc.documentElement.firstChild;
		var sub = doc.createElement('sub');
		sub.appendChild(doc.createTextNode('S'));
		var filter = function (node) {
			return node === x ? sub : node;
		};
		assert.equal(new XMLSerializer().serializeToString(doc.documentElement, false, filter), '<root><sub>S</sub><w>W</w></root>');
		assert.equal(new XMLSerializer().serializeToString(x, false, filter), '<sub>S</sub>');
	},
	'serializeToString writes HTML script children as raw text and closes empty non-void HTML elements': function () {
		var htmlns = 'http://www.w3.org/1999/xhtml';
		var doc = new DOMImplementation().createDocument(htmlns, 'html', null);
		var html = doc.documentElement;
		var script = doc.createElementNS(htmlns, 'script');
		script.appendChild(doc.createTextNode('a < b'));
		script.appendChild(doc.createElementNS(htmlns, 'b'));
		script.appendChild(doc.createTextNode(' && c'));
		html.appendChild(script);
		html.appendChild(doc.createElementNS(htmlns, 'br'));
		html.appendChild(doc.createElementNS(htmlns, 'div'));
		assert.equal(
			new XMLSerializer().serializeToString(html),
			'<html xmlns="http://www.w3.org/1999/xhtml"><script>a < b<b></b> && c</script><br/><div></div></html>'
		);
	},
	'serializeToString of a DocumentFragment and of a Document with a doctype': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root', impl.createDocumentType('root', '"-//X//EN"', '"x.dtd"'));
		assert.equal(doc.toString(), '<!DOCTYPE root PUBLIC "-//X//EN" "x.dtd"><root/>');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createComment('c'));
		fragment.appendChild(doc.createProcessingInstruction('pi', 'd'));
		var e = doc.createElement('e');
		e.appendChild(doc.createTextNode('a&b<c'));
		fragment.appendChild(e);
		fragment.appendChild(doc.createCDATASection('x'));
		assert.equal(new XMLSerializer().serializeToString(fragment), '<!--c--><?pi d?><e>a&amp;b&lt;c</e><![CDATA[x]]>');
	},
	'serializeToString keeps the namespace declarations of nested elements': function () {
		var doc = new DOMParser().parseFromString('<root xmlns="urn:a" xmlns:p="urn:p"><p:x><y p:attr="1"/></p:x></root>', 'text/xml');
		assert.equal(doc.toString(), '<root xmlns="urn:a" xmlns:p="urn:p"><p:x><y p:attr="1"/></p:x></root>');
		assert.equal(
			new XMLSerializer().serializeToString(doc.documentElement.firstChild),
			'<p:x xmlns:p="urn:p"><y p:attr="1" xmlns="urn:a"/></p:x>'
		);
	},
}).run();
