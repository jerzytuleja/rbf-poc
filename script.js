//const CDN = "https://localhost:9080";
const CDN = "https://d3ex4p301q2zn9.cloudfront.net";

const API = "https://d3ex4p301q2zn9.cloudfront.net/api";
//const API = "https://localhost:9080/api";
// const API = "http://10.30.162.7:8080"; // usually Łukasz's server

const RbfSource = "rbf-source";
const RbfLayer = "rbf";
const useExternalApi = !API.includes('localhost');

let mapLoaded = false;
const roadData = {};
let metadata;
const urlParams = new URLSearchParams(location.search)
let activeCustomers = urlParams.get("customer") ? urlParams.get("customer").split(",").map((x) => parseInt(x, 10)) : [];
let allCustomers = [];
let allRoutes = [];

//const generatedCustomers = [5781,5662,5625,4903,4841,4840,2082,2081,2080,2060,1378,1175,1141,1059,946,198,177,131,129,124,92,1];

const timeseriesSize = 24;
const parameters = ['ts', 'cs', 't', 'c'];
let activeTimeserie = 0;
let activeParameter = 't';
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

  removeLayer();
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
    addLayer(customerId);
  }

  if (activeCustomers.length > 0) {
    urlParams.set('customer', activeCustomers.join(','));
  } else {
    urlParams.delete('customer');
  }

  window.history.replaceState({}, '', location.pathname + '?' + urlParams);

  //fetchRoadData(activeCustomers);
}

function loadAllData() {
  fetchRoadData(allCustomers);
}

function fetchRoadData(customerId, routes) {
  if (!routes.length || window.approach !== 'join') {
    return;
  }

  const requests = [];
  let progress = 0;

  routes.forEach((route) => {
    if (roadData[route]) {
      requests.push(
        new Promise((resolve) => resolve({ route, data: roadData[route] }))
      )
      return;
    }

    const url = useExternalApi ? `${API}/forecast?road=${route}&date=2019-09-02T22:00:00Z` : `${API}/forecast/${route}.json`

    requests.push(
      fetch(url)
        .then(response => {
          return response.json()
        })
        .then((data) => {
          return {
            route,
            data
          }
        })
    )
  });

  requests.forEach((request) => {
    request.then(() => {
      ++progress;
      console.debug(`Road loading - ${progress}/${requests.length} (${Math.round((progress / requests.length) * 100)}%)`);
    });
  })

  Promise.all(requests)
    .then((data) => {
      let shouldUpdateStyle = false;
      data.forEach((entry) => {
        if (!roadData[entry.route]) {
          shouldUpdateStyle = true;
          roadData[entry.route] = entry.data;
        }
      });

      console.log('roadData', data);
      if (shouldUpdateStyle) {
        updateLayerStyle();
      }
    });
}

function updateLayerStyle() {
  const parameter = activeParameter;
  const offset = activeTimeserie;

  if (window.approach !== 'join') {
    let filter;
    if( parameter === 'cs' || parameter === 'ts'){
      filter = parameter;
    } else {
      filter = parameter+offset;
    }
    console.log(filter);

    map.setPaintProperty(RbfLayer, 'line-color', [
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
    ])
  } else {
    if (!(RbfLayer) || !map.getLayer(RbfLayer) || !roadData || !Object.keys(roadData).length) {
      return;
    }

    const newColor = ["match", ["get", "thermalsectionid"]];
    Object.keys(roadData).forEach((road) => {
      roadData[road].forEach((section) => {
        const color =
          section.tt < 8 ? 'hsl(0, 100%, 50%)' :
            // section.tt < 9 ? 'hsl(10, 100%, 50%)' :
            section.tt < 10 ? 'hsl(20, 100%, 50%)' :
              // section.tt < 11 ? 'hsl(30, 100%, 50%)' :
              section.tt < 12 ? 'hsl(40, 100%, 50%)' :
                // section.tt < 13 ? 'hsl(50, 100%, 50%)' :
                section.tt < 14 ? 'hsl(60, 100%, 50%)' :
                  // section.tt < 15 ? 'hsl(80, 100%, 50%)' :
                  'hsl(100, 100%, 50%)';

        newColor.push(
          section.thermalsection,
          color
        )
      })
    });

    newColor.push('gray');

    map.setPaintProperty(RbfLayer, 'line-color', [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      "purple",
      newColor
    ])
  }
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
    allCustomers = customers;
    //allCustomers = customers.filter((customer) => generatedCustomers.includes(customer.customerId));
    // allCustomers = customers.map((customerEntry) => customerEntry.customerId)
    //   .sort((a, b) => a - b);

    console.log('customers', allCustomers);

    renderListings(allCustomers);
    // fetchRoadData(allRoutes);
  });

