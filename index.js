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
const async = require('async');
var parseTorrent = require('parse-torrent');


function DigClient(){
  var self = this;
  self.oHashSet = {};
  self.wokerCount =1;
  self.timeout =20000;
  self.q = async.queue(function (oParam, iCb) {
      var oPeer = oParam.peer;
      var infoHash = oParam.infoHash;
      var destData;
      var socket = new net.Socket();
      socket.setTimeout(self.timeout || 20000);
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
          return iCb(oPeer,infoHash,destData);
      }.bind(this));
       
  }, self.wokerCount);
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
        // self.findMetadata(peer,destObj.infoHash);
        var oParam = destObj;
        self.q.push(oParam,function(oPeer,infoHash,metaData){
          if(metaData){
            console.log(oPeer+',infoHash:'+infoHash+',saveMetadata,metadata:'+metaData.length)
            var oTorrent = parseTorrent(metaData);
            console.log('oTorrent.files:'+JSON.stringify(oTorrent.files))
            oTorrent = name2Chars(oTorrent);
            console.log('oTorrent:'+JSON.stringify(oTorrent))
            var oData = {};
            oData.core = 'clink';
            var oDocs = oData.docs = [];
            var oDoc = {};
            oDoc.id = makeId(oTorrent.infoHash);
            oDoc.link = 'magnet:?xt=urn:btih:'+ oTorrent.infoHash;
            oDoc.protocol = 'magnet';
            oDoc.suffix = 'torrent';
            oDoc.type =  'dht-dig-info';
            oDoc.title =  oTorrent.name;
            oDoc.code =  oTorrent.infoHash;
            oDoc.space =  oTorrent.length;
            oDoc.peer_s =  args.peer;
            var creation = moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            oDoc.creation = {add:creation}
            var oPaths = oDoc.paths =  [];
            var oLengths = oDoc.lengths =  [];
            var oFileArr = oTorrent.files;
            var oVideoReg = /\.(avi|mpg|divx|div|xvid|mpeg|wmv|asf|asx|mpe|m1v|m2v|dat|mp4|m4v|dv|dif|mjpg|mjpeg|mov|qt|rm|rmvb|3gp|3g2|h261|h264|yuv|raw|flv|swf|vob|mkv|ogm)$/ig;
            var oZipReg = /\.(rar|cab|arj|lzh|ace|7-zip|tar|gzip|uue|bz2|jar|iso|z)$/ig;
            var isPass = false;
            var minLen = 50*1024*1024;
            for (var i = 0; i < oFileArr.length; i++) {
              var oFile = oFileArr[i];
              if(oFile.length > minLen && (oVideoReg.test(oFile.name))){
                isPass = true;
                break;
              }
            }
            isPass = true;
            if(isPass){
              oFileArr.sort(function(a,b){
                return b.length - a.length;
              });
              var paddingMark = '_____padding_file_';
              for (var i = 0; i < oFileArr.length; i++) {
                var oFile = oFileArr[i];
                if(oFile.name.startWith(paddingMark)){
                  continue;
                }
                oPaths.push(oFile.name);
                oLengths.push(oFile.length);
              };
              oDocs.push(oDoc);
              console.log('docs:'+JSON.stringify(oDocs))
            }
     
          }else {
            console.log(oPeer+',infoHash:'+infoHash+',saveMetadata.null')
          }
        });
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

function makeId(infoHash){
   var source = 'magnet;'+infoHash;
   source = source.toLowerCase();
   var sCode = ''+toHashCode(source);
   sCode = sCode.replace('-','0');
   return 'm'+sCode;
}

function toHashCode(source) {
  var hash = 0, i, chr, len;
  if (typeof(source)=='undefined' || source===null){
    return hash;
  } 
  for (i = 0, len = source.length; i < len; i++) {
    chr   = source.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}


function currentDate(){
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}

var opts = {
  concurrency:3
}
new DigClient().bootstrap(opts)