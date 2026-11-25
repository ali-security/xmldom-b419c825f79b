var wows = require('vows');
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;

// DOMException codes, see dom.js
var HIERARCHY_REQUEST_ERR = 3;
var NOT_FOUND_ERR = 8;

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

function elementChildCount(node) {
	var count = 0;
	for (var child = node.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === 1) {
			count++;
		}
	}
	return count;
}

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-crh6-fp67-6883
wows.describe('Document.prototype').addBatch({
	'insertBefore should insert the first element and set `documentElement`': function () {
		var doc = new DOMImplementation().createDocument(null, '');
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(doc.documentElement, null);
		var root = doc.createElement('root');
		doc.insertBefore(root);
		assert.strictEqual(doc.documentElement, root);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(doc.childNodes.item(0), root);
	},
	'insertBefore should prevent inserting a second element': function () {
		var doc = new DOMImplementation().createDocument(null, '');
		var root = doc.createElement('root');
		var second = doc.createElement('second');
		doc.insertBefore(root);
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(second);
		});
		assert.strictEqual(doc.documentElement, root);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(second.parentNode, null);
		assert.equal(doc.toString(), '<root/>');
	},
	'appendChild should prevent appending a second element': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var second = doc.createElement('second');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.appendChild(second);
		});
		assert.equal(doc.childNodes.length, 1);
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.documentElement.tagName, 'root');
		assert.equal(doc.toString(), '<root/>');
	},
	'insertBefore should prevent inserting a second element before the first one': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var second = doc.createElement('second');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(second, doc.documentElement);
		});
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.toString(), '<root/>');
	},
	'appendChild should prevent appending a fragment with an element when an element is present': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createElement('second'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.appendChild(fragment);
		});
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.toString(), '<root/>');
	},
	'appendChild should prevent appending a fragment with two elements': function () {
		var doc = new DOMImplementation().createDocument(null, '');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createElement('first'));
		fragment.appendChild(doc.createElement('second'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.appendChild(fragment);
		});
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.documentElement.tagName, 'first');
	},
	'insertBefore should prevent inserting an element before a doctype': function () {
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('DT');
		var doc = impl.createDocument(null, '', doctype);
		assert.equal(doc.childNodes.length, 1);
		var root = doc.createElement('root');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(root, doctype);
		});
		assert.strictEqual(doc.documentElement, null);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(root.parentNode, null);
	},
	'insertBefore should prevent inserting a second doctype': function () {
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('DT');
		var doctype2 = impl.createDocumentType('DT2');
		var doc = impl.createDocument(null, '', doctype);
		assert.equal(doc.childNodes.length, 1);
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(doctype2);
		});
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(doctype2.parentNode, null);
	},
	'insertBefore should prevent inserting a doctype after an element': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, '');
		var root = doc.createElement('root');
		doc.insertBefore(root);
		var doctype = impl.createDocumentType('DT');
		assert.equal(doc.childNodes.length, 1);

		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(doctype);
		});

		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(doctype.parentNode, null);
	},
	'insertBefore should prevent inserting a doctype before a node following the element': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root');
		var comment = doc.appendChild(doc.createComment('after root'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.insertBefore(impl.createDocumentType('DT'), comment);
		});
		assert.equal(doc.childNodes.length, 2);
	},
	'insertBefore should allow inserting a doctype before the element': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root');
		var doctype = impl.createDocumentType('DT');
		doc.insertBefore(doctype, doc.documentElement);
		assert.strictEqual(doc.firstChild, doctype);
		assert.equal(doc.childNodes.length, 2);
	},
	'insertBefore should prevent inserting before an child which is not a child of parent': function () {
		var doc = new DOMImplementation().createDocument(null, '');
		var root = doc.createElement('root');
		var withoutParent = doc.createElement('second');

		assertDOMException(NOT_FOUND_ERR, function () {
			doc.insertBefore(root, withoutParent);
		});

		assert.strictEqual(doc.documentElement, null);
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(root.parentNode, null);
	},
	'insertBefore should prevent inserting a doctype into an element': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.documentElement.insertBefore(impl.createDocumentType('DT'), null);
		});
		assert.strictEqual(doc.documentElement.firstChild, null);
	},
	'insertBefore should prevent inserting into a node that can not have children': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var text = doc.documentElement.appendChild(doc.createTextNode('text'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			text.insertBefore(doc.createElement('child'), null);
		});
	},
	'insertBefore should prevent inserting a node type that can not be a child': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.documentElement.insertBefore(doc.createAttribute('attr'), null);
		});
		assert.strictEqual(doc.documentElement.firstChild, null);
	},
	'insertBefore should still insert character data and processing instructions': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var root = doc.documentElement;
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createCDATASection('cdata'));
		fragment.appendChild(doc.createTextNode('text'));
		root.insertBefore(fragment, null);
		root.insertBefore(doc.createComment('comment'), root.firstChild);
		doc.insertBefore(doc.createProcessingInstruction('pi', 'data'), root);
		assert.equal(doc.toString(), '<?pi data?><root><!--comment--><![CDATA[cdata]]>text</root>');
	},
}).addBatch({
	'replaceChild should remove the only element and add the new one': function () {
		var doc = new DOMImplementation().createDocument('', 'xml');
		var initialFirstChild = doc.firstChild;
		var replacement = doc.createElement('replaced');

		doc.replaceChild(replacement, doc.firstChild);

		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(initialFirstChild.parentNode, null);
		assert.strictEqual(doc.documentElement, replacement);
		assert.equal(doc.toString(), '<replaced/>');
	},
	'replaceChild should prevent replacing a non element node with a second element': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var comment = doc.appendChild(doc.createComment('comment'));
		var second = doc.createElement('second');
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.replaceChild(second, comment);
		});
		assert.equal(doc.childNodes.length, 2);
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.documentElement.tagName, 'root');
		assert.strictEqual(comment.parentNode, doc);
	},
	'replaceChild should prevent replacing with a fragment with two elements': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createElement('first'));
		fragment.appendChild(doc.createElement('second'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.replaceChild(fragment, doc.documentElement);
		});
		assert.equal(elementChildCount(doc), 1);
		assert.equal(doc.toString(), '<root/>');
	},
	'replaceChild should prevent replacing a node following the element with a doctype': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root');
		var comment = doc.appendChild(doc.createComment('comment'));
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.replaceChild(impl.createDocumentType('DT'), comment);
		});
		assert.equal(doc.childNodes.length, 2);
		assert.strictEqual(doc.lastChild, comment);
	},
	'replaceChild should prevent adding a second doctype': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, 'root', impl.createDocumentType('DT'));
		var comment = doc.insertBefore(doc.createComment('comment'), doc.documentElement);
		assertDOMException(HIERARCHY_REQUEST_ERR, function () {
			doc.replaceChild(impl.createDocumentType('DT2'), comment);
		});
		assert.equal(doc.childNodes.length, 3);
	},
	'replaceChild should allow replacing the doctype': function () {
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('DT');
		var doc = impl.createDocument(null, 'root', doctype);
		var doctype2 = impl.createDocumentType('DT2');
		doc.replaceChild(doctype2, doctype);
		assert.equal(doc.childNodes.length, 2);
		assert.strictEqual(doc.firstChild, doctype2);
		assert.strictEqual(doctype.parentNode, null);
	},
	'replaceChild should still replace children of elements': function () {
		var doc = new DOMImplementation().createDocument(null, 'root');
		var root = doc.documentElement;
		var a = root.appendChild(doc.createElement('a'));
		root.appendChild(doc.createElement('b'));
		root.replaceChild(doc.createElement('c'), a);
		assert.equal(doc.toString(), '<root><c/><b/></root>');
		assert.strictEqual(a.parentNode, null);
	},
}).addBatch({
	'removeChild should remove all connections to node': function () {
		var doc = new DOMImplementation().createDocument('', 'xml');
		doc.insertBefore(doc.createComment('just a comment'), doc.firstChild);
		assert.equal(doc.childNodes.length, 2);
		var initialElement = doc.firstChild;

		doc.removeChild(initialElement);

		assert.strictEqual(initialElement.parentNode, null);
		assert.strictEqual(initialElement.nextSibling, null);
		assert.strictEqual(initialElement.previousSibling, null);
		assert.equal(doc.childNodes.length, 1);
	},
	'removeChild should allow adding a new element after removing the document element': function () {
		var doc = new DOMImplementation().createDocument('', 'xml');
		var root = doc.documentElement;

		doc.removeChild(root);

		assert.strictEqual(doc.documentElement, null);
		assert.equal(doc.childNodes.length, 0);
		var replacement = doc.appendChild(doc.createElement('replacement'));
		assert.strictEqual(doc.documentElement, replacement);
		assert.equal(doc.childNodes.length, 1);
		assertDOMException(NOT_FOUND_ERR, function () {
			doc.insertBefore(doc.createComment('comment'), root);
		});
		assert.equal(doc.toString(), '<replacement/>');
	},
}).addBatch({
	'createDocument should set ownerDocument to the document itself': function () {
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, '');

		assert.strictEqual(doc.ownerDocument, doc);
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(doc.documentElement, null);
	},
	'createDocument should set ownerDocument when creating document with doctype': function () {
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('html');
		var doc = impl.createDocument(null, '', doctype);

		assert.strictEqual(doc.ownerDocument, doc);
		assert.strictEqual(doc.firstChild, doctype);
	},
}).run();
