const DHT = require('bittorrent-dht')
// var magnet = require('magnet-uri')
const util = require('util')
const request=require('request');
const moment=require('moment');
// const Peer=require('./lib/peer');
const Utils=require('./lib/utils');
const Protocol = require('bittorrent-protocol')
const net = require('net');
const ut_metadata = require('ut_metadata');
var parseTorrent = require('parse-torrent');


function DigClient(){
  var self = this;
  self.oHashSet = {};
  setInterval(function() {
    var type = 'torrage-torrent-info';
    var level = 100;
    var oTaskArr = [];
    var keySet = Object.keys(self.oHashSet);
    var maxCount = 200;
    for (var i = 0; i < keySet.length && i<maxCount; i++) {
      var key = keySet[i];
      var oHash = self.oHashSet[key];
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
          delete self.oHashSet[infoHash];
        };
      }
    });
  }, 60000);
}
DigClient.prototype.bootstrap = function(opts) {
  self = this;
  self.dht = new DHT(opts)
  opts.dhtPort = opts.dhtPort || 6881
  self.dht.listen(opts.dhtPort, function () {
    console.log('['+currentDate()+']listening on:'+opts.dhtPort)
  });

  self.dht.on('peer', function (peer, infoHash, from) {
    var sTime = currentDate()
    sTime = '['+sTime+']'
    console.log(sTime+'peer.peer:' + JSON.stringify(peer) + ',from:' + JSON.stringify(from)+',infoHash:'+infoHash.toString('hex'))
  })

  self.dht.on('announce', function (peer, infoHash, from) {
    var destObj = {};
    destObj.peer = peer;
    // destObj.from = from;
    destObj.infoHash = infoHash.toString('hex');
    var sTime = currentDate()
    sTime = '['+sTime+']'
    console.log(sTime+'announce:' + JSON.stringify(destObj))
    if(!self.oHashSet[destObj.infoHash]){
        console.log(sTime+'findMetadata:' + destObj.infoHash)
        self.oHashSet[destObj.infoHash] = destObj;
        self.findMetadata(peer,destObj.infoHash);
    }
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
    self.dht.lookup(sInfoHash)
  };
};

DigClient.prototype.findMetadata = function(oPeer,infoHash) {
  var self = this;
  var destData;
  var socket = new net.Socket();
  socket.setTimeout(this.timeout || 20000);
  socket.connect(oPeer.port, oPeer.host, function() {
    var wire = new Protocol()
    socket.pipe(wire).pipe(socket)
    wire.use(ut_metadata())
    wire.ut_metadata.fetch()
    wire.ut_metadata.on('metadata', function (metadata) {
      console.log(infoHash+',findMetadata,metadata:'+metadata.length)
      destData = metadata;
    })
    wire.ut_metadata.on('warning', function (err) {
      console.log('warning:'+err.message)
    })
    var peerId = Utils.randomID();
    wire.handshake(infoHash,peerId)
  }.bind(this));

  socket.on('error', function(err) {
      socket.destroy();
  }.bind(this));

  socket.on('timeout', function(err) {
      socket.destroy();
  }.bind(this));

  socket.once('close', function() {
      return self.saveMetadata(oPeer,infoHash,destData);
  }.bind(this));
};


DigClient.prototype.saveMetadata = function(oPeer,infoHash,metadata) {
     var self = this;
     if(metadata){
       console.log(oPeer+',infoHash:'+infoHash+',saveMetadata,metadata:'+metadata)
       var oTorrent = parseTorrent(metadata);
       console.log('oTorrent.files:'+JSON.stringify(oTorrent.files))
       oTorrent = name2Chars(oTorrent);
       console.log('oTorrent:'+JSON.stringify(oTorrent))
     }else {
       console.log(oPeer+',infoHash:'+infoHash+',saveMetadata.null')
     }
};

function bufferChars(src){
  if(!src){
    return src;
  }
  if(util.isBuffer(src)){
    return src.toString('utf-8');
  }
  return src;
}
function name2Chars (info) {
  var oNameInfo = {};
 // 将种子名用 md5 加密
 oNameInfo.name = bufferChars(info.name);
 oNameInfo.length = bufferChars(info.length);
 oNameInfo.infoHash = bufferChars(info.infoHash).toUpperCase();
 oNameInfo['name.utf-8'] = bufferChars(info['name.utf-8']);
 var files = info.files;
 oNameInfo.files = [];
 for (var i = 0; i < files.length; i++) {
  var file = files[i];
  for (var key in file) {
   if (key == "path" || key == "path.utf-8") {
    for (var j = 0; j < file[key].length; j++) {
     var text = file[key][j].toString();
     file[key][j] = text;
    }
   }
  
  }
   oNameInfo.files.push(file)
 }
 return oNameInfo;
}




function currentDate(){
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}

var opts = {
  concurrency:3
}
new DigClient().bootstrap(opts)