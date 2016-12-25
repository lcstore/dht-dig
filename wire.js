var net = require('net');

var Wire = require('./lib/wire');

function download(rinfo, infohash) {
    var socket = new net.Socket();

    socket.setTimeout(this.timeout || 50000);
    socket.connect(rinfo.port, rinfo.host, function() {
        var wire = new Wire(infohash);
        socket.pipe(wire).pipe(socket);

        wire.on('metadata', function(metadata, infoHash) {
            successful = true;
            console.log('complete')
            this.emit('complete', metadata, infoHash, rinfo);
            socket.destroy();
        }.bind(this));

        wire.on('fail', function() {
            socket.destroy();
        }.bind(this));

        wire.sendHandshake();
    }.bind(this));

    socket.on('error', function(err) {
        console.log('error:'+error.message)
        socket.destroy();
    }.bind(this));

    socket.on('timeout', function(err) {
        socket.destroy();
    }.bind(this));

    socket.once('close', function() {
      console.log('close')
    }.bind(this));
};
var rinfo = {"host":"115.231.126.43","port":13882}
var infohash = '32369f75ba74110b5d67861ecf15f3c95eb6c1de'
var buf = new Buffer(infohash);
console.log('rinfo:'+JSON.stringify(rinfo)+',infohash:'+infohash+',hash:'+buf.toString('hex'))
download(rinfo,buf.toString('hex'))