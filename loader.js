// -=-=-=-=-=-=-
// initializing
// -=-=-=-=-=-=-

var path = require("path");
var url  = require("url");
var util = require("util");

// vwf globals
util._extend(global, {
    instances: [],
    vwfRoot: process.env.VWF || '/var/www/vwf',
    applicationRoot: process.env.WORKSPACE_LK || '/var/www/LivelyKernel',
    log: function () { console.log.apply(this, arguments); },
    logLevel: 999
});

var sio       = require(path.join(global.vwfRoot, 'node_modules/socket.io'));
var reflector = require(path.join(global.vwfRoot, 'lib/nodejs/reflector'));
var vwf       = require(path.join(global.vwfRoot, 'lib/nodejs/vwf'));


// -=-=-=-=-
// socket.io
// -=-=-=-=-

// this setups the vwf's socket.io handler
function installVwfSocketIOManager(server) {
    var socketManager = sio.listen(server, { 
        log: true,
        resource: {
            exec: function( url ) {
                var match = /\/1\/\?t=\d*/.exec( url ) || /\/1\/websocket/.exec( url );
                return match ? [url.substring(0, url.indexOf(match[0]))] : null;
            }
        } 
    });
    socketManager.set( 'transports', [ 'websocket' ] );
    socketManager.set('destroy upgrade', false);
    socketManager.sockets.on( 'connection', reflector.OnConnection );
    return socketManager;
}

// -=-=-
// http
// -=-=-

var vwfRoutes = [
    {route: /[\/]+1.*/}, // socket.io
    {route: '/vwf/*'},
    {route: '/admin/*'},
    {route: '/proxy/*'}, // vwf namespaced "documents"
];

// note: this can be made less brittle if we could use one route for all vwf
// resources. Currently this acts as a whitelist for http request that are
// passed into the vwf http handler

var vwfResources = [
    "compatibilitycheck.js",
    "socket.io.js",
    "socket.io-sessionid-patch.js",
    "require.js",
    "async.js",
    "closure/base.js",
    "closure/vec/float32array.js",
    "closure/vec/float64array.js",
    "closure/vec/vec.js",
    "closure/vec/vec3.js",
    "closure/vec/vec4.js",
    "closure/vec/mat4.js",
    "closure/vec/quaternion.js",
    "crypto.js",
    "md5.js",
    "alea.js",
    "mash.js",
    "Class.create.js",
    "rAF.js",
    "performance.now-polyfill.js",
    "vwf.js",

    // via require.js
    "pace.min.js",
    "jquery-1.10.2.min.js",
    "jquery-encoder-0.1.0.js",
    "jquery-1.10.2.min.map",
    "domReady.js",
    "rsvp.js",
    "logger.js"];

function handleDefaultVWFRequest(req, res) {
    try {
        vwf.Serve(req, res);
    } catch ( e ) {
        console.error("vwf server error: %s", e);
        res.status(500).end(String(e));
    }
}

// FIXME this is currently hardcoded. It is a first attempt to go away from the
// static configuration approach via yml files, e.g. the server could generate
// the resources below after clients specified changes or other configuration

function handleVWFNodeRequest(req, res) {

    var urlMatcher, json, stuff = [{
        match: /\/?index.vwf/, json: {
          "extends": "http://vwf.example.com/node.vwf",
          "properties": {"p": "test"},
          "children": {
            "morph": {
              "extends": "http://vwf.example.com/morph.vwf",
              "properties": {
                "classname": "lively.morphic.Box",
                "position": "lively.pt(10,10)",
                "rotation": 0,
                "opacity": 1,
                "extent": "lively.pt(100,50)",
                "fill": "Color.blue",
                "borderWidth": 2
              }
            }
          },
          "scripts": [""]
        }
    }, {match: /\/?morph.vwf/, json: {
          "extends": "http://vwf.example.com/node2.vwf",
          "properties": {
            "classname": "box",
            "extent": [100,100],
            "fill": [0,0,255],
            "borderWidth": 3,
            "position": [10,10],
            "rotation": 0,
            "opacity": 1
          }
    }}];
    
    for (var i = 0; i < stuff.length; i++) {
        if (!req.url.match(stuff[i].match)) continue;
        if (!req.query.callback) res.json(stuff[i].json);
        else res.end(req.query.callback + '(' + JSON.stringify(stuff[i].json) + ');');
        return true;
    }

    return false;
}

function installVwfHttpHandlers(app) {
    
    app.get('*', function(req, res, next) {
        if (handleVWFNodeRequest(req, res)) return;

        // could be solved better using specific resource route, see above
        var isVWFRequest = vwfResources.indexOf(req.url.replace(/^[\/]+/, '')) > -1;
        if (isVWFRequest) { handleDefaultVWFRequest(req, res); return; }

        next();
    });

    vwfRoutes.forEach(function(rule) {
        var methods = rule.methods || ['GET'];
        methods.forEach(function(method) {
            app[method.toLowerCase()](rule.route, handleDefaultVWFRequest);
        });
    });

}

module.exports = function install(server, app) {

    var socketManager = installVwfSocketIOManager(server);
    installVwfHttpHandlers(app);

    return {
        socketManager: socketManager,
        vwfRoot: global.vwfRoot,
        instances: global.instances
    }
};
