//const CDN = "https://localhost:9080";
const CDN = "https://d3ex4p301q2zn9.cloudfront.net";

//const API = "https://localhost:9080/api";
const API = "https://d3ex4p301q2zn9.cloudfront.net/api";
// const API = "http://10.30.162.7:8080"; // usually Łukasz's server

const RbfSource = "rbf-source";
const RbfLayer = "rbf";
const useExternalApi = !API.includes('localhost');

const urlParams = new URLSearchParams(location.search)
let hoveredStateId = null;

let mapLoaded = false;
const roadData = {};
let metadata = [];

const filteredCustomers = [4841, 3809, 3811, 4904, 3777];
let activeCustomers = urlParams.get("customer") ? urlParams.get("customer").split(",").map((x) => parseInt(x, 10)) : [filteredCustomers[0]];
let allCustomers = [];
let allRoutes = [];

const timeseriesSize = 24;
let activeTimeserie = 0;

const parameters = ['ts', 'cs', 't', 'c'];
let activeParameter = parameters[2];

//const allSeries = ['opt0', 'opt1', 'opt2', 'opt3', 'opt3.1', 'opt3.2', 'opt3.3', 'opt3.4', 'opt3.5', 'opt3.6'];
//const lineColours = ['red', 'blue', 'green', 'orange', 'maroon', 'cyan', 'olive', 'purple', 'magenta', 'lime'];
const allSeries = ['opt0', 'opt2', 'opt6'];
const lineColours = ['red', 'green','purple'];
let activeSeries = [allSeries[2]];

let refreshIntervalId;
let isAnimating = false;
const animationSpeed = 500;

// Create a popup, but don't add it to the map yet.
var popup = new mapboxgl.Popup({
  closeButton: false
});
var filterEl = document.getElementById("feature-filter");
var listingEl = document.getElementById("feature-listing");
var timelineEl = document.getElementById("feature-timeline");
var selectorEl = document.getElementById("feature-selector");
var seriesEl = document.getElementById("feature-series");

function renderListings(customers) {
  // Clear any existing listings
  listingEl.innerHTML = "";
  if (customers.length) {
    customers.forEach(function (customer) {
      var item = document.createElement("a");
      item.dataset.customerId = customer.customerId;
      item.textContent = customer.customerId + ' - ' + customer.name;

      if (activeCustomers.includes(customer.customerId)) {
        item.classList.add("active");
      }
      item.addEventListener("click", function () {
        toggleActiveCustomer(customer.customerId);
        // Highlight corresponding feature on the map
        /* popup
          .setLngLat(feature.geometry.coordinates)
          .setText(feature.properties.customer)
          .addTo(map); */
      });
      listingEl.appendChild(item);
    });

    // Show the filter input
    filterEl.parentNode.style.display = "block";
  } else {
    var empty = document.createElement("p");
    empty.textContent = "Drag the map to populate results";
    listingEl.appendChild(empty);

    // Hide the filter input
    filterEl.parentNode.style.display = "none";
  }
}

function toggleActiveCustomer(customerId) {

  activeCustomers.forEach(customerId => {
    removeLayer(customerId);
  })
  if(listingEl.querySelector('.active')){
    listingEl.querySelector('.active').classList.remove('active');
  }

  if (activeCustomers.includes(customerId)) {
    activeCustomers = activeCustomers.filter(e => e !== customerId);
  } else {
    activeCustomers[0] = customerId;
    listingEl.querySelectorAll('a').forEach((item) => {
      if (item.dataset.customerId === customerId.toString()) {
        item.classList.add("active");
      }
    });
    allSeries.forEach((serieId, index) => {
      addLayer(customerId, serieId, lineColours[index]);
    })
  }

  if (activeCustomers.length > 0) {
    urlParams.set('customer', activeCustomers.join(','));
  } else {
    urlParams.delete('customer');
  }

  window.history.replaceState({}, '', location.pathname + '?' + urlParams);
}

