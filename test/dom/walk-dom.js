var wows = require('vows');
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;
var walkDOM = require('xmldom/dom').walkDOM;

/**
 * Build a small DOM tree for testing:
 *
 *   root (Element)
 *     childA (Element)
 *       grandchildA1 (Element)
 *       grandchildA2 (Element)
 *     childB (Element)
 *       grandchildB1 (Element)
 */
function buildTree() {
	var doc = new DOMImplementation().createDocument(null, 'root', null);
	var root = doc.documentElement;

	var childA = doc.createElement('childA');
	root.appendChild(childA);
	childA.appendChild(doc.createElement('grandchildA1'));
	childA.appendChild(doc.createElement('grandchildA2'));
	var childB = doc.createElement('childB');
	root.appendChild(childB);
	childB.appendChild(doc.createElement('grandchildB1'));

	return { doc: doc, root: root, childA: childA, childB: childB };
}

// see https://github.com/xmldom/xmldom/security/advisories/GHSA-2v35-w6hq-6mfw
wows.describe('walkDOM').addBatch({
	'pre-order entry: calls enter on parent before children': function () {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function (node) {
				visited.push(node.nodeName);
				// Descend into root so childA/childB are visited, but skip grandchildren
				if (node === tree.root) return 'ctx';
				return null;
			}
		});
		// root entered first; childA and childB entered; grandchildren skipped
		assert.deepEqual(visited, ['root', 'childA', 'childB']);
	},
	'pre-order entry: visits all nodes in depth-first pre-order when enter returns a truthy context': function () {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, 'ctx', {
			enter: function (node) {
				visited.push(node.nodeName);
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'childA', 'grandchildA1', 'grandchildA2', 'childB', 'grandchildB1']);
	},
	'post-order exit: calls exit on a node after all its children have been exited': function () {
		var tree = buildTree();
		var log = [];
		walkDOM(tree.root, 'ctx', {
			enter: function (node) {
				log.push('enter:' + node.nodeName);
				return 'ctx';
			},
			exit: function (node) {
				log.push('exit:' + node.nodeName);
			}
		});
		assert.deepEqual(log, [
			'enter:root',
			'enter:childA',
			'enter:grandchildA1',
			'exit:grandchildA1',
			'enter:grandchildA2',
			'exit:grandchildA2',
			'exit:childA',
			'enter:childB',
			'enter:grandchildB1',
			'exit:grandchildB1',
			'exit:childB',
			'exit:root'
		]);
	},
	'post-order exit: passes the context returned by enter to exit': function () {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var root = doc.documentElement;
		root.appendChild(doc.createElement('child'));

		var exitContexts = [];
		walkDOM(root, 0, {
			enter: function (node, ctx) {
				return ctx + 1;
			},
			exit: function (node, ctx) {
				exitContexts.push({ name: node.nodeName, ctx: ctx });
			}
		});
		// root enter gets ctx=0, returns 1; child enter gets ctx=1, returns 2
		// child exit gets ctx=2; root exit gets ctx=1
		assert.deepEqual(exitContexts, [
			{ name: 'child', ctx: 2 },
			{ name: 'root', ctx: 1 }
		]);
	},
	'context propagation: each child receives the return value of its parent enter': function () {
		var tree = buildTree();
		var receivedCtx = {};
		walkDOM(tree.root, 0, {
			enter: function (node, ctx) {
				receivedCtx[node.nodeName] = ctx;
				return ctx + 1;
			}
		});
		assert.strictEqual(receivedCtx['root'], 0);
		assert.strictEqual(receivedCtx['childA'], 1);
		assert.strictEqual(receivedCtx['grandchildA1'], 2);
		assert.strictEqual(receivedCtx['grandchildA2'], 2);
		assert.strictEqual(receivedCtx['childB'], 1);
		assert.strictEqual(receivedCtx['grandchildB1'], 2);
	},
	'STOP sentinel: returning walkDOM.STOP from enter aborts the entire traversal immediately': function () {
		var tree = buildTree();
		var visited = [];
		var result = walkDOM(tree.root, null, {
			enter: function (node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return walkDOM.STOP;
				}
				return 'ctx';
			},
			exit: function (node) {
				visited.push('exit:' + node.nodeName);
			}
		});
		// root and childA entered; traversal stops at childA - no children of childA,
		// no siblings (childB), no exit calls
		assert.deepEqual(visited, ['root', 'childA']);
		assert.strictEqual(result, walkDOM.STOP);
	},
	'skip children: returning null from enter skips children but continues with siblings': function () {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function (node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return null; // skip grandchildA1, grandchildA2
				}
				return 'ctx';
			}
		});
		// childB and its child are still walked (null only skips childA's children)
		assert.deepEqual(visited, ['root', 'childA', 'childB', 'grandchildB1']);
	},
	'skip children: returning undefined from enter skips children but continues with siblings': function () {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function (node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return undefined; // skip grandchildA1, grandchildA2
				}
				return 'ctx';
			}
		});
		// childB and its child are still walked (undefined only skips childA's children)
		assert.deepEqual(visited, ['root', 'childA', 'childB', 'grandchildB1']);
	},
	'skip children: exit is still called once for every enter': function () {
		var tree = buildTree();
		var log = [];
		walkDOM(tree.root, null, {
			enter: function (node) {
				log.push('enter:' + node.nodeName);
				return node === tree.root ? 'ctx' : null;
			},
			exit: function (node, ctx) {
				log.push('exit:' + node.nodeName + ':' + ctx);
			}
		});
		assert.deepEqual(log, [
			'enter:root',
			'enter:childA',
			'exit:childA:null',
			'enter:childB',
			'exit:childB:null',
			'exit:root:ctx'
		]);
	},
	'enter modifies the child list before descent: the walker visits the modified child list': function () {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var root = doc.documentElement;
		root.appendChild(doc.createElement('original'));

		var visited = [];
		walkDOM(root, null, {
			enter: function (node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'root') {
					// Add a new child before returning - walker should see it
					root.appendChild(doc.createElement('added'));
				}
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'original', 'added']);
	},
	'deep tree (stack overflow guard): walkDOM on a tree of 10,000 depth succeeds without throwing RangeError': function () {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var current = doc.documentElement;
		for (var i = 0; i < 10000; i++) {
			var child = doc.createElement('n');
			current.appendChild(child);
			current = child;
		}
		var count = 0;
		walkDOM(doc.documentElement, null, {
			enter: function () {
				count++;
				return 'ctx';
			}
		});
		assert.equal(count, 10001);
	}
}).run();
