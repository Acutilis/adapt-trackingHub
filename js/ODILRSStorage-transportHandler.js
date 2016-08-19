define(function() {

  var ODILRSStorageTransportHandler = _.extend({

    _NAME: 'ODILRSStorageTransportHandler',
    _URL: "",

    deliver: function(msg, channel) {
      //console.log(msg);
    },

    updateLRS: function(state) {
      if (!state.user.id || state.user.id == null || state.user.id == "null") return;
      send = {};
      send.data = JSON.stringify(state);
      $.ajax({
        type: "POST",
        url: this._URL + "store.php",         
        data: send,
        success: function(ret) {
          console.log("UpdatedLRS");
          //if (flag) { setSaveClass('cloud_success'); }
        },
        error: function (xhr, ajaxOptions, thrownError) {
          console.log("LRS update failed " + thrownError);
          //if (flag) { setSaveClass('cloud_failed'); }
        }
      });
    },

    getUserID: function() {
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
      this._URL = channel._transport._endpoint;
      console.log('ODIStorageTransportHandler Saving state!!');
      console.log(JSON.stringify(state));
      user = state.user || {};
      if (!user.id) {
        user.id = localStorage.getItem("UserID") || this.getUserID();
      }
      user.lastSave = new Date().toString();
      state.user = user;
      localStorage.setItem(courseID + '_state',JSON.stringify(state));
      this.updateLRS(state);
    },

    loadState: function(channel, courseID) {
      this._URL = channel._transport._endpoint;
      console.log('loading state');
      state = $.parseJSON(localStorage.getItem(courseID + '_state'));
      loadID = this.queryString().id;
      if (!loadID && state.user) {
        loadID = state.user.id;
      }
      if (loadID) {
        localStorage.setItem('UserID',loadID);
        url = this._URL + 'load.php?id=' + loadID;
        // This feels so wrong!
        return $.parseJSON($.ajax({
          url: url,
          async: false,
          success: function(text) {
            state = text;
            return state;
          },
          error: function (xhr, ajaxOptions, thrownError) {
            console.log("LRS load failed " + thrownError);
          }
        }).responseText);
      } else {
        return state;
      }
    }

  }, Backbone.Events);

  return (ODILRSStorageTransportHandler);
});
