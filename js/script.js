new Vue({
  el: '#app',
  data() {
    return {
      isGeolocation: false,
      map: null,
      marker: null,
      message: 'Pre',
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

  created() {

  },

  mounted() {
    this.fetchPoints();
  },

  beforeDestroy() {
    console.log('beforeDestroy');
    // this.markers.map(marker => marker.removeListener('click'))
  },

  methods: {
    geoPosition() {
      this.watchId = navigator.geolocation.getCurrentPosition(this.geoSuccess, this.geoError, this.geoOptions);
    },
    geoSuccess(position) {
      this.origins.lat = position.coords.latitude;
      this.origins.lng = position.coords.longitude;
      this.fetchPoints();
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
        return
      }

      console.log(response);

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

      this.marker = null;

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
              // console.log(dest);
              if (dest.status === 200) {
                const result = {
                  dist: dest.body.rows[0].elements[0].distance.text,
                  dur: dest.body.rows[0].elements[0].duration.text
                }
                console.log(result);
                return result;
              } else {
                return {};
              }
            })

          let content = this.contentString(point, distance);
          // console.log(content);

          let infowindow = new google.maps.InfoWindow({content});

          const position = new google.maps.LatLng(
            point.Location.coordinates[1],
            point.Location.coordinates[0]
          );

          const marker = new google.maps.Marker({
            position,
            animation: google.maps.Animation.DROP,
            icon: this.image,
            shape: this.markerShape,
            map: this.map,
            infowindow
          });
          marker.id = point._id;
          console.log('marker', marker);

          let _self = this;
          google.maps.event.addListener(marker, 'click', function() {
            _self.hideAllInfoWindows();
            this.infowindow.open(this.map, this);
          });

          bounds.extend(position);
          this.markers.push(marker);

          content = this.contentString(point, distance, false);

          this.listOfPoints.push({content, id: point._id})
          this.map.fitBounds(bounds);
      })


      this.message = 'Post'
      this.isGeolocation = true;
    },

    listItemClick(e) {
      console.log(e)
    },
    /**
     * Addressee's name
     * House number and street name
     * City or town
     * Province, state or department and postal code
     * COUNTRY (please print in capitals & use English name)
     */
    contentString(Point, distance = {}, content = true) {
      console.log(Point);
      // Branch, PostalAddress = {}
      const { BuildingNumber, StreetName, Country, TownName, PostCode} = Point.PostalAddress;
      const { Branch } = Point;

      Photo = (Branch && Branch[0]) ? Branch[0].Photo : './assets/BarclaysLogo240.svg';
      console.log(Photo);

      if (!content) {
        return `
        <div class="container info-container" id="${Point._id}>
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