function updateLayerStyle() {
  const parameter = activeParameter;
  const offset = activeTimeserie;

  let filter;
  if( parameter === 'cs' || parameter === 'ts'){
    filter = parameter;
  } else {
    filter = parameter+offset;
  }
  console.log(filter);

  activeCustomers.forEach(customerId => {
    activeSeries.forEach(serieId => {
      map.setPaintProperty(RbfLayer+customerId+'-'+serieId, 'line-color', [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        "purple",
        [
          "interpolate-lab",
          ["linear"],
          ["to-number", ["get", filter]],
          -10, 'gray',
          -5, 'red',
          0, 'orange',
          10, 'yellow',
          15, 'green'
        ]
      ]);
    })
  });
}

function setSerieOpacity(serieId, opacity) {
  activeCustomers.forEach(customer => {
    map.setPaintProperty(RbfLayer+customer+'-'+serieId, 'line-opacity', opacity);
  });
}

fetch(
  API + "/customers.json"
)
  .then(response => {
    return response.json();
  })
  .then(customers => {
    if (allCustomers.length) {
      return;
    }
    if( filteredCustomers ){
      allCustomers = customers.filter((customer) => filteredCustomers.includes(customer.customerId));
    } else {
      allCustomers = customers;
    }
    // allCustomers = customers.map((customerEntry) => customerEntry.customerId)
    //   .sort((a, b) => a - b);

    console.log('customers', allCustomers);

    renderListings(allCustomers);
    renderSeries(allSeries);
  });

addLayer = (customerId, serieId, color = 'gray') => {
  if(!(mapLoaded && !!customerId)) {
    return;
  }
  console.log('addLayer', mapLoaded, customerId);

  var resourceKey = customerId+"-"+serieId;

  fetch(
    CDN + "/resource/compare-tiles/" + resourceKey + "/metadata.json"
  )
    .then(response => {
      return response.json();
    })
    .then(data => {

      const tmpmetadata = data;
      tmpmetadata.minzoom = parseInt(tmpmetadata.minzoom, 10);
      tmpmetadata.maxzoom = parseInt(tmpmetadata.maxzoom, 10);
      tmpmetadata.json = JSON.parse(tmpmetadata.json);

      if( !metadata[customerId] ){
        metadata[customerId] = [];
      }
      if( !metadata[customerId][serieId] ){
        metadata[customerId][serieId] = {}
      }

      metadata[customerId][serieId].metadata = tmpmetadata;

      console.log('metadata', tmpmetadata);
    })
    .then(()=>{
      const bbox = metadata[customerId][serieId].metadata.bounds.split(",").map((bound) => parseFloat(bound, 10));

      fetch(
        CDN + "/resource/compare-tiles/" + resourceKey + "/stats.json"
      )
        .then(response => {
          return response.json();
        })
        .then(data => {
          meta = metadata[customerId][serieId].metadata;
          meta.stats = data;

          const serieInfo = seriesEl.querySelector('div.serie[data-serie-id="'+serieId+'"] .info span');
          //serieInfo.textContent = meta.stats["file-count"] + " / " + meta.stats["size"] + " | minZoom: " + meta.minzoom  + " | maxZoom: " + meta.maxzoom;
          serieInfo.textContent = "Tile:" + meta.stats["file-count"] + " / " + meta.stats["size"] + " files";
        })

      map.addSource(RbfSource+resourceKey, {
        type: "vector",
        tiles: [
          CDN + "/resource/compare-tiles/" + resourceKey + "/{z}/{x}/{y}.pbf"
        ],
        minzoom: metadata[customerId][serieId].metadata.minzoom,
        maxzoom: metadata[customerId][serieId].metadata.maxzoom,
        bounds: bbox
      });

      map.addLayer({
        id: RbfLayer+resourceKey,
        type: "line",
        source: RbfSource+resourceKey,
        "source-layer": "geojsonLayer",
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 5, 2, 18, 32],
          "line-color": color,
          "line-opacity": activeSeries.includes(serieId) ? 1 : 0
        },
        bounds: bbox
      });

      map.fitBounds(metadata[customerId][serieId].metadata.bounds.split(','), { padding: 100 })


      map.on("click", RbfLayer+resourceKey, function (e) {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [RbfLayer+resourceKey]
        });

        console.log('features', features);

        console.log(
          map.querySourceFeatures(RbfSource+resourceKey)
        );

        console.log(
          "Click, RouteId",
          features
            .map(feature => feature.properties.route)
            .filter(
              (item, index, list) => !!item && list.indexOf(item) === index
            )
        );

        console.log(
          "Thermal Section Id",
          features
            .map(feature => feature.properties.thermalsectionid)
            .filter(
              (item, index, list) => !!item && list.indexOf(item) === index
            )
        );
      });

      map.on("mousemove", RbfLayer+resourceKey, e => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features.length > 0) {
          if (hoveredStateId) {
            // set the hover attribute to false with feature state

            activeCustomers.forEach(customerId => {
              allSeries.forEach((serieId, index) => {
                map.setFeatureState(
                  {
                    source: RbfSource+customerId+"-"+serieId,
                    sourceLayer: "geojsonLayer",
                    id: hoveredStateId
                  },
                  {
                    hover: false
                  }
                );
              });
            });
          }

          hoveredStateId = e.features[0].id;
          // set the hover attribute to true with feature state
          map.setFeatureState(
            {
              source: RbfSource+resourceKey,
              sourceLayer: "geojsonLayer",
              id: hoveredStateId
            },
            {
              hover: true
            }
          );
        }
      });


      /* var activeCustomer = allCustomers.filter((customer) => customer.customerId === customerId)[0];
      fetchRoadData(activeCustomer.customerId, activeCustomer.routes); */

      renderTimeline();
      renderSelector();
      // map.showTileBoundaries = true;
    });
}


