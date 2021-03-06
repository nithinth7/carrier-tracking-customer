module.exports = [
  '$rootScope', '$timeout', '$routeParams', '$location', '$filter', 'CommonRequest', 'CommonMoment', 'CommonTracking', 'StorageTracking', 'CommonUi',
  function (
    $rootScope, $timeout, $routeParams, $location, $filter, CommonRequest, CommonMoment, CommonTracking, StorageTracking, CommonUi
  ) {
    'use strict';
    var self = this;

    $rootScope.$on('$languageChangeSuccess', function (event, language) {
      self.data.events.map(function (event) {
        event.moment = CommonMoment(event.timestamp, null, language);
      });
    });

    self.data = StorageTracking.data;
    self.trackingId = StorageTracking.trackingId || '';
    self.availableStates = [
      'LABEL_PRINTED',
      'IN_TRANSIT',
      'HANDOVER',
      'WAREHOUSE',
      'IN_DELIVERY',
      'DELIVERED'
    ];
    self.availableErrorStates = [
      'CANCELLED',
      'NO_HANDOVER',
      'DELIVERY_FAILED',
      'RECEIVER_MOVED'
    ];
    self.showError = false;
    self.state = -1;
    self.errorState = -1;
    self.carrierInfo = null;

    self.packageStates = [{
      tooltip: 'LABEL_PRINTED',
      icon: function () {
        return 'cube';
      },
      isActive: function () {
        return self.state >= 0 || self.errorState > 0;
      },
      showCheckmark: function () {
        return self.state >= 0;
      },
      showCross: function () {
        return self.errorState === 0;
      }
    }, {
      tooltip: 'IN_TRANSIT',
      angle: 'angle-right',
      iconModifier: 'fa-flip-horizontal',
      icon: function () {
        return 'truck';
      },
      isActive: function () {
        return self.state > 0 || self.errorState > 0;
      },
      showCheckmark: function () {
        return self.state > 0;
      }
    }, {
      tooltip: 'HANDOVER_WAREHOUSE',
      angle: 'angle-right',
      icon: function () {
        return 'arrows-alt';
      },
      isActive: function () {
        return self.state > 1 || self.errorState > 1;
      },
      showCheckmark: function () {
        return self.state > 1;
      },
      showCross: function () {
        return self.errorState === 1;
      }
    }, {
      tooltip: 'IN_DELIVERY',
      angle: 'angle-right',
      icon: function () {
        return 'home';
      },
      isActive: function () {
        return self.state > 3;
      },
      showCheckmark: function () {
        return self.state > 3;
      },
      showCross: function () {
        return self.errorState > 1;
      }
    }, {
      tooltip: 'DELIVERED',
      angle: 'angle-right',
      icon: function () {
        return self.state === 5 && false ? 'close' : 'check';
      },
      isActive: function () {
        return self.state === 5;
      },
      showCheckmark: function () {
        return false;
      }
    }];

    var getCarrierInfo = function (events, routes) {
      var lastEvent = events[events.length - 1];
      var carrier = lastEvent.carrier;
      var currentRoute = routes.filter(function (route) {
        return route.route_number === lastEvent.route_number;
      });

      if (currentRoute[0] && currentRoute[0].tracking_url) {
        carrier.tracking_url = currentRoute[0].tracking_url;
      }

      if (carrier.code === 'gls') {
        carrier.country = currentRoute[0].country;
      }
      carrier.country_code = currentRoute[0].country;

      if (carrier.code === 'coureon') {
        carrier.tracking_url = null;
      }

      if (carrier.code === 'hg_logistics'){
        carrier.code = 'coureon';
      }

      return carrier;
    };

    // get trackingId from URL
    if ($routeParams.trackingId) {
      self.trackingId = $routeParams.trackingId;
      StorageTracking.trackingId = self.trackingId;
    }

    if (self.trackingId) {

      self.loadingIndicator = true;

      StorageTracking.track(self.trackingId, function (response) {

        self.loadingIndicator = false;
        self.data = response;
        self.showError = false;
        self.showPrintLabelButton = false;

        if (response && response.events && response.events.length && response.route_information && !!response.route_information.length) {
          self.state = self.availableStates.indexOf(response.status);
          self.errorState = self.availableErrorStates.indexOf(response.status);
          self.carrierInfo = getCarrierInfo(response.events, response.route_information);

          // Only show label print back button when the route Information only contains national routes
          self.showPrintLabelButton = response.route_information.map(function (ri) {
            return ri.country === 'DE';
          }).reduce(function (a, b) {
            return a && b;
          }, true);

        } else {
          self.showError = true;
        }
      },
        function (error) {
          self.data = null;
          self.showError = true;
          self.state = -1;
        });
    }

    self.getStatus = function () {
      if (self.trackingId) {
        CommonTracking.addEvent('track', 'Tracked Shipment', {
          coureonTrackingNumber: self.trackingId
        });
        $location.path('/tracking/' + self.trackingId);
      }
    };

    self.isCurrentActiveEvent = function (event) {
      var lastEvent = self.data.events[self.data.events.length - 1];
      return lastEvent === event;
    };

    self.getCurrentActiveEvent = function () {
      return self.data.events[self.data.events.length - 1];
    };

    self.banner = {
      title: $filter('translate')('SECTION.FOOTER.TITLE'),
      subtitle: $filter('translate')('SECTION.FOOTER.SUBTITLE'),
      trackingId: self.trackingId
    };
  }
];
