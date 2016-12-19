const DHT = require('bittorrent-dht')
// var magnet = require('magnet-uri')
const util = require('util')
const request=require('request');
const moment=require('moment');

var opts = {
  concurrency:2
}
var dht = new DHT(opts)
var oHashSet = {};

// dht.on('peer', function (peer, infoHash, from) {
//   console.log('peer.peer:' + peer.host + ':' + peer.port + ',from:' + from.address + ':' + from.port+',infoHash:'+infoHash.toString('hex'))
// })
var port = 6881;
dht.listen(port, function () {
  console.log('['+currentDate()+']listening on:'+port)
})

dht.on('announce', function (peer, infoHash, from) {
  var destObj = {};
  destObj.peer = peer;
  // destObj.from = from;
  destObj.infoHash = infoHash.toString('hex');
  var sTime = currentDate()
  sTime = '['+sTime+']'
  console.log(sTime+'announce:' + JSON.stringify(destObj))
  oHashSet[destObj.infoHash] = destObj;
});

dht.on('get', function (target, value) {
  var sTime = currentDate()
  sTime = '['+sTime+']'
  console.log(sTime+'get,target:' + JSON.stringify(target)+',value:'+JSON.stringify(value))
});

dht.on('put', function (key, v) {
  var sTime = currentDate()
  sTime = '['+sTime+']'
  console.log(sTime+'put,key:' + JSON.stringify(key)+',v:'+JSON.stringify(v))
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
  var type = 'megnet-torrent-info';
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
    var oUKey = {};
    oUKey.key = oHash.infoHash;
    oUKey.expire = 18000;
    oTask.args.ukey = JSON.stringify(oUKey);
    oTask.args.retry = 0;
    oTask.args.peer = oPeer.host+':'+oPeer.port;
    oTaskArr.push(oTask);
  };
  if(oTaskArr.length<1){
    console.log('['+currentDate()+']skip create task:'+oTaskArr.length+',total:'+keySet.length)
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
    var msg = '['+currentDate()+']create task:'+oTaskArr.length+',total:'+keySet.length;
    if(error){
      console.error(msg+',error:'+error.name+',msg:'+error.message);
    }else {
      console.log(msg+',statusCode:'+response.statusCode+',body:'+body)
      for (var it = 0; it < oTaskArr.length; it++) {
        var oTask = oTaskArr[it];
        var infoHash = oHashSet.url;
        delete oHashSet[infoHash];
      };
    }
  });
}, 60000);

function currentDate(){
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}