removeLayer = (customerId, serieId) => {
  if( !customerId ){
    return;
  }

  if( serieId ){
    const resourceKey = customerId+"-"+serieId;
    if(map.getLayer(RbfLayer+resourceKey)){
      map.removeLayer(RbfLayer+resourceKey);
      map.removeSource(RbfSource+resourceKey);
    }
  } else {
    activeSeries.forEach(serieId => {
      const resourceKey = customerId+"-"+serieId;
      if(map.getLayer(RbfLayer+resourceKey)){
        map.removeLayer(RbfLayer+resourceKey);
        map.removeSource(RbfSource+resourceKey);
      }
    })
  }
}

renderSelector = () => {
  // Clear any existing listings
  selectorEl.innerHTML = "";

  var select = document.createElement("select");
  select.addEventListener("selectionchange", function () {
    activeParameter = 'ts';
    updateLayerStyle();
  });

  parameters.forEach(function (param) {
    var item = document.createElement("option");
    item.textContent = param;
    select.appendChild(item);
  });

  selectorEl.appendChild(select);
}

renderTimeline = () => {
  // Clear any existing listings
  timelineEl.innerHTML = "";

  var play = document.createElement("a");
  play.classList.add('play');
  play.addEventListener("click", function () {
    if( isAnimating ){
      play.classList.remove('stop');
    } else {
      play.classList.add('stop');
    }
    animateTimeserie();
  });
  timelineEl.appendChild(play);


  [...Array(timeseriesSize).keys()].forEach(function (offset) {
    var item = document.createElement("a");
    item.dataset.timeoffset = offset;
    item.textContent = offset;

    if (activeTimeserie == offset) {
      item.classList.add("active");
    }
    item.addEventListener("click", function () {
      toggleActiveTimeserie(offset);
      // Highlight corresponding feature on the map
      /* popup
        .setLngLat(feature.geometry.coordinates)
        .setText(feature.properties.customer)
        .addTo(map); */
    });
    timelineEl.appendChild(item);
  });
}

function toggleActiveTimeserie(timeserie) {

  if(timelineEl.querySelector('.active')){
    timelineEl.querySelector('.active').classList.remove('active');
  }

  timelineEl.querySelector('a[data-timeoffset="'+timeserie+'"]').classList.add('active');

  activeTimeserie = timeserie;
  updateLayerStyle();
}

function animateTimeserie() {

  if(isAnimating){
    clearInterval(refreshIntervalId);
  } else{
    refreshIntervalId = setInterval(animate, animationSpeed);
  }

  isAnimating = !isAnimating;
}

