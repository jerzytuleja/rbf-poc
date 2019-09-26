"use strict";

const fs = require("fs");
const { Client } = require('pg');

const connectionString = "postgres://appli:Cho317X+@meteoppgdb002.thcore.pamgservices.net:5432/rgi_gladheid_2006";
const client = new Client({
  connectionString: connectionString
});

const customers = require('./api/customers.json');
//console.log(customers);

client.connect();

let queryPromise = Promise.resolve();

customers.forEach((customer) => {
  queryPromise = queryPromise.then(() => {
    return dbQuery(customer.customerId, customer.routes);
  });
});

queryPromise.catch(function(error) {
  console.error(error);
  client.end();
  process.exit(1);
});

queryPromise.then(() => {
  client.end();
})

async function dbQuery(customerId, routes){

  if(!(customerId && routes.length)){
    return;
  }

  console.log('Query for customer', customerId, ' routes: ', routes.join(','));

  const filename = 'customer-json/' + customerId + '.json';

  try {
    const result = await client.query('select th.thermalsectionid as id, th.route::int as route, ST_AsGeoJSON(the_geom) as geometry' +
    ' FROM thermalsection th' +
    ' inner join route rt on th.route = rt.routeid' +
    ' where rt.active = 1 and rt.routeid = ANY($1::int[])', [routes]);

    saveToFile(result.rows, filename);
  } catch (err) {
    console.log(err);
  }
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
