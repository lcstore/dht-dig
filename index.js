var DHT = require('bittorrent-dht')
// var magnet = require('magnet-uri')
var util = require('util')
var request=require('request');

var opts = {
  concurrency:2
}
var dht = new DHT(opts)
var oHashSet = {};

// dht.on('peer', function (peer, infoHash, from) {
//   console.log('peer.peer:' + peer.host + ':' + peer.port + ',from:' + from.address + ':' + from.port+',infoHash:'+infoHash.toString('hex'))
// })

dht.listen(6881, function () {
  console.log('now listening')
})

dht.on('announce', function (peer, infoHash, from) {
  var destObj = {};
  destObj.peer = peer;
  // destObj.from = from;
  destObj.infoHash = infoHash.toString('hex');
  console.log('announce:' + JSON.stringify(destObj))
  oHashSet[destObj.infoHash] = destObj;
});

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



setInterval(function() {
  var destObj = {};
  destObj.peer = {host:'127.0.0.1',port:999};
  destObj.infoHash = 'd59643a3bdbe93f8c718e4e3ca2dd1b57cb4b4fe';
  oHashSet[destObj.infoHash] = destObj;
  destObj.infoHash = 'd5ac839e417b8446a8dae17051692e1e09c629c4';
  oHashSet[destObj.infoHash] = destObj;
  var type = 'torrent-info';
  var level = 100;
  var oTaskArr = [];
  var keySet = Object.keys(oHashSet);
  var maxCount = 200;
  for (var i = 0; i < keySet.length && i<maxCount; i++) {
    var key = keySet[i];
    var oHash = oHashSet[key];
    var oPeer = oHash.peer;
    var oTask = {};
    oTask.type = type;
    oTask.level = level;
    oTask.url = oHash.infoHash;
    oTask.args = {};
    oTask.args.retry = 0;
    oTask.args.peer = oPeer.host+':'+oPeer.port;
    oTaskArr.push(oTask);
    delete oHashSet[key];
  };
  console.log('create task:'+oTaskArr.length+',total:'+keySet.length)
  if(oTaskArr.length<1){
    return;
  }
  var options = {
      headers: {
       'User-Agent':'Mozilla/5.0 (compatible; dig/1.0; +http://www.lezomao.com)',
       'content-type':'application/x-www-form-urlencoded'
      },
      url: 'http://localhost:8090/taskmgr/createtasks'
  };
  options.form = {};
  options.form.tasks = JSON.stringify(oTaskArr)
  request.post(options, function(error,response,body){ 
    if(error){
      console.error('error:'+error.name+',msg:'+error.message);
    }else {
      console.log('statusCode:'+response.statusCode+',body:'+body)
    }
  });
}, 1000);
