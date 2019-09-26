const express = require('express');
const spdy = require('spdy')
const expressGZip = require('express-static-gzip');
const compression = require('compression');
const fs = require('fs')
const path = require('path');

const port = 9080

const options = {
  key: fs.readFileSync(__dirname + '/server.key'),
  cert:  fs.readFileSync(__dirname + '/server.crt')
}

const app = express();
app.use(compression());

app.get('/resource/compare-tiles/:customerId/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/compare-tiles/'+req.params.customerId+'/metadata.json'));
});
app.get('/resource/compare-tiles/:customerId/stats.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/compare-tiles/'+req.params.customerId+'/stats.json'));
});
app.use('/resource/compare-tiles', express.static('compare-tiles', {
  setHeaders: function(res, path) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Content-Encoding",'gzip');
  }
}));

app.get('/resource/rbf/tiles/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/tiles/metadata.json'));
});
app.use('/resource/rbf/tiles', express.static('tiles', {
  setHeaders: function(res, path) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Content-Encoding",'gzip');
  }
}));

app.get('/resource/rbf_forecast3/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/ddtiles/metadata.json'));
});
app.use('/resource/rbf/rbf_forecast3', express.static('ddtiles', {
  setHeaders: function(res, path) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Content-Encoding",'gzip');
  }
}));

app.get('/resource/customer-tiles/:customerId/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/customer-tiles/'+req.params.customerId+'/metadata.json'));
});
app.use('/resource/rbf/customer-tiles', express.static('customer-tiles', {
  setHeaders: function(res, path) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Content-Encoding",'gzip');
  }
}));

app.get('/resource/customer-base-tiles/:customerId/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/customer-base-tiles/'+req.params.customerId+'/metadata.json'));
});
app.use('/resource/rbf/customer-base-tiles', express.static('customer-base-tiles', {
  setHeaders: function(res, path) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Content-Encoding",'gzip');
  }
}));

app.use(express.static('./'));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
  });


app.get('/rbf.html', function(req, res) {
    res.sendFile(path.join(__dirname + '/rbf.html'));
});

app.get('/api/forecast', function(req, res) {
    res.sendFile(path.join(__dirname + '/api/forecast/' + req.query.road + '.json'));
});

app.get('/api/road', function(req, res) {
    res.sendFile(path.join(__dirname + '/api/road.json'));
});

app.get('/api/customers', function(req, res) {
  res.sendFile(path.join(__dirname + '/api/customers.json'));
});

spdy
  .createServer(options, app)
  .listen(port, (error) => {
    if (error) {
      console.error(error)
      return process.exit(1)
    } else {
      console.log('Listening on port: ' + port + '.')
    }
  })

/* app.listen(port, () => {
    console.log('open localhost at port 9080 in web browser')
}); */