function animate() {

  if( activeTimeserie === timeseriesSize-1){
    activeTimeserie = 0;
    toggleActiveTimeserie(activeTimeserie);
  } else{
    toggleActiveTimeserie(activeTimeserie+1);
  }

}

renderSeries = () => {
  // Clear any existing listings
  seriesEl.innerHTML = "";

  allSeries.forEach(function (serieId, index) {

    var serie = document.createElement("div");
    serie.classList.add('serie');
    serie.dataset.serieId = serieId;

    if (activeSeries.includes(serieId)) {
      serie.classList.add("active");
    }

    var item = document.createElement("a");
    item.textContent = serieId;
    item.dataset.serieId = serieId;

    var span = document.createElement("span");
    span.style.backgroundColor = lineColours[index];

    item.addEventListener("click", function () {
      toggleActiveSerie(serieId);
    });

    var slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("min", 0);
    slider.setAttribute("max", 100);
    slider.setAttribute("step", 5);
    slider.setAttribute("value", 100);

    var label = document.createElement("label");
    label.innerHTML = "100%";

    slider.addEventListener('input', function(e) {
      setSerieOpacity(serieId, parseInt(e.target.value, 10) / 100);

      // Value indicator
      label.textContent = e.target.value + '%';
    });

    var info = document.createElement("div");
    info.classList.add("info");
    info.innerHTML = "<span></span>";

    info.addEventListener('mouseover', function(e) {
      const allInfo = seriesEl.querySelectorAll('.info');
      allInfo.forEach(inf => {
        inf.classList.add('hover');
      })
    });

    info.addEventListener('mouseout', function(e) {
      const allInfo = seriesEl.querySelectorAll('.info');
      allInfo.forEach(inf => {
          inf.classList.remove('hover');
      })
    });

    serie.appendChild(span);
    serie.appendChild(item);
    serie.appendChild(slider);
    serie.appendChild(label);
    serie.appendChild(info);

    seriesEl.appendChild(serie);
  });
}

/* function toggleActiveSerie(serieId) {
  if( activeSeries.includes(serieId) ){
    return;
  }

  if(seriesEl.querySelector('.active')){
    seriesEl.querySelector('.active').classList.remove('active');
  }

  seriesEl.querySelector('a[data-serie-id="'+serieId+'"]').classList.add('active');

  activeSeries = seriesEl;
  setActiveSerie(serieId);
}
 */

function toggleActiveSerie(serieId) {

  if( activeSeries.includes(serieId) ){
    seriesEl.querySelector('div.serie[data-serie-id="'+serieId+'"]').classList.remove('active');
    activeSeries = activeSeries.filter(e => e !== serieId);

    if (activeCustomers.length > 0) {
      activeCustomers.forEach(customerId => {
        setSerieOpacity(serieId, 0);
      });
    }
  } else {
    const serie = seriesEl.querySelector('div.serie[data-serie-id="'+serieId+'"]');
    serie.classList.add('active');
    const opacity = serie.querySelector('input').value / 100;

    activeSeries.push(serieId);
    if (activeCustomers.length > 0) {
      activeCustomers.forEach(customerId => {
        setSerieOpacity(serieId, opacity);
      });
    }
  }
}

mapboxgl.accessToken =
  "pk.eyJ1IjoiZGFlZGhvciIsImEiOiJjamNpd3V5bGQydWt6MndvMnpvdTZvMnBjIn0.UhKKcIfsmdOj3wFgwTEq6g";
let map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v10",
  zoom: 6,
  center: [-4.954834, 51.801821]
});

map.on("load", function () {
  mapLoaded = true;

  if (activeCustomers.length > 0 && activeSeries.length > 0) {
    console.log( activeCustomers, activeSeries);

    activeCustomers.forEach(customerId => {
      allSeries.forEach((serieId, index) => {
        addLayer(customerId, serieId, lineColours[index]);
      });
    });
  }

  filterEl.addEventListener("keyup", function (e) {
    var value = e.target.value;

    var filtered = allCustomers.filter(customer => {
      let contains = customer.name.includes(value) || customer.customerId.toString().includes(value);
      return !!contains;
    });
    // Populate the sidebar with filtered results
    renderListings(filtered);
  });
});
