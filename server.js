var express = require('express');
var expressGZip = require('express-static-gzip');
var compression = require('compression');
var path = require('path');

var app = express();

app.get('/resource/rbf/tiles/metadata.json', function(req, res) {
  res.sendFile(path.join(__dirname + '/tiles/metadata.json'));
});

app.use(compression());
app.use('/resource/rbf/tiles', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Encoding', 'gzip');
    return expressGZip('./tiles')(req, res, next);
});
app.use('/resource/rbf_forecast', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Encoding', 'gzip');
    return expressGZip('./tiles2')(req, res, next);
});

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

app.listen(8080, () => {
    console.log('open localhost at port 8080 in web browser')
});
