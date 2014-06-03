Currently intended to be consumed by express / restify like application. The `vwfAdapter` function will register http and socket.js handlers for the server the user passed in. The server can otherwise be configured as needed, no special port / hostname required.

```js
var express = require('express');
var app = express();
var server = require('http').http.createServer(app);
var vwfAdapater = require("vwf-adapter");

global.vwfRuntime = vwfAdapater(server, app);
```