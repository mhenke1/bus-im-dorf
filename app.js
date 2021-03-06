'use strict';

let express = require('express');
let app = express();
let Promise = require('bluebird');
let needle = require('needle');
const NodeCache = require('node-cache');
const departureCache = new NodeCache({stdTTL: 60, checkperiod: 120});
const lines=['2','12','7']

const requestString = 'http://efa2.naldo.de/naldo/XSLT_DM_REQUEST?language=de&useRealtime=1&mode=direct&type_dm=stop&name_dm=${%20Reutlingen%20}%20${%20Im%20Dorf%20}&mId=efa_rc2&outputFormat=JSON&line=tub:07002:%20:H:j17&line=tub:07007:%20:H:j17&line=tub:07012:%20:R:j17&limit=20;';

function extractTime (departure) {
  let depTime = departure.realDateTime || departure.dateTime;
  let minute = depTime.minute;
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  return depTime.hour + ':' + minute;
}

function extractDeparturesForLine(departuresList, line) {
  let lineDeps = departuresList.filter((dep) => (dep.servingLine.number === line))
    .slice(0, 2).map((dep) => extractTime(dep)).join(' ');
  return lineDeps
}

function extractDepartures (departuresList, lines) {
  let departures = new Map();
  lines.forEach(line => {
    let lineDeps = extractDeparturesForLine(departuresList, line)
    departures.set(line, lineDeps);
  });
  return departures;
}

function getDepartures () {
  return new Promise((resolve, reject) => {
    needle('get', requestString)
      .then((response) => {
        let answer = JSON.parse(response.body);
        let departures = extractDepartures(answer.departureList, lines);
        let line12Departures = "FÄHRT HEUTE NICHT"
        if (departures.get('12')) {
          line12Departures = departures.get('12')
        }
        resolve(
          {
            'frames': [
              {
                'text': '2 ' + departures.get('2'),
                'icon': 'a6175',
                'index': 0,
              },
              {
                'text': '12 ' + line12Departures,
                'icon': 'a6175',
                'index': 1,
              },
              {
                'text': '7 ' + departures.get('7'),
                'icon': 'a6175',
                'index': 2,
              },
            ],
          });
      });
  });
};

app.get('/departures', function (request, response) {
  if (departureCache.get('departures')) {
    response.send(departureCache.get('departures'));
  }
  else {
    getDepartures()
      .then((result) => {
        departureCache.set('departures', result);
        response.json(result);
      })
      .catch((error) =>
        response.json(
          {
            'frames': [
              {
                'text': 'Error',
                'icon': 'a6175',
                'index': 0,
              },
            ],
          }));
  }
});

// load local VCAP configuration  and service credentials
let vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log('Loaded local VCAP', vcapLocal);
}
catch (e) {}

let port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('To view your app, open this link in your browser: http://localhost:' + port);
});

