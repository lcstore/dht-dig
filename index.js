var WebTorrent = require('webtorrent')

var client = new WebTorrent()
var magnetURI = 'magnet:?xt=urn:btih:03621694f0e8b2ce87216c99cb5ca3af23029e37'

client.add(magnetURI, function (torrent) {
  // Got torrent metadata!
  console.log('Client is downloading:', torrent.infoHash)

  torrent.files.forEach(function (file) {
    // Display the file by appending it to the DOM. Supports video, audio, images, and
    // more. Specify a container element (CSS selector or reference to DOM node).
    console.log('file:'+JSON.stringify(file))
  })
})