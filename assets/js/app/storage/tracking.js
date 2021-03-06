module.exports = ['$routeParams', '$location', 'CommonRequest', 'CommonConfig', 'CommonMoment', 'StorageService', function ($routeParams, $location, CommonRequest, CommonConfig, CommonMoment, StorageService) {
  const self = this;

  /**
   * @private
   * @constant carrierDefinitions
   * @type {Object}
   *
   * @description This object holds carrier information, needed for custom events.
   */
  const carrierDefinitions = {
    GLS_DE: {
      carrier_code: 'gls',
      service_codes: ['gls_de_pickup',
        'gls_de_dropoff',
      ],
      tracking_link: 'https://gls-group.eu/DE/de/paketverfolgung?match=',
    },
    GLS_FR: {
      carrier_code: 'gls',
      service_codes: ['gls_fr_dpd_pickup',
        'gls_fr_dpd_dropoff',
        'gls_fr_dhl_dropoff',
        'gls_fr_hermes_pickup',
        'gls_fr_national',
        'gls_fr_ups_express_pickup',
      ],
      tracking_link: 'https://gls-group.eu/FR/fr/suivi-colis?match=',
    },
    GLS_ES: {
      carrier_code: 'gls',
      service_codes: ['gls_es_dpd_pickup',
        'gls_es_dpd_dropoff',
        'gls_es_national',
        'gls_es_dhl_dropoff',
        'gls_es_hermes_pickup',
      ],
      tracking_link: 'https://gls-group.eu/ES/es/seguimiento-de-envios?match=',
    },
    USPS: {
      carrier_code: 'usps',
      service_codes: ['usps_national'],
      tracking_link: 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=',
    },
    DHL: {
      carrier_code: 'dhl',
      service_codes: ['dhl_express_international_worldwide'],
      tracking_link: 'https://nolp.dhl.de/nextt-online-public/set_identcodes.do?lang=en&idc=',
    },
    YODEL: {
      carrier_code: 'yodel',
      service_codes: ['yodel_national'],
      tracking_link: 'http://www.yodel.co.uk/tracking/',
    },
    BPOST: {
      carrier_code: 'bpost',
      service_codes: ['bpost_scan_national', 'bpost_sign_national'],
      tracking_link: 'https://mercury.landmarkglobal.com/tracking/track.php?cid=0936&refid=',
    },
    NEXIVE: {
      carrier_code: 'nexive',
      service_codes: ['nexive_national'],
      tracking_link: 'https://www.sistemacompleto.it/Tracking-Spedizioni-Nexive.aspx?b={0}&lang=IT',
    },
    COLISSIMO: {
      carrier_code: 'colissimo',
      service_codes: ['colissimo_national_sign', 'colissimo_national_scan'],
      tracking_link: 'https://www.laposte.fr/particulier/outils/de/ein-paket-verfolgen?code=',
    },
  };

  /**
   * @member
   * @type {Object}
   * @description This objects holds all tracking data.
   */
  self.data = null;

  const addMomentToEvents = function (selectedLanguage) {
    self.data.events.map((event) => {
      const e = event;
      e.moment = CommonMoment(event.timestamp, null, selectedLanguage);
      return e;
    });
  };

  /**
   * @private
   * @function isCarrierDeliveringOnRoute
   * @param {String} carrierKey A key referencing a carrier.
   * @param {Number} routeNumber A number referencing a route in the route information stack.
   * @returns {Boolean} if carrier is currently delivering on the route.
   *
   * @description This function checks a given carrier delivers on the route number,
   *              that is referenced by the route number.
   */
  const isCarrierDeliveringOnRoute = function (carrierKey, routeNumber) {
    if (routeNumber > self.data.route_information.length) {
      return false;
    }

    const carrierServices = carrierDefinitions[carrierKey].service_codes;
    const serviceForRoute = self.data.route_information[routeNumber - 1].service_code;

    const carrierIsResponsibleForRoute = carrierServices.indexOf(serviceForRoute) > -1;
    const precedingCarrierDelivered = (routeNumber > 1)
      ? self.data.route_information[routeNumber - 2].status === 'DELIVERED'
      : true;

    return carrierIsResponsibleForRoute && precedingCarrierDelivered;
  };

  /**
   * @private
   * @function isBundleShipment
   * @returns {Boolean} if product type is BUNDLE.
   *
   * @description This checks if the shipment to track is a Bundle shipment.
   */
  const isBundleShipment = function () {
    return self.data.product_type === 'BUNDLE';
  };

  /**
   * @private
   * @function isExportboxPartShipment
   * @returns {Boolean} if product type is EXPORTBOX_PART.
   *
   * @description This checks if the shipment to track is a Exportbox Part shipment.
   */
  const isExportboxPartShipment = function () {
    return self.data.product_type === 'EXPORTBOX_PART';
  };

  /**
   * @private
   * @function lastEventOnRouteHasStatus
   * @param {Number} routeNumber A number referencing a route in the route information stack.
   * @param {String} status The expected event status.
   * @returns {Boolean} if last event is for the first route and if it's status is DELIVERED.
   *
   * @description This checks if the last event is a "DELIVERED" event for the first mile.
   *              (This event would complete the first mile.)
   */
  const lastEventOnRouteHasStatus = function (routeNumber, status) {
    const numberOfEvents = (self.data.events) ? self.data.events.length : 0;
    const lastEvent = self.data.events[numberOfEvents - 1];

    return lastEvent && lastEvent.route_number === routeNumber && lastEvent.status === status;
  };

  /**
   * @private
   * @function lastEventIsOlderThan
   * @param {Number} hours the minimum past hours since the last event
   * @param {Number} minutes the minimum past minutes since the last event
   * @returns {Boolean} if the past time since last event is as long or longer than incoming hours.
   *
   * @description This checks if the last event is as old or older than incoming time.
   */
  const lastEventIsOlderThan = function (hours, minutes) {
    const numberOfEvents = (self.data.events) ? self.data.events.length : 0;
    const lastEvent = self.data.events[numberOfEvents - 1];

    const pastHours = CommonMoment().diff(lastEvent.moment, 'hours', true);
    const pastMinutes = (pastHours - Math.floor(pastHours)) * 60;

    const pastTimeIsEnough = (parseInt(pastHours, 10) === hours && pastMinutes >= minutes)
      || parseInt(pastHours, 10) > hours;

    return (lastEvent) ? pastTimeIsEnough : false;
  };

  /**
   * @private
   * @function customEvent
   * @param {String} carrierKey A key referencing a carrier.
   * @param {Number} routeNumber A number referencing a route in the route information stack.
   * @returns {Object} new event data object
   *
   * @description This function provides a custom event.
   */
  const customEvent = function (carrierKey, routeNumber) {
    const trackingLink = carrierDefinitions[carrierKey].tracking_link;
    const trackingNumber = self.data.route_information[routeNumber - 1].carrier_tracking_number;

    return {
      carrier: {
        code: carrierDefinitions[carrierKey].carrier_code,
        tracking_number: self.data.route_information[routeNumber - 1].carrier_tracking_number,
      },
      carrier_tracking_link: trackingLink + trackingNumber,
      description: `HANDOVER_TO_${carrierKey}`,
      status: 'IN_DELIVERY',
      route_number: routeNumber,
    };
  };

  /**
 * @private
 * @function placeboWarehouseEvent
 * @description This returns the event details for a warehouse event.
 */
  const placeboEvent = function (carrier, routeNumber, description, language, time) {
    return {
      carrier: {
        code: carrier,
      },
      moment: CommonMoment(StorageService.get(time)).locale(language),
      description,
      route_number: self.data.route_information[routeNumber].route_number,
    };
  };

  /**
   * @private
   * @function addGLSCustomEvents
   *
   * @description This adds custom events for the the carrier "GLS".
   */
  const addGLSCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('GLS_DE', 1)) {
      self.data.events.push(customEvent('GLS_DE', 1));
    }
    if (isCarrierDeliveringOnRoute('GLS_FR', 1)) {
      self.data.events.push(customEvent('GLS_FR', 1));
    }
    if (isCarrierDeliveringOnRoute('GLS_ES', 1)) {
      self.data.events.push(customEvent('GLS_ES', 1));
    }
    if (isCarrierDeliveringOnRoute('GLS_FR', 2)) {
      self.data.events.push(customEvent('GLS_FR', 2));
    }
    if (isCarrierDeliveringOnRoute('GLS_ES', 2)) {
      self.data.events.push(customEvent('GLS_ES', 2));
    }
  };

  /**
   * @private
   * @function addGLSCustomEvents
   *
   * @description This adds custom events for the the carrier "USPS".
   */
  const addUSPSCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('USPS', 1)) {
      self.data.events.push(customEvent('USPS', 1));
    }
    if (isCarrierDeliveringOnRoute('USPS', 3)) {
      self.data.events.push(customEvent('USPS', 3));
    }
  };

  /**
   * @private
   * @function addDHLCustomEvents
   *
   * @description This adds custom events for the the carrier "DHL" (USA).
   */
  const addDHLCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('DHL', 1)) {
      self.data.events.push(customEvent('DHL', 1));
    }
    if (isCarrierDeliveringOnRoute('DHL', 3)) {
      self.data.events.push(customEvent('DHL', 3));
    }
  };

  /**
   * @private
   * @function addYodelCustomEvents
   *
   * @description This adds custom events for the the carrier Yodel.
   */
  const addYODELCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('YODEL', 1)) {
      self.data.events.push(customEvent('YODEL', 1));
    }
    if (isCarrierDeliveringOnRoute('YODEL', 2)) {
      self.data.events.push(customEvent('YODEL', 2));
    }
  };

  /**
   * @private
   * @function addBpostCustomEvents
   *
   * @description This adds custom events for the the carrier Bpost.
   */
  const addBPOSTCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('BPOST', 1)) {
      self.data.events.push(customEvent('BPOST', 1));
    }
    if (isCarrierDeliveringOnRoute('BPOST', 2)) {
      self.data.events.push(customEvent('BPOST', 2));
    }
  };

  /**
   * @private
   * @function addNexiveCustomEvents
   *
   * @description This adds custom events for the the carrier Nexive.
   */
  const addNEXIVECustomEvents = function () {
    if (isCarrierDeliveringOnRoute('NEXIVE', 1)) {
      self.data.events.push(customEvent('NEXIVE', 1));
    }
    if (isCarrierDeliveringOnRoute('NEXIVE', 2)) {
      self.data.events.push(customEvent('NEXIVE', 2));
    }
  };

  /**
   * @private
   * @function addColissimoCustomEvents
   *
   * @description This adds custom events for the the carrier Colissimo.
   */
  const addCOLISSIMOCustomEvents = function () {
    if (isCarrierDeliveringOnRoute('COLISSIMO', 1)) {
      self.data.events.push(customEvent('COLISSIMO', 1));
    }
    if (isCarrierDeliveringOnRoute('COLISSIMO', 2)) {
      self.data.events.push(customEvent('COLISSIMO', 2));
    }
  };

  /**
   * @private
   * @function addWarehouseEvent
   * @description This methods adds a placebo warehouse event.
   *              This event is temporary:
   *              24 hours and 6 minutes after first route completed and before next route starts.
   */
  const addWarehousePlaceboEvent = function (language, moment) {
    const firstRouteNumber = self.data.route_information[0].route_number;

    if (isBundleShipment() && lastEventOnRouteHasStatus(firstRouteNumber, 'DELIVERED') && lastEventIsOlderThan(24, 6)) {
      const time = StorageService.get(`${self.data.id}:hasWarehousePlaceboEvent`);

      if (!time) {
        StorageService.set(`${self.data.id}:hasWarehousePlaceboEvent`, moment);
      }

      self.data.events.push(placeboEvent('coureon', 1, 'IN_TRANSIT.TO_DESTINATION_COUNTRY', language, `${self.data.id}:hasWarehousePlaceboEvent`));
    } else {
      StorageService.set(`${self.data.id}:hasWarehousePlaceboEvent`, null);
    }
  };

  /**
   * @private
   * @function addExportboxPartEvent
   * @description This method adds a placebo "in transit" event for export box part shipments.
   *              This event is temporary:
   *              12 hours and 6 minutes after label was printed and when no new event was added.
   */
  const addExportboxPartPlaceboEvent = function (language, moment) {
    const firstRouteNumber = self.data.route_information[0].route_number;

    if (isExportboxPartShipment() && lastEventOnRouteHasStatus(firstRouteNumber, 'LABEL_PRINTED') && lastEventIsOlderThan(23, 59)) {
      const time = StorageService.get(`${self.data.id}:hasExportboxPartPlaceboEvent`);

      if (!time) {
        StorageService.set(`${self.data.id}:hasExportboxPartPlaceboEvent`, moment);
      }

      self.data.events.push(placeboEvent(self.data.events[0].carrier.code, 0, 'IN_TRANSIT', language, `${self.data.id}:hasExportboxPartPlaceboEvent`));
    } else {
      StorageService.set(`${self.data.id}:hasExportboxPartPlaceboEvent`, null);
    }
  };

  /**
   * @private
   * @function addRoyalmailPlaceboEvent
   * @description This method adds a placebo "in transit" event for royalmail shipments.
   *              This event is temporary:
   *              6 hours and 0 minutes after label was printed and when no new event was added.
   */
  const addRoyalmailPlaceboEvent = function (language, moment) {
    const firstRouteNumber = self.data.route_information[0].route_number;

    if (isExportboxPartShipment() && lastEventOnRouteHasStatus(firstRouteNumber, 'LABEL_PRINTED') && lastEventIsOlderThan(6, 0)) {
      const time = StorageService.get(`${self.data.id}:hasRoyalmailPlaceboEvent`);

      if (!time) {
        StorageService.set(`${self.data.id}:hasRoyalmailPlaceboEvent`, moment);
      }

      self.data.events.push(placeboEvent(self.data.events[0].carrier.code, 0, 'IN_TRANSIT', language, `${self.data.id}:hasRoyalmailPlaceboEvent`));
    } else {
      StorageService.set(`${self.data.id}:hasRoyalmailPlaceboEvent`, null);
    }
  };

  /**
   * @private
   * @function addEvents
   * @description This method adds Events to the event list.
   */
  const addPlaceboEvents = function (language) {
    if (self.data === null || self.data.events === null || self.data.route_information === null) {
      return;
    }

    // Custom event: todo use more specialised placebo events
    addGLSCustomEvents();
    addUSPSCustomEvents();
    addDHLCustomEvents();
    addYODELCustomEvents();
    addBPOSTCustomEvents();
    addNEXIVECustomEvents();
    addCOLISSIMOCustomEvents();

    let moment = CommonMoment().locale(language);
    moment = moment.subtract(2, 'hour');
    moment = moment.subtract(36, 'minutes');

    // Placebo events:
    addWarehousePlaceboEvent(language, moment);
    addExportboxPartPlaceboEvent(language, moment);
    addRoyalmailPlaceboEvent(language, moment);
  };

  /**
   * @private
   * @function filterDuplicates
   * @description This filters all successive events with the same status.
   *              Only the last event with that status is left.
   * @returns {Array} the filtered list.
   */
  const filterDuplicates = function () {
    const filteredEvents = self.data.events.filter((event, index, list) => {
      const lastIndex = list.length - 1;
      return (index < lastIndex) ? event.status !== list[index + 1].status : true;
    });

    self.data.events = filteredEvents;
  };

  /**
   *
   */
  self.track = function track(trackingId, cb, cbErr) {
    const { selectedLanguage } = CommonConfig;

    CommonRequest.tracking.getStatus({ trackingId }, (response) => {
      if (response && response.content && response.content.result) {
        self.data = response.content.result;

        addMomentToEvents(selectedLanguage);
        addPlaceboEvents(selectedLanguage);

        filterDuplicates();

        if (cb) {
          cb(self.data);
        }
      } else {
        self.data = null;
        if (cbErr) {
          cbErr(response);
        }
      }
    }, (response) => {
      self.data = null;
      if (cbErr) {
        cbErr(response);
      }
    });
  };


  return self;
},
];
