const DHT = require('bittorrent-dht')
// var magnet = require('magnet-uri')
const util = require('util')
const request=require('request');
const moment=require('moment');
const Peer=require('./lib/peer');
const Utils=require('./lib/utils');
const Protocol = require('bittorrent-protocol')
const net = require('net');
const ut_metadata = require('ut_metadata');
var opts = {
  concurrency:3
}
var dht = new DHT(opts)
var oHashSet = {};


var port = 6881;
dht.listen(port, function () {
  console.log('['+currentDate()+']listening on:'+port)
})

dht.on('peer', function (peer, infoHash, from) {
  var sTime = currentDate()
  sTime = '['+sTime+']'
  console.log(sTime+'peer.peer:' + JSON.stringify(peer) + ',from:' + JSON.stringify(from)+',infoHash:'+infoHash.toString('hex'))
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
  console.log(sTime+'findMetadata:' + destObj.infoHash)
  findMetadata(peer,destObj.infoHash);
  download(peer,infoHash);
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
  var type = 'torrage-torrent-info';
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
        var infoHash = oTask.url;
        delete oHashSet[infoHash];
      };
    }
  });
}, 60000);

function currentDate(){
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}


function findMetadata(oPeer,infohash){
  var socket = new net.Socket();
  socket.setTimeout(this.timeout || 20000);
  socket.connect(oPeer.port, oPeer.host, function() {
    var wire = new Protocol()
    socket.pipe(wire).pipe(socket)
    // initialize the extension
    wire.use(ut_metadata())
    // ask the peer to send us metadata
    wire.ut_metadata.fetch()

    // 'metadata' event will fire when the metadata arrives and is verified to be correct!
    wire.ut_metadata.on('metadata', function (metadata) {
      // got metadata!
      console.log(infohash+',findMetadata,metadata:'+metadata)
    })
    wire.ut_metadata.on('warning', function (err) {
      console.log('warning:'+err.message)
    })
    var peerId = Utils.randomID();
    console.log('findMetadata.peerId:'+peerId+',infohash:'+infohash)
    wire.handshake(infohash,peerId)
  }.bind(this));

  socket.on('error', function(err) {
      socket.destroy();
  }.bind(this));

  socket.on('timeout', function(err) {
      console.log(infohash+'.timeout ...')
      socket.destroy();
  }.bind(this));

  socket.once('close', function(err) {
      console.log(infohash+',close.socket,err:'+err.message)
  }.bind(this));
}


var Wire = require('./lib/wire');

function download(rinfo, infohash) {
    var socket = new net.Socket();

    socket.setTimeout(this.timeout || 50000);
    socket.connect(rinfo.port, rinfo.host, function() {
        var wire = new Wire(infohash);
        socket.pipe(wire).pipe(socket);

        wire.on('metadata', function(metadata, infoHash) {
            successful = true;
            console.log(infoHash+',download.complete')
            this.emit('complete', metadata, infoHash, rinfo);
            socket.destroy();
        }.bind(this));

        wire.on('fail', function() {
            socket.destroy();
        }.bind(this));

        wire.sendHandshake();
    }.bind(this));

    socket.on('error', function(err) {
        console.log(infohash+',download.error:'+err.message)
        socket.destroy();
    }.bind(this));

    socket.on('timeout', function(err) {
        socket.destroy();
    }.bind(this));

    socket.once('close', function() {
      console.log('download,close')
    }.bind(this));
};