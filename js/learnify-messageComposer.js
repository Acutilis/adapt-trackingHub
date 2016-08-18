define(function() {

  var LearnifyMessageComposer = _.extend({

    _NAME: 'learnifyMessageComposer',
  
    compose: function (eventSourceName, eventName, args) {
      funcName = this.getValidFunctionName(eventSourceName, eventName);
      if (this.hasOwnProperty(funcName)) {
        return (this.prependComposerName(this[funcName](args)));
      }
      return (this.prependComposerName( "<<Composing function for " +
        funcName +" not implemented>>"));
    },
  
    prependComposerName: function(msg) {
      return (this._NAME + ": " + msg);
    },

    getValidFunctionName: function (eventSourceName, eventName) {
      return (eventSourceName + '_' + eventName.replace(/:/g, "_"));
    },
  
    addCustomComposingFunction: function(eventSourceName, eventName, func) {
      funcName = this.getValidFunctionName(eventSourceName, eventName);
      this[funcName] = func;
    },
  
  
    /*******************************************/
    /*****  Specific composing functions   *****/
    /*******************************************/
  
    Adapt_navigationView_preRender: function (args) {
       return ("course started");
    },
  
    Adapt_router_menu: function (args) {
       return ("visited menu ");
    },
  
    Adapt_router_page: function (args) {
       // return ("visited page " + args.attributes._id);
      return ("visited page " + args.get('_id'));
    },
  
    Adapt_questionView_complete: function (args) {
       return ("completed question " + args.get('_id'));
    },
    
    Adapt_questionView_reset: function (args) {
       return ("reset question " + args.get('_id'));
    },
  
    Adapt_questionView_recordInteraction: function (args) {
       var obj = {};
           obj.id = args.model.get('_id');
           obj.complete = args.model.get('_isComplete');
           obj.correct = args.model.get('_isCorrect');
           obj.userAnswer = args.model.get('_userAnswer');
           obj.selectedItems = args.model.get('_selectedItems');
           //var answers = JSON.parse(localStorage.getItem(moduleId + "_cmi.answers"));
           //if (answers == null) {
       var answers = {};
           //}
           answers[obj.id] = {};
           answers[obj.id] = obj;
       return ("Recorded interaction " + JSON.stringify(answers));
    },
  
    components_change__isInteractionComplete: function (args) {
       return ("completed interaction " + args.get('_id'));
    },
  
    Adapt_assessments_complete: function (args) {  // plural
       return ("completed assesment " + args.id);
    },
  
    Adapt_assessments_reset: function (args) {   // plural
       return ("reset assesment " + args.id);
    },
  
    blocks_change__isComplete: function (args) {
       return ("completed block " + args.get('_id'));
    },
  
    course_change__isComplete: function (args) {
       return ("completed course " + args.get('_id'));
    }
  }, Backbone.Events);

  return (LearnifyMessageComposer);

});
