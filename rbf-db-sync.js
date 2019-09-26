"use strict";

const fs = require("fs");
const Client = require('pg-native')

const connectionString = "postgres://appli:Cho317X+@meteoppgdb002.thcore.pamgservices.net:5432/rgi_gladheid_2006";

const customers = require('./api/customers-single.json');

const client = new Client({
     connectionString: connectionString
});

//text queries
var rows = client.querySync('SELECT NOW() AS the_date')
console.log(rows[0].the_date) //Tue Sep 16 2014 23:42:39 GMT-0400 (EDT)

//parameterized queries
var rows = client.querySync('SELECT $1::text as twitter_handle', ['@briancarlson'])
console.log(rows[0].twitter_handle) //@briancarlson

//prepared statements
client.prepareSync('get_twitter', 'SELECT $1::text as twitter_handle', 1)

var rows = client.executeSync('get_twitter', ['@briancarlson'])
console.log(rows[0].twitter_handle) //@briancarlson

var rows = client.executeSync('get_twitter', ['@realcarrotfacts'])
console.log(rows[0].twitter_handle) //@realcarrotfacts







//console.log(customers);

customers.forEach((customer) => {
  dbQuery(customer.customerId, customer.routes);
});


function dbQuery(customerId, routes){

  if(!(customerId && routes.length)){
    return;
  }

  console.log('Query for customer', customerId, ' routes: ', routes.join(','));

  const filename = 'customer-json/' + customerId + '.json';


  client.connectSync(function(err) {
    if(err) throw err

    console.log('connected!')
  });

  var rows = client.querySync('select th.thermalsectionid as id, th.route::int as route, ST_AsGeoJSON(the_geom) as geometry' +
  ' FROM thermalsection th' +
  ' inner join route rt on th.route = rt.routeid' +
  ' where rt.active = 1 and rt.routeid = ANY($1::int[])', [routes]);

  if(rows)
    function (err, result) {
      if (err) {
          console.log(err);
          client.end(function() {
            console.log('client ended') // client ended
          })
          process.exit(1);
      }
      saveToFile(result.rows, filename);
      client.end(function() {
        console.log('client ended') // client ended
      })
  });
}

let basicGeoJson = {
  "type": "FeatureCollection",
  "features": []
};

function saveToFile(rows, filename){

  console.log('save to file:', filename);

  let geoJson = basicGeoJson;

  const features = [];
  rows.forEach(row => {
    let feature = {
      "type": "Feature",
      "id": row.id,
      "properties": {
        "route": row.route,
        "thermalsectionid": row.id
      },
      "geometry": JSON.parse(row.geometry)
    };

    features.push(feature);
  });

  geoJson.features = features;

  let fileData = JSON.stringify(geoJson);
  fs.writeFileSync(filename, fileData);
}
