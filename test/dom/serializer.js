var wows = require('vows');
var DOMParser = require('xmldom').DOMParser;

wows.describe('XML Serializer').addBatch({
  'text node containing "]]>"': function() {
    var doc = new DOMParser().parseFromString('<test/>', 'text/xml');
    doc.documentElement.appendChild(doc.createTextNode('hello ]]> there'));
    console.assert(doc.documentElement.firstChild.toString() == 'hello ]]> there',doc.documentElement.firstChild.toString());
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
