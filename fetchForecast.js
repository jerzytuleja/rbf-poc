const http = require('http');
const fs = require('fs');
const IP = 'http://10.30.162.7:8080';

fs.readFile('api/road.json', 'utf-8', (err, data) => {
  if(err) {
    throw err
  }

  jsonData = JSON.parse(data);
  let finished = 0;

  jsonData.forEach((entry) => {
    const route = entry.routeid;

    fs.readFile(`api/forecast/${route}.json`, 'utf-8', (err) => {
      if (!err) {
        ++finished;
        return;
      }

      http.get(`${IP}/forecast?road=${route}&date=2019-09-02T22:00:00Z`, function (res) {
        if (res.statusCode !== 200) {
          console.log(`Error occured during downloading route ${route}`);
          ++finished;
          res.resume();
          return;
        }

        res.setEncoding('utf8');
        let rawData = '';

        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            fs.writeFile(`api/forecast/${route}.json`, rawData, (err) => {
              ++finished;
              if (err) {
                return console.error(err);
              }
              console.log(`Downloaded route: ${route}; Progress: ${finished}/${jsonData.length} (${Math.round((finished / jsonData.length) * 100)}%)`)
            })
          } catch (e) {
            ++finished;
            console.error(e.message);
          }
        });
      });
    });
  })
});