addLayer = (customerId) => {
  if(!(mapLoaded && !!customerId)) {
    return;
  }
  console.log('addLayer', mapLoaded, customerId);

  fetch(
    CDN + "/resource/customer-tiles/"+customerId+"/metadata.json"
    /* window.approach === 'join' ?
      CDN + "/resource/rbf/tiles/metadata.json" :
      window.approach === 'data-driven-with-timeline' ?
        CDN + "/resource/rbf_forecast3/metadata.json" :
        CDN + '/resource/rbf_forecast/metadata.json' */
  )
    .then(response => {
      return response.json();
    })
    .then(data => {
      metadata = data;
      metadata.minzoom = parseInt(metadata.minzoom, 10);
      metadata.maxzoom = parseInt(metadata.maxzoom, 10);
      metadata.json = JSON.parse(metadata.json);

      console.log('metadata', metadata);
    })
    .then(()=>{
      const bbox = metadata.bounds.split(",").map((bound) => parseFloat(bound, 10));

      map.addSource(RbfSource, {
        type: "vector",
        tiles: [
          CDN + "/resource/customer-tiles/"+customerId+"/{z}/{x}/{y}.pbf"
          // window.approach === 'join' ?
          //   CDN + "/resource/rbf/tiles/{z}/{x}/{y}.pbf" :
          //   window.approach === 'data-driven-with-timeline' ?
          //     CDN + "/resource/rbf_forecast3/{z}/{x}/{y}.pbf" :
          //     CDN + "/resource/rbf_forecast/{z}/{x}/{y}.pbf"
        ],
        minzoom: metadata.minzoom,
        maxzoom: metadata.maxzoom,
        bounds: bbox
      });

      map.addLayer({
        id: RbfLayer,
        type: "line",
        source: RbfSource,
        "source-layer": "geojsonLayer",
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 5, 2, 18, 16],
          "line-color": 'gray'
        },
        bounds: bbox
      });

      map.fitBounds(metadata.bounds.split(','), { padding: 100 })

      var activeCustomer = allCustomers.filter((customer) => customer.customerId === customerId)[0];
      fetchRoadData(activeCustomer.customerId, activeCustomer.routes);

      renderTimeline();
      //renderSelector();

      updateLayerStyle();
      // map.showTileBoundaries = true;
    });
}


removeLayer = () => {
  if(map.getLayer(RbfLayer)){
    map.removeLayer(RbfLayer);
    map.removeSource(RbfSource);
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


mapboxgl.accessToken =
  "pk.eyJ1IjoiZGFlZGhvciIsImEiOiJjamNpd3V5bGQydWt6MndvMnpvdTZvMnBjIn0.UhKKcIfsmdOj3wFgwTEq6g";
let map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v10",
  zoom: 6,
  center: [-4.954834, 51.801821]
});
let hoveredStateId = null;


map.on("load", function () {
  mapLoaded = true;

  if (activeCustomers.length > 0) {
    activeCustomers.forEach(customerId => {
      addLayer(customerId);
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


map.on("click", RbfLayer, function (e) {
  const features = map.queryRenderedFeatures(e.point, {
    layers: [RbfLayer]
  });

  console.log('features', features);

  console.log(
    map.querySourceFeatures(RbfSource)
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

map.on("mousemove", RbfLayer, e => {
  map.getCanvas().style.cursor = "pointer";
  if (e.features.length > 0) {
    if (hoveredStateId) {
      // set the hover attribute to false with feature state
      map.setFeatureState(
        {
          source: RbfSource,
          sourceLayer: "geojsonLayer",
          id: hoveredStateId
        },
        {
          hover: false
        }
      );
    }

    hoveredStateId = e.features[0].id;
    // set the hover attribute to true with feature state
    map.setFeatureState(
      {
        source: RbfSource,
        sourceLayer: "geojsonLayer",
        id: hoveredStateId
      },
      {
        hover: true
      }
    );
  }
});
