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

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/rbf.html', function(req, res) {
    res.sendFile(path.join(__dirname + '/rbf.html'));
});

app.get('/api/road/:id/:issueDate', function(req, res) {

    res.sendFile(path.join(__dirname + '/api/forecast-road-' + req.params.id + '-'+ req.params.issueDate.replace(/:/g, '') +'.json'));
});

app.listen(8080, () => {
    console.log('open index.html in web browser')
});
