new Vue({
  el: '#app',

  data() {
    return {
      isGeolocation: false,
      map: null,
      marker: null,
      message: 'Get my location',
      marker: './assets/BarclaysMarker.png',
      points: [],
      markers: [],
      origins: {
        lat: -0.12,
        lng: 51.1000
      },
      geoOptions: {
        enableHighAccuracy: true,
        maximumAge        : 30000,
        timeout           : 27000
      },
      watchId: null,
      listOfPoints: []
    }
  },

  mounted() {
    this.fetchPoints();
  },

  methods: {
    geoPosition() {
      this.isGeolocation = false;
      this.watchId = navigator.geolocation.getCurrentPosition(this.geoSuccess, this.geoError, this.geoOptions);
    },

    geoSuccess(position) {
      this.origins.lng = position.coords.latitude;
      this.origins.lat = position.coords.longitude;
    },

    geoError() {
      console.log('No position');
    },

    async fetchPoints() {
      let response;

      try {
        response = await this
          .$http.get(`http://localhost:8080/api/v1.0/atms?lat=${this.origins.lat}&lon=${this.origins.lng}`)
          .then(response => response);
      } catch (error) {
        console.log(error);
        this.isGeolocation = true;
        return
      }

      this.isGeolocation = true;
      this.points = response.body.points;
      this.image = {
        url: this.marker,
        size: new google.maps.Size(32, 48),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(12, 48),
      };
      this.markerShape = {
        coords: [17, 48, 4, 27, 1, 17, 5, 7, 10, 3, 17, 1, 26, 3, 31, 7, 35, 17, 32, 26, 17, 48],
        type: 'poly',
      };

      this.map = new google.maps.Map(document.getElementById('map'), {
        center: new google.maps.LatLng(this.origins.lng, this.origins.lat),
        zoom: 12,
        mapTypeId: 'roadmap',
      });

      this.listOfPoints = [];
      let bounds = new google.maps.LatLngBounds();

      await response.body.points.map(async (point, i) => {
        const distance = await this.$http
          .get(this.distanceUrl(point.Location.coordinates)).then(dest => {
            if (dest.status === 200) {
              const result = {
                dist: dest.body.rows[0].elements[0].distance.text,
                dur: dest.body.rows[0].elements[0].duration.text
              }
              return result;
            } else {
              return {};
            }
          })

        let content = this.contentString(point, distance);
        let infowindow = new google.maps.InfoWindow({content});
        const position = new google.maps.LatLng(point.Location.coordinates[1], point.Location.coordinates[0]);

        const marker = new google.maps.Marker({
          position,
          animation: google.maps.Animation.DROP,
          icon: this.image,
          shape: this.markerShape,
          map: this.map,
          infowindow
        });
        marker.id = point._id;

        let _self = this;
        google.maps.event.addListener(marker, 'click', function() {
          _self.hideAllInfoWindows();
          this.infowindow.open(this.map, this);
        });

        bounds.extend(position);
        this.markers.push(marker);
        this.map.setCenter(bounds.getCenter());
        this.map.fitBounds(bounds);

        this.listOfPoints.push({ content: this.contentString(point, distance, false), id: point._id })
      })

      this.isGeolocation = true;
    },

    listItemClick(e) {
      const id = e.target.closest('li').id;
      let bounds = new google.maps.LatLngBounds();
      const markerIndex = this.markers.findIndex(m => m.id === id);
      bounds.extend(this.markers[markerIndex].position);
      this.map.fitBounds(bounds);

      zoomChangeBoundsListener = google.maps.event.addListenerOnce(this.map, 'bounds_changed', function(event) {
        if (this.getZoom()) this.setZoom(16);
      });

      setTimeout(function(){google.maps.event.removeListener(zoomChangeBoundsListener)}, 2000);
    },

    listItemClickAll() {
      this.hideAllInfoWindows();
      let bounds = new google.maps.LatLngBounds();
      this.markers.map(m => {
        bounds.extend(m.position);
        this.map.setCenter(bounds.getCenter());
      })
      this.map.fitBounds(bounds);
    },

    /**
     * Addressee's name
     * House number and street name
     * City or town
     * Province, state or department and postal code
     * COUNTRY (please print in capitals & use English name)
     */
    contentString(Point, distance = {}, content = true) {
      const { BuildingNumber, StreetName, Country, TownName, PostCode} = Point.PostalAddress;
      const { Branch } = Point;

      Photo = (Branch && Branch[0]) ? Branch[0].Photo : './assets/BarclaysLogo240.svg';

      if (!content) {
        return `
        <div class="container info-container" id="${Point._id}">
          <div class="row">
            <div class="u-max-full-width">
              <strong><small>${Branch[0] && Branch[0].Name || ''} ${Country}</small></strong>
              <p>${[
                    BuildingNumber || '',
                    StreetName || '',
                    TownName && TownName.toUpperCase() || '',
                    PostCode || ''
                  ].join(' ')}
              </p>
              <p>${distance ? `<i class="walking"></i> ${distance.dist} / ${distance.dur}` : ''}</p>
            </div>
          </div>
        </div>
        `;
      }

      return `
      <div class="container info-container"">
        <div class="row">
          <div class="four columns photo">
            <img class="u-max-full-width${Branch && Branch.Photo ? '' : ' barclays'}" src="${Photo}" />
          </div>
          <div class="eight columns">
            <div class="row">
              <div class="u-full-width">
                <h5>${Branch && Branch.Name || ''} <small>${Country}</small></h5>
              </div>
              <duv class="u-full-width">
                <h6>${[BuildingNumber || '', StreetName || ''].join(' ')}</h6>
                <h6>${TownName && TownName.toUpperCase() || ''}</h6>
                <h6>${PostCode || ''}</h6>
                ${distance ? `<i class="walking"></i> ${distance.dist} / ${distance.dur}` : ''}
              </duv>
            </div>
          </div>
        </div>
      </div>
      `;
    },

    hideAllInfoWindows() {
      this.markers.map(marker => marker.infowindow.close(this.map, marker));
    },

    distanceUrl(destination) {
      const baseURL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
      const tail = '&mode=walking&language=en-UK&units=imperial';
      const url = `${baseURL}?origins=${this.origins.lng},${this.origins.lat}&destinations=${destination[1]},${destination[0]}${tail}`;

      return url;
    }
  },

  watch: {
    origins: {
      handler: function (val, oldVal) {
        this.fetchPoints();
      },
      deep: true
    }
  }
})
