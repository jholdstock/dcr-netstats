var _ = require('lodash');
var logger = require('./lib/utils/logger');
var chalk = require('chalk');
var http = require('http');
var fs = require('fs');
var WebSocket = require('ws');
var exec = require('child_process').exec;

// use mainnet by default
var env = process.env.NODE_ENV || "production";
var config = require('./lib/utils/config.json')[env];

var rpc_cert = fs.readFileSync(config.cert_path);
var rpc_user = config.user;
var rpc_password = config.pass;

var app = require('./lib/express');
server = http.createServer(app);

// Init socket vars
var Primus = require('primus');
var api;
var client;
var server;

// Init Client Socket connection
client = new Primus(server, {
	transformer: 'websockets',
	pathname: '/primus',
	parser: 'JSON'
});

client.use('emit', require('primus-emit'));

// Init collections
var Collection = require('./lib/collection');
var Nodes = new Collection();
Nodes.add( {id : 'localhost'}, function (err, info)
{
	if (err) console.log(err);
});

Nodes.setChartsCallback(function (err, charts)
{
	if(err !== null)
	{
		console.error('COL', 'CHR', 'Charts error:', err);
	}
	else
	{
		client.write({
			action: 'charts',
			data: charts
		});
	}
});

// Initiate the websocket connection.  The dcrd generated certificate acts as
// its own certificate authority, so it needs to be specified in the 'ca' array
// for the certificate to properly validate.
var ws = new WebSocket('wss://'+config.host+':'+config.port+'/ws', {
  headers: {
    'Authorization': 'Basic '+new Buffer(rpc_user+':'+rpc_password).toString('base64')
  },
  cert: rpc_cert,
  ca: [rpc_cert]
});
ws.on('open', function() {
    console.log('CONNECTED');
    // Send a JSON-RPC command to be notified when blocks are connected and
    // disconnected from the chain.
    ws.send('{"jsonrpc":"1.0","id":"0","method":"notifyblocks","params":[]}');

    /* Update peer list each minute */
    var activeNodesInterval = setInterval(function() {
      ws.send('{"jsonrpc":"1.0","id":"0","method":"getpeerinfo","params":[]}');
    }, 60000);

    /* Update locked DCR in PoS each 5 minutes */
    var lockedCoinsInterval = setInterval(function() {
      ws.send('{"jsonrpc":"1.0","id":"0","method":"getticketpoolvalue","params":[]}');
    }, 5 * 60000);

    var hashrateCheck = setInterval( function () {
  		ws.send('{"jsonrpc":"1.0","id":"0","method":"getmininginfo","params":[]}');
  	}, 60000);

});

ws.on('message', function(data, flags) {

    try {
    	data = JSON.parse(data);
    } catch(e) {
    	console.log(e);
    	return;
    }

    /* Get New Block by hash */
    if (data.params) { 
    	ws.send('{"jsonrpc":"1.0","id":"0","method":"getblock","params":["'+data.params[0]+'"]}'); 
    	return; 
    }
    
	  var result = data.result;

	  if (result && result.height) {

      addNewBlock(result);

		} else if (result && result.networkhashps && result.pooledtx) {
      updateNetworkHashrate(result);

		} else if (typeof result === "object") {
      updatePeerInfo(result);
    
    } else if ( Number(result) === result && result % 1 === 0 ) {
      updateSupply(result);

    } else if ( Number(result) === result && result % 1 !== 0 ) {
      updateLocked(result);
    }
});
ws.on('error', function(derp) {
  console.log('ERROR:' + derp);
})
ws.on('close', function(data) {
  console.log('DISCONNECTED');
})

client.on('connection', function (clientSpark)
{
	clientSpark.on('ready', function (data)
	{
		clientSpark.emit('init', { nodes: Nodes.all() });

		Nodes.getCharts();
    client.write({ action: 'peers', data: {peers : Nodes.peers()} });
	});

	clientSpark.on('client-pong', function (data)
	{
		var serverTime = _.get(data, "serverTime", 0);
		var latency = Math.ceil( (_.now() - serverTime) / 2 );

		clientSpark.emit('client-latency', { latency: latency });
	});
});

var latencyTimeout = setInterval( function ()
{
	client.write({
		action: 'client-ping',
		data: {
			serverTime: _.now()
		}
	});
}, 5000);

// Cleanup old inactive nodes
var nodeCleanupTimeout = setInterval( function ()
{
	client.write({
		action: 'init',
		data: Nodes.all()
	});

	Nodes.getCharts();

}, 1000*60*60);

function addNewBlock (block) {
    Nodes.addBlock('localhost', block, function (err, stats)
    {
      if(err !== null)
      {
        console.error('API', 'BLK', 'Block error:', err);
      }
      else
      {
        if(stats !== null)
        {
          client.write({
            action: 'block',
            data: stats
          });

          console.success('API', 'BLK', 'Block:', block['height']);

          Nodes.getCharts();
        }
      }
    });

    /* Update coin supply */
    ws.send('{"jsonrpc":"1.0","id":"0","method":"getcoinsupply","params":[]}');
}

function updateSupply (data) {
  Nodes.updateSupply(data, function (err, stats) {
    if(err !== null)
    {
      console.error('API', 'UPD', 'updateSupply error:', err);
    } else {
      console.success('API', 'UPD', 'Updated availiable supply');
      return;
    }
  });
}

function updateLocked (data) {
  Nodes.updateLocked(data, function (err, stats) {
    if(err !== null)
    {
      console.error('API', 'UPD', 'updateLocked error:', err);
    } else {
      console.success('API', 'UPD', 'Updated locked coins');
      return;
    }
  });
}

function updatePeerInfo(data) {
  Nodes.updatePeers(data, function(err, peers) {
    if (err) { 
      console.log(err);
    } else {
      console.success('API', 'UPD', 'Updated peers');
    }
    client.write({ action: 'peers', data: {peers : Nodes.peers()} });
  });
}

function updateNetworkHashrate (data) {
  Nodes.updateMiningInfo(data, function (err, stats) {
    if(err !== null)
    {
      console.error('API', 'BLK', 'MiningInfo error:', err);
    } else {
      console.success('API', 'UPD', 'Updated mininginfo');
      client.write({
        action: 'mininginfo',
        data: stats
      });
    }
  });
}

server.listen(process.env.PORT || 3000);

module.exports = server;
