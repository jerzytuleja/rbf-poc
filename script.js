const CDN = "http://localhost:8080";
// const CDN = "https://d3ex4p301q2zn9.cloudfront.net";

const API = "http://localhost:8080/api";
// const API = "http://10.30.162.7:8080"; // usually Łukasz's server

const RbfSource = "rbf-source";
const RbfLayer = "rbf";
const useExternalApi = !API.includes('localhost');

const roadData = {};
let metadata = {};
const urlParams = new URLSearchParams(location.search)
let activeRoutes = urlParams.get("route") ? urlParams.get("route").split(",").map((x) => parseInt(x, 10)) : [];
var allRoutes = [];

// Create a popup, but don't add it to the map yet.
var popup = new mapboxgl.Popup({
  closeButton: false
});
var filterEl = document.getElementById("feature-filter");
var listingEl = document.getElementById("feature-listing");

function renderListings(routes) {
  // Clear any existing listings
  listingEl.innerHTML = "";
  if (routes.length) {
    routes.forEach(function (route) {
      var item = document.createElement("a");
      item.textContent = route;
      if (activeRoutes.includes(route)) {
        item.classList.add("active");
      }
      item.addEventListener("click", function () {
        toggleActiveRoute(route);
        // Highlight corresponding feature on the map
        /* popup
          .setLngLat(feature.geometry.coordinates)
          .setText(feature.properties.route)
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

function toggleActiveRoute(route) {
  if (activeRoutes.includes(route)) {
    activeRoutes = activeRoutes.filter(e => e !== route);
    listingEl.querySelector('.active').classList.remove('active');
  } else {
    activeRoutes.push(route);
    listingEl.querySelectorAll('a').forEach((item) => {
      if (item.innerHTML === route.toString()) {
        item.classList.add("active");
      }
    });
  }

  if (activeRoutes.length > 0) {
    urlParams.set('route', activeRoutes.join(','));
  } else {
    urlParams.delete('route');
  }

  window.history.replaceState({}, '', location.pathname + '?' + urlParams);

  if (activeRoutes.length) {
    map.setFilter(RbfLayer, ["in", "route", ...activeRoutes]);
  } else {
    map.setFilter(RbfLayer, null);
  }
  fetchRoadData(activeRoutes);
}

function loadAllData() {
  fetchRoadData(allRoutes);
}

function fetchRoadData(routes) {
  if (!routes.length) {
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
  if (!RbfLayer || !map.getLayer(RbfLayer) || !roadData || !Object.keys(roadData).length) {
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

fetch(CDN + "/resource/rbf/tiles/metadata.json")
  .then(response => {
    return response.json();
  })
  .then(data => {
    metadata = data;
    metadata.minzoom = parseInt(metadata.minzoom, 10);
    metadata.maxzoom = parseInt(metadata.maxzoom, 10);
    metadata.json = JSON.parse(metadata.json);

    console.log('metadata', metadata);

    fetch(useExternalApi ? `${API}/road` : `${API}/road.json`)
      .then(response => {
        return response.json();
      })
      .then((data) => {
        if (allRoutes.length) {
          return;
        }
        allRoutes = data.map((routeEntry) => routeEntry.routeid)
          .sort((a, b) => a - b);
        // .filter((routeId) => tileRoutes.includes(routeId));

        renderListings(allRoutes);
        // fetchRoadData(allRoutes);
      });
  });

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
  map.addSource(RbfSource, {
    type: "vector",
    tiles: [CDN + "/resource/rbf/tiles/{z}/{x}/{y}.pbf"],
    minzoom: metadata.minzoom,
    maxzoom: metadata.maxzoom,
    maxBounds: () => {
      const bbox = metadata.maxBounds.split(",");
      return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    }
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
      "line-width": {
        stops: [[5, 1], [10, 5], [15, 10]]
      },
      "line-color": 'gray'
    }
  });
  updateLayerStyle();

  if (activeRoutes.length > 0) {
    map.setFilter(RbfLayer, ["in", "route", ...activeRoutes]);
    fetchRoadData(activeRoutes);
  }

  filterEl.addEventListener("keyup", function (e) {
    var value = e.target.value;

    var filtered = allRoutes.filter(route => {
      let contains = route.toString().includes(value);
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
