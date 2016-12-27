// Careful... setting global variable because the ODI setup needs it...
var theme="ODI";
define([
  'coreJS/adapt',
  './string-messageComposer',
  './default-channelHandler',
  './xapi/xapi-manager',
  './xapi/xapi-messageComposer',
  './xapi/xapi-transportHandler'
], function(Adapt, stringMessageComposer, defaultChannelHandler, xapiManager, xapiMessageComposer, xapiTransportHandler ) {

    var TrackingHub = _.extend({

    _state: {},
    _OWNSTATEKEY: 'tkhub', // this should be pretty much immutable, once set.
    _sessionID: null,
    _config: null,
    _channels: [],
    _message_composers: {},
    _transport_handlers: {},
    _launchManagerChannel: null,
    _stateSourceChannel: null,
    _stateStoreChannel: null,
    _xapiManager: xapiManager,

    // Basic, default tracked messages
    _TRACKED_MSGS: {
       Adapt: [
        'navigationView:preRender',                    // opened course
        'router:menu',                                 // visited menu
        'router:page',                                 // visited page
        'questionView:complete',
        'questionView:reset',
        'assessments:complete',
        'assessments:reset',
        'questionView:recordInteraction'
       ],
       blocks: ['change:_isComplete','change:_isInteractionComplete'],
       course: ['change:_isComplete'],
       components: ['change:_isComplete','change:_isInteractionComplete'],
       // I think that these additions by @davetaz should remain in the core trackingHub
       contentObjects: ['change:_isComplete',
                        'change:_isInteractionComplete',
                        'change:_isVisible'
       ]
    },

    initialize: function() {
      this.sessionID = this.genUUID();
      xapiManager.registration = this.sessionID;

      this.addMessageComposer(stringMessageComposer);
      // 2 next lines commented out... I'll extirpate xapi stuff from here!
      //this.addMessageComposer(xapiMessageComposer);
      //this.addTransportHandler(xapiTransportHandler);
      // Need to manually set a reference to this (trackingHub) in the defaultChannelHandler because I can't use circular refs with
      // the module loader... the defaultCH is especial because it's loaded directly by trackingHub
      defaultChannelHandler.trackingHub = this;
      this.addTransportHandler(defaultChannelHandler);
      // the ODILRSStorageTH was added by @davetaz. This will not be here.
      //this.addTransportHandler(ODILRSStorageTransportHandler);

      this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
      this.listenToOnce(Adapt, 'app:dataReady', this.onDataReady);
      //this.listenToOnce(Adapt, 'adapt:initialize', this.onAdaptInitialize);
      this.listenToOnce(this, 'allChannelHandlersLoaded', this.onAllChannelHandlersLoaded);
    },


    /*******************************************
    /*******      CONFIG  FUNCTIONS      *******
    /*******************************************/

    onConfigLoaded: function() {
      // just add the defined channels to trackingHub
      var isXapiChannel;

      console.log('RUNNING ONcONFIGlOADED!!');
      if (!this.checkConfig())
        return;
      xapiManager.courseID = this._config._courseID;  
      _.each(this._config._channels, function addChannel (channel) {
        if (this.checkChannelConfig(channel) && channel._isEnabled) {
          this._channels.push(channel);
          if (channel._isLaunchManager) { this._launchManagerChannel = channel };
          if (channel._isStateSource) { this._stateSourceChannel = channel };
          if (channel._isStateStore) { this._stateStoreChannel = channel };
          isXapiChannel = (channel._msgComposerName.indexOf('xapi') == 0) ||
            (channel._transport._handlerName.indexOf('xapi') == 0);
          if (isXapiChannel) {
            xapiManager.addXapiChannel(channel);
          }
        }
      }, this);
    //this.checkChannelHandlersLoaded();
    // cycle through this._channels, which is the list of enabled channels,
    // and add their corresponding transports and messageComposers.
    //_.each(this._channels, function addAndInitHandler(channel) {
    //    var th = this.getTransportHandlerFromTransportHandlerName(channel._transport._handlerName);
    //    this.addTransportHandler(th)
    //}, this);
    // this.onAllChannelsReady();
    },


    checkConfig: function() {
      this._config = Adapt.config.has('_trackingHub') 
        ? Adapt.config.get('_trackingHub')
        : false;
      if (this._config && this._config._isEnabled !== false) {
        this._config._courseID = this._config._courseID || this.genUUDI();
        return true;
      }
      return false;
    },

    checkChannelConfig: function(channel) {
      channel.has = channel.hasOwnProperty;
      channel._ignoreEvents = channel._ignoreEvents || [];
      channel._xapiData = channel._xapiData || {};

      // new condition: _msgComposerName is optional . Review requiredness or not of config elements.
      if ((_.isArray(channel._ignoreEvents)) && (_.isObject(channel._xapiData)) &&
        (channel.has('_isEnabled') && _.isBoolean(channel._isEnabled)) &&
        (channel.has('_name') && _.isString(channel._name) &&
          !_.isEmpty(channel._name) ) &&
        (channel.has('_transport') ) &&
        (channel._transport.hasOwnProperty('_handlerName') &&
          _.isString(channel._transport._handlerName) &&
         !_.isEmpty(channel._transport._handlerName) ) ) {
        return  true;
      }

      console.log('trackingHub Error: Channel specification is wrong in config.');
      return false;
    },

    /*******  END CONFIG FUNCTIONS *******/

/*
    onDataReady: function() {
      // start launch sequence -> loadState -> setupInitialEventListeners... do this asynchronously
      console.log('trackingHub: starting launch sequence...');
      if (this._launchManagerChannel) {
          //var transportHandler = this._transport_handlers[this._launchManagerChannel._transport._handlerName];
          var transportHandler = this._transport_handlers[this._launchManagerChannel._transport._handlerName];
          this.listenToOnce(transportHandler, 'launchSequenceFinished', this.onLaunchSequenceFinished);
          transportHandler.startLaunchSequence(this._launchManagerChannel, this._config._courseID);
      } else {
          // just call the function directly, as if the launch sequence had really finished.
          this.onLaunchSequenceFinished();
      }
    },
*/
    //onAllChannelsReady: function() {
    onDataReady: function() {
      // start launch sequence -> loadState -> setupInitialEventListeners... do this asynchronously
      console.log('trackingHub: starting launch sequence...');
      if (this._launchManagerChannel) {
          //var transportHandler = this._transport_handlers[this._launchManagerChannel._transport._handlerName];
          var transportHandler = this._transport_handlers[this._launchManagerChannel._transport._handlerName];
          this.listenToOnce(transportHandler, 'launchSequenceFinished', this.onLaunchSequenceFinished);
          transportHandler.startLaunchSequence(this._launchManagerChannel, this._config._courseID);
      } else {
          // just call the function directly, as if the launch sequence had really finished.
          this.onLaunchSequenceFinished();
      }
    },

    /*******************************************
    /******* GENERAL  UTILITY  FUNCTIONS *******
    /*******************************************/

    checkChannelHandlersLoaded: function() {
        // if this_transportHandlers have all the keys that are in this._channelHandlersToLoad
        // then all are loaded, and we can trigger the event.
        var chsloaded = _.keys(this._transport_handlers);
        if (!_.isEqual(chsloaded,[]) && _.isEqual(chsloaded, this._channelHandlersToLoad)) {
            console.log('ALL CHANNEL HANDLERS LOADED');
            this.trigger('allChannelHandlersLoaded');
        }
    },

    queryString: function() {
      // This function is anonymous, is executed immediately and 
      // the return value is assigned to QueryString!
      var query_string = {};
      var query = window.location.search.substring(1);
      var vars = query.split("&");
      for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if (typeof query_string[pair[0]] === "undefined") {
          query_string[pair[0]] = decodeURIComponent(pair[1]);
        } else if (typeof query_string[pair[0]] === "string") {
          var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
          query_string[pair[0]] = arr;
        // If third or later entry with this name
        } else {
          query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
      } 
      return query_string;
    },

    /*!
    Excerpt from: Math.uuid.js (v1.4)
    http://www.broofa.com
    mailto:robert@broofa.com
    Copyright (c) 2010 Robert Kieffer
    Dual licensed under the MIT and GPL licenses.
    */
    genUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
        });
    },


    /*******  END GENERAL UTILITY FUNCTIONS *******/




    /*******************************************
    /******* STATE MANAGEMENT  FUNCTIONS *******
    /*******************************************/


    onLaunchSequenceFinished: function(ev) {
      console.log('launch sequence finished.');
      // once the launch seq is complete, let's attempt to load state, if there's a state source
      if (this._stateSourceChannel) {
        var transportHandler = this._transport_handlers[this._stateSourceChannel._transport._handlerName];
        this.listenToOnce(transportHandler, 'stateLoaded', this.onStateLoaded);
        console.log('loading state...');
        transportHandler.loadState(this._stateSourceChannel, this._config._courseID);
      } 
    },

    onStateLoaded: function(fullState) {
        console.log('state loaded');
        // The FULL version of the state is saved/loaded. Then each ChannelHandler (including trackingHub) will 
        // deal with its 'own' part
        this._state = fullState;
        this.trigger('stateReady');
        console.log('state ready');
        this.applyStateToStructure();
        // this should really be:
        // this._THUB._state[_OWNSTATENAME] = state
        this.setupInitialEventListeners();
    },

    applyStateToStructure: function() {
        // apply the default state managed by trackingHub
        this.applyTHubStateToStructure(); 
        // and then call every transport handler (channelHandler) to apply its particular state representation
        _.each(this._transport_handlers, function(thandler, name, list) {
            if(thandler.applyStateToStructure) {
                thandler.applyStateToStructure();
            }
        }, this);

    },

    applyTHubStateToStructure: function() {
        if (this._state[this._OWNSTATEKEY]) {
          console.log('applying trakingHub state to structure...');
          // do stuff
          console.log('trakingHub state applied to structure.');
        }
    },


    /*******  END STATE MANAGEMENT FUNCTIONS *******/


    setupInitialEventListeners: function() {
      console.log('setting up initial event listeners (for tracked messages)');
      this._onDocumentVisibilityChange = _.bind(this.onDocumentVisibilityChange, this);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);

      _.each(_.keys(this._TRACKED_MSGS), function (eventSourceName) {
        _.each(this._TRACKED_MSGS[eventSourceName], function (eventName) {
          this.addLocalEventListener(eventSourceName, eventName);
        },this);
      },this);
    },

    getObjFromEventSourceName: function (eventSourceName) {
      var obj = null;
      // TODO: do this with an object? (name is key, value is the target object)
      switch (eventSourceName.toLowerCase()) {
        case 'adapt': obj = Adapt; break;
        case 'course': obj = Adapt.course; break;
        case 'blocks': obj = Adapt.blocks; break;
        case 'components': obj = Adapt.components; break;
        case 'contentobjects': obj = Adapt.contentObjects; break;
      };
      return obj;
    },

    addCustomEventListener: function(eventSource, eventName) {
      // this fuction is susceptible of being  called form other plugins
      //(mainly custom components that implement custom reporting)
      var sourceObj;
      var longEventName;

      if (_.isString(eventSource)) {
        sourceObj = this.getObjFromEventSourceName(eventSourceName);
        eventSourceName = eventSource;
      } else {
        sourceObj = eventSource;
        eventSourceName = sourceObj._NAME;
      }
      longEventName = eventSourceName + ':' + eventName;

      this.listenTo(sourceObj, longEventName, function (args) {
        this.dispatchTrackedMsg(args, eventSourceName, eventName);
      }, this);
    },

    addLocalEventListener: function(eventSourceName, eventName) {
      var sourceObj;

      sourceObj = this.getObjFromEventSourceName(eventSourceName);
      this.listenTo(sourceObj, eventName, function (args) {
        // TODO: dispatchTrackedMsg should be processTrackedMsg
        this.dispatchTrackedMsg(args, eventSourceName, eventName);
      }, this);
    },

    dispatchTrackedMsg: function(args, eventSourceName, eventName) {
      // The STATE representation IS AFFECTED, or changed, by the EVENTS that happen on the structure.
      // SO if every TransportHandler has its OWN representation of STATE... then we must let the events PERCOLATE to each TH so it can AFFECT its state representation.
      var composer;
      var thandler;
      var message;
      var transportConfig;

      // TODO: add default processing for events in trackinghub... something like:
      // if (this._config._doDefaultEventProcessing) { this.processEvent(channel, eventSourceName, eventName, args) }
      _.each(this._channels, function (channel) {
        // TODO: Remove functionality for ignoring events. Efectively, if there's no handler for them they
        // are ignored, and the checking takes more processing than not doing anything.
        var isEventIgnored = _.contains(channel._ignoreEvents,eventName);
        if ( !isEventIgnored ) {
          thandler = this.getTransportHandlerFromTransportHandlerName(channel._transport._handlerName);
          thandler.processEvent(channel, eventSourceName, eventName, args);
        }
      }, this);
      // At this point in time, trackingHub and all channels have processed (or not) the event, so the whole representation of state is updated.
      // So trackingHub can invoke the Save functionality, (although the specific save is performed by a concrete channel).
      this.saveState();
    },

    getComposerFromComposerName: function (cname) {
      // TODO: careful here, maybe check existence first!
      return (this._message_composers[cname]);
    },

    getTransportHandlerFromTransportHandlerName: function (thname) {
      return (this._transport_handlers[thname]);
    },

    // *** functions addMessageComposer and addTransportHandler 
    // are here so other extensions (extensions implementing messageComposers and
    // TransportHandlers) can add themselves to trackingHub
    addMessageComposer: function (mc) {
      this._message_composers[mc['_NAME']] = mc;
    },

    addTransportHandler: function (th) {
      this._transport_handlers[th['_NAME']] = th;
      // @jpablo128 addition: call the THandler's  'initialize' function if it exists
      th._THUB = this;
      /*
      if (th.initialize) {
          th.initialize();
      }
     */ 
      this.checkChannelHandlersLoaded();
    },

    saveState: function() {
      // TODO: implement configurable functionality to throttle saving somehow, that is, save only once every X times this function is called...
      _.each(this._channels, function(channel) {
        if (channel._isStateStore) {
          this._transport_handlers[channel._transport._handlerName].saveState(this._state, channel, this._config._courseID);
        }
      }, this);
    }, 

    getValidFunctionName: function (eventSourceName, eventName) {
      return (eventSourceName + '_' + eventName.replace(/:/g, "_"));
    },

    onDocumentVisibilityChange: function() {
      // Use visibilitystate instead of unload or beforeunload. It's more reliable.
      // See: // https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/

      if (document.visibilityState == "hidden") {
        this.saveState();
      };

      if (document.visibilityState == "visible") {
        //this.loadState();
      };

      $(document).off("visibilitychange", this._onDocumentVisibilityChange);
      $(document).on("visibilitychange", this._onDocumentVisibilityChange);
    }
  }, Backbone.Events);

  TrackingHub.initialize();
  return (TrackingHub);
});
