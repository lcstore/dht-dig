var DHT = require('bittorrent-dht')
// var magnet = require('magnet-uri')
var util = require('util')

var opts = {
  concurrency:2
}
var dht = new DHT(opts)

// dht.on('peer', function (peer, infoHash, from) {
//   console.log('peer.peer:' + peer.host + ':' + peer.port + ',from:' + from.address + ':' + from.port+',infoHash:'+infoHash.toString('hex'))
// })
dht.on('announce', function (peer, infoHash, from) {
  var destObj = {};
  destObj.peer = peer;
  destObj.from = from;
  destObj.infoHash = infoHash.toString('hex');
  console.log('announce:' + JSON.stringify(destObj))
})

dht.listen(6881, function () {
  console.log('now listening')
})
// find peers for the given torrent info hash
var oInfoHashArr = [];
oInfoHashArr.push('83790a9ce6fbbedfb831cc2cb7f430cfc45874e1');
oInfoHashArr.push('8363e5a90bf277e1f33c2d3236571eb8a54b68d8');
oInfoHashArr.push('835de86fdf17100ce121ff823fed178a3f9e0173');
oInfoHashArr.push('837ccac40b1150cf483b2dd26f25504e903230b4');
oInfoHashArr.push('8363e5a90bf277e1f33c2d3236571eb8a54b68d8');
for (var i = 0; i < oInfoHashArr.length; i++) {
	var sInfoHash = oInfoHashArr[i];
	dht.lookup(sInfoHash)
};
