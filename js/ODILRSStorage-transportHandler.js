define([
  'coreJS/adapt',
], function(Adapt) {

  var ODILRSStorageTransportHandler = _.extend({

    _THUB: null,  // this will be set to the trackingHub module once this transportHandler is added.
    _NAME: 'ODILRSStorageTransportHandler',
    _OWNSTATENAME: 'odilrs',
    _OWNSTATE: {},
    _URL: "",
    // 1 line moved from th to here
    _data: {},


    initialize: function() {
      console.log('Initializing ' + this._NAME);
      // this._URL = channel._transport._endpoint;
      // 3 lines moved from th to here
      this._data.currentPage = "";
      var local = this;
      local.interval = setInterval(function() {local.focus_check();},3000);
    },

    processEvent: function(channel, eventSourceName, eventName, args) {
      // In this particular transport handler, WE DON'T need to compose messages, because we're not sending messages about events...
      // If we needed to compose messages, we would do:
      //   var composer = this._THUB.getComposerFromComposerName(channel._msgComposerName);
      //   var message = composer.compose(eventSourceName, eventName, args);
      // here just call the 'specific' processor
      var ev = eventSourceName + ':' + eventName;
      // The EVENTS this handler cares about are:
      //this.listenTo(Adapt, 'router:page', this.sessionTimer);
      //
      //this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onStateChanged); // this NEVER fires!
      // this.listenTo(Adapt.contentObjects, 'change:_isInteractionComplete', this.saveState);
      //this.listenTo(Adapt.blocks, 'change:_isComplete', this.onStateChanged);

      funcName = this._THUB.getValidFunctionName(eventSourceName, eventName);
      //console.log('funcName = ' + funcName);
      if (this.hasOwnProperty(funcName)) {
        this[funcName](args);
      } 
      // NO, the fact that there's no method to handle a specific event is NOT an error, it's simply that this TransportHandler doesn't care 
      // about that event!
      /*
      else {
          console.log('ERROR: ' + this._NAME + ' is processing event ' + ev + ' but there is no ' + funcName + ' handler.');
      }
      */
    },

    deliver: function(msg, channel) {
      //console.log(msg);
    },


    onStateChanged: function(target) {
      console.log('onStateChanged in ODISLRSStorage...');
    },

    // jpablo128 note: The ODI LRS api is here: https://github.com/theodi/LRS/tree/master/web/api/v2
    updateLRS: function(state) {
      // jpablo128 Note:
      // a custom Transport Handler should not trigger messages 'in the name of trackingHub' ...
      // If a custom TH needs to trigger messages so 
      // Adapt.trigger('ODISLRSStorage:saving')
      Adapt.trigger('trackingHub:saving');
      if (!state.user.id || state.user.id == null || state.user.id == "null") return;
      send = {};
      send.data = JSON.stringify(state);
      $.ajax({
        type: "POST",
        url: this._URL + "store.php",         
        data: send,
        success: function(ret) {
          Adapt.trigger('trackingHub:success');
          //if (flag) { setSaveClass('cloud_success'); }
        },
        error: function (xhr, ajaxOptions, thrownError) {
          console.log("LRS update failed " + thrownError);
          Adapt.trigger('trackingHub:failed');
          //if (flag) { setSaveClass('cloud_failed'); }
        }
      });
    },

    getUserID: function() {
      // jpablo128 FAKE:
      // For testing purposes, I'm going to return a fixed uuid here without calling the real api
      //localStorage.setItem("UserID", '9F6CAA88-A151-4EA4-A462-0D86E8F6B6D8');
      //return ;
      // END jpablo128 FAKE
      $.get( this._URL + "create_id.php", function( data ) {
        localStorage.setItem("UserID",data);
      })
      .fail( function() {
        setTimeout(function() {this.getUserID();},10000);
      });
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

    saveState: function(state, channel, courseID) {
      // IF we want this channelHandler to be  capable of saving state, we have to implement this function.
      // THIS FUNCTION is always called from trackingHub NOT FROM WITHIN THIS CHANNEL HANDLER!
      // Basically, dave is saving the state both is localStorage and in his backend
      this.updateState();
      this._URL = channel._transport._endpoint;
      user = state.user || {};
      if (!user.id) {
        user.id = localStorage.getItem("UserID") || this.getUserID();
      }
      user.lastSave = new Date().toString();
      state.user = user;
      localStorage.setItem(courseID,JSON.stringify(state));
      this.updateLRS(state);
    },


    // pab's  loadSTate 
    loadState: function(channel, courseID) {
      // THE idea is: try to load a STATE, if there's note, we return the empty state
      this._URL = channel._transport._endpoint;
      state = $.parseJSON(localStorage.getItem(courseID )) || { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };
      loadID = this.queryString().id;
      if (!loadID && state.user) {
        loadID = state.user.id;
      }
      if (loadID) {
        localStorage.setItem('UserID',loadID);
        url = this._URL + 'load.php?id=' + loadID;
        // This feels so wrong!
        try {
          return $.parseJSON($.ajax({
            url: url,
            async: false,
            success: function(text) {
              state = text;
              return state;
            },
            error: function (xhr, ajaxOptions, thrownError) {
              console.log("LRS load failed " + thrownError);
              return '{ "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} }';
            }
          }).responseText);
        } catch (err) { 
            return state; 
        }
      } else {
        return state;
      }
    },

    initializeState: function() {
        // initializes our own state representation. That would be: state.odilrsstorage
        return { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };

    },

    /*
    // Original loadSTate (by davetaz)
    loadState: function(channel, courseID) {
      this._URL = channel._transport._endpoint;
      state = $.parseJSON(localStorage.getItem(courseID )) || { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };
      loadID = this.queryString().id;
      if (!loadID && state.user) {
        loadID = state.user.id;
      }
      if (loadID) {
        localStorage.setItem('UserID',loadID);
        url = this._URL + 'load.php?id=' + loadID;
        // This feels so wrong!
        try {
        return $.parseJSON($.ajax({
          url: url,
          async: false,
          success: function(text) {
            state = text;
            return state;
          },
          error: function (xhr, ajaxOptions, thrownError) {
            console.log("LRS load failed " + thrownError);
            return '{ "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} }';
          }
        }).responseText);
      } catch (err) { 
        return state; 
      }
      } else {
        return state;
      }
    },
*/

    /* Functions moved from manipulated trackinghub  to here (odilrsstoragehandler) */

    sessionTimer: function(target) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    pageID = target.get('_trackingHub')._pageID || target.get('_id');
        // directly causes errors, because targtet migt not have the attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        if (target.get('_trackingHub')) {
          var pageID = target.get('_trackingHub')._pageID;
        } else {
            var pageID = target.get('_id');
        }
        this._data.currentPage = pageID;
        this.window_focused();
        Adapt.trigger('trackingHub:getUserDetails',this._data.user || {});
    },

    focus_check: function() {
      pageID = this._data.currentPage;
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      start_focus_time = undefined;
      last_user_interaction = undefined;   
      if (pageTimes.last_user_interaction) {
          last_user_interaction = new Date(pageTimes.last_user_interaction)
      }
      if (pageTimes.start_focus_time) {
        start_focus_time = new Date(pageTimes.start_focus_time)
      }
      if (last_user_interaction != undefined) {
        var curr_time = new Date();
        if((curr_time.getTime() - last_user_interaction.getTime()) > (20 * 1000) && start_focus_time != undefined) {
            this.window_unfocused();
        }
      }
    },

    window_focused: function() {
      pageID = this._data.currentPage;
      if (pageID == null || !pageID) {
        return;
      }
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      if (!pageTimes.start_focus_time) {
        pageTimes.start_focus_time = new Date();
      }
      pageTimes.last_user_interaction = new Date();
      sessionTimes[pageID] = pageTimes;
      this._data.sessionTimes = sessionTimes;
      //localStorage.setItem('sessionTimes',JSON.stringify(sessionTimes));
    },

    window_unfocused: function() {
      pageID = this._data.currentPage;
      sessionTimes = this._data.sessionTimes || {};
      //sessionTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
      pageTimes = sessionTimes[pageID] || {};
      start_focus_time = undefined;
      if (pageTimes.start_focus_time) {
        start_focus_time = new Date(pageTimes.start_focus_time);
      }
      total_focus_time = pageTimes.sessionTime || 0;
      if (start_focus_time != undefined) {
        var stop_focus_time = new Date();
        var to_add = stop_focus_time.getTime() - start_focus_time.getTime();
        to_add = Math.round(to_add / 1000);
        var total = total_focus_time + to_add;
        pageTimes.sessionTime = total;
        pageTimes.start_focus_time = stop_focus_time;
      }
      sessionTimes[pageID] = pageTimes;
      this._data.sessionTimes = sessionTimes;
      //localStorage.setItem('sessionTimes',JSON.stringify(sessionTimes));
    },


    updateState: function() {
      this._state = this._state || { "blocks": {}, "components": {}, "answers": {}, "progress": {}, "user": {} };
      var courseID = this._THUB._config._courseID;
      lang = Adapt.config.get('_activeLanguage');
      this.window_unfocused();
      // THIS DOESN'T WORK
      //this._state._isComplete = Adapt.course.get('_isComplete');
      this._state.user = this._data.user || {};
      //$.parseJSON(localStorage.getItem("user")) || {};
      pageID = this._data.currentPage;
      _.each(Adapt.contentObjects.models, function(contentObject) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    contentPageID = contentObject.get('_trackingHub')._pageID || contentObject.get('_id');
        // directly causes errors, because contentObject has no attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        if (contentObject.get('_trackingHub')) {
          var contentPageID = contentObject.get('_trackingHub')._pageID;
        } else {
            var contentPageID = contentObject.get('_id');
        }
        // IDIOT DAVE THIS IS EVERY PAGE SO NOT JUST THE ONE ON THE SCREEN!!! 
        //localID = contentObject.getParent()
        localProgress = 0;
        progressObject = this._data.progress || {};
        //progressObject = $.parseJSON(localStorage.getItem("progress")) || {};
        pageProgress = progressObject[contentPageID] || {};
        if (contentPageID) {
          this._state.progress[contentPageID] = {};
        }

        pageTimes = this._data.sessionTimes || {};
        thisPage = pageTimes[contentPageID] || {};
        //pageTimes = $.parseJSON(localStorage.getItem('sessionTimes')) || {};
        
        sessionTime = thisPage.sessionTime || undefined;
        pageProgress.sessionTime = sessionTime;
        pageProgress.courseID = courseID;
        pageProgress.lang = lang;
        pageProgress.theme = theme;
        pageProgress._isComplete = false;
        if (contentObject.get('completedChildrenAsPercentage')) {
          localProgress = contentObject.get('completedChildrenAsPercentage');
          if (localProgress > 10 && !pageProgress.startTime) {
            pageProgress.startTime = new Date();
            console.log('PAB HERE 1');
            pageProgress.progress = localProgress;
          }
          if (localProgress > 99) {
            pageProgress.endTime = new Date();
            console.log('PAB HERE 2');
            pageProgress.progress = 100;
            pageProgress._isComplete = true;
          }
          console.log('PAB HERE 3');
          pageProgress.progress = contentObject.get('completedChildrenAsPercentage');
          if (contentPageID) {
            this._data.progress[contentPageID] = pageProgress;
          }
          
        }
        if (contentPageID) {
          this._state.progress[contentPageID] = pageProgress;
        }
      }, this);
      _.each(Adapt.blocks.models, function(block) {
        this._state.blocks[block.get('_id')] = block.get('_isComplete');
      }, this);
      _.each(Adapt.components.models, function(component) {
        // ( @jpablo128 edit)
        // Trying to do:
        //    contentPageID = component.getParent().getParent().getParent().get('_trackingHub')._pageID || component.getParent().getParent().getParent().get('_id');
        // directly causes errors, because the object referenced has no attribute called '_trackinghub' (so it's null), at least sometimes
        // So I use this equivalent safest alternative:
        var parentChain = component.getParent().getParent().getParent();
        if (parentChain.get('_trackingHub')) {
          var contentPageID = parentChain.get('_trackingHub')._pageID;
        } else {
          var contentPageID = parentChain.get('_id');
        }

        this._state.components[component.get('_id')]=component.get('_isComplete');
        if (contentPageID && component.get('_userAnswer')) {
          this._state.answers[component.get('_id')] = {};
          this._state.answers[component.get('_id')]._userAnswer = component.get('_userAnswer');
          this._state.answers[component.get('_id')]._isCorrect = component.get('_isCorrect');
          this._state.progress[contentPageID].answers = this._state.progress[contentPageID].answers || {};
          this._state.progress[contentPageID].answers[component.get('_id')] = {};
          this._state.progress[contentPageID].answers[component.get('_id')]._userAnswer = component.get('_userAnswer');
          this._state.progress[contentPageID].answers[component.get('_id')]._isCorrect = component.get('_isCorrect');
          if (!this._state.progress[contentPageID].answers._assessmentState) {
            this._state.progress[contentPageID].answers._assessmentState = "Not Attempted";
          }
          if (component.get('_isCorrect') == false) {
            this._state.progress[contentPageID].answers._assessmentState = "Failed";  
          } else if (component.get('_isCorrect') == true && this._state.progress[contentPageID].answers._assessmentState != "Failed") {
            this._state.progress[contentPageID].answers._assessmentState = "Passed";
          }
          if (component.get('_userAnswer').length < 1) {
            this._state.progress[contentPageID].answers._assessmentState = "Incomplete";  
          }
        }
      }, this);
    },


    /* END Functions moved from manipulated trackinghub  to here (odilrsstoragehandler) */



    /**************************************************/
    /*****  Specific event processing functions   *****/
    /**************************************************/

    Adapt_router_page: function (args) {
       this.sessionTimer(args);
    },
/*
    components_change__isInteractionComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('components_change_isComplete in ODISLRSStorage...' + JSON.stringify(obj));
    },
*/
    contentObjects_change__isInteractionComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('contentObjects_change_isInteractionComplete in ODISLRSStorage...' + JSON.stringify(obj));
      // NOW we would UPDATE our INTERNAL STATE representation
      // and NOTIFY trackingHub that state has changed REMEMBER, ANY state from ANOTHER CHANNEL might CHANGE, but 
      // the channel with SAVE capabilities will save the WHOLE state (basic + each representation).
      // THE THING IS... I WANT to make ONLY 1 trip to the server  to save THE WHOLE STATE once... 
      // BASICALLY all the channels have to NOTIFY that they've updated their state. When the # of notifications
      // equals the # of channels... trackingHub calls SAVE on the save-enabled channel.
      // PROBLEM is if a channel is IGNORING events... OR 1 channel LISTENS to a custom event that the other channels
      // are NOT listening to... IN THAT CASE, trackingHUB will be waiting forever, since Some channels will NEVER notify
      // that a state has been updated...
      // MAYBE JUST do a 'DELAYED SAVE'
      // saveState
      // WE DON'T NEED TO DO ANYTHING HERE!!! JUST UPDATE THE INTERNAL REPRESENTATION OF STATE!
      // SEE THE END OF THE dispatchTrackedMsg function in TrackingHub
      //
    },

    blocks_change__isComplete: function (args) {
      var obj = { type: args.get('_type'), id: args.get('_id')};
      console.log('blocks_change_isComplete in ODISLRSStorage...' + JSON.stringify(obj));
    },

  }, Backbone.Events);

  return (ODILRSStorageTransportHandler);
});
