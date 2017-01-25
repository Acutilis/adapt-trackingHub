# adapt-trackingHub

A flexible Adapt extension that implements the basic mechanisms for multichannel tracking.

TrackingHub itself implements  minimal local tracking in the browser (logging messages to the console, and storing the progress in localStorage). But its main characteristic is the  way of looking at _tracking_ (in general) it takes, and the infrastructure that it implements, because it allows for:

* different tracking extensions to be used at the same time
* tracking events and state (_progress_) to be sent to more than one backend at the same time (_multichannel_ tracking).

It is relatively easy to develop alternative tracking extensions for trackingHub.

The main tracking extension released along with trackingHub v0.2.0 implements **xAPI** tracking. It is available in a [separate repository](https://github.com/Acutilis/adapt-tkhub-xAPI). All xAPI-specific information is [there](https://github.com/Acutilis/adapt-tkhub-xAPI), but it is advisable to get familiar with the concepts introduced by trackingHub, explained in this document and in the [Wiki](https://github.com/Acutilis/adapt-trackingHub/wiki).

The adapt-trackingHub extension is compatible with the Authoring Tool. However, most of the testing so far has been done using the framework.

Please note that adapt-trackingHub is neither endorsed nor supported by the official Adapt Project, it's just a 3rd party contribution.


## Installation

With the Adapt CLI installed, run the following from the command line:

`adapt install adapt-trackingHub`

To use it with the Authoring Tool, here in the github repository page click on 'Clone or download' and then click on the  'Download ZIP'. Upload that zip file to the Authoring Tool using the Plugin Manager. Within your course, click on 'Manage Extensions' and click on the green 'Add' button that appears to the right of adapt-trackingHub. Then open the 'Configuration Settings' for your course, and find the 'Extensions' section, click on the **tracking-Hub** button and configure it. 


## Main Concepts

This brief explanation of the main concepts of trackingHub will help you understand the settings section below.

A **central** concept in trackingHub is the _channel_.  You can think of a _channel_ as a _destination for the tracking data_, so to speak. So, a channel can be the browser itself, or an LRS, or a custom backend you write, or any system with an API where you can send data. Anyway, you get the idea, but please [see Wiki](https://github.com/Acutilis/adapt-trackingHub/wiki) for more in-depth information. 

Obviously, trackingHub cannot implement the specific details of communication with the various _types_ of channels. This is done in external Adapt extensions that follow some conventions to be 'compatible' with trackingHub. We call these extensions _Channel Handlers_, because they implement the details of how to handle a specific type of channel. For example, there's one such extension, [adapt-tkhub-xAPI](https://github.com/Acutilis/adapt-tkhub-xAPI/wiki) that implements interaction with an LRS, thus implementing xAPI tracking. It is fairly easy to develop a _channel handler_ for your custom backend, or to clone an existing one and modify it to fit your needs.

As a general rule, you can have an arbitrary number of channels active in your course. For example, you _could_ configure your course to send xAPI statements to 2 or 3 LRSs at the same time. That is, trackingHub does not limit the number of channels types and channels of each type that you can use. The most common use case, though, is to use only one channel of each type. 

A channel, then, will be 'tied' to a _channel handler_, that is, it will be directly related to another extension (not directly to trackingHub). Therefore, the _configuration_ (_settings_) for a channel will be done in the _corresponding extension_. For example, if you want to do xAPI tracking, you will need to install the [adapt-tkhub-xAPI extension](https://github.com/Acutilis/adapt-tkhub-xAPI) for trackingHub, and then any xAPI channels that you want to define (configure), will be defined and configured in the adapt-tkhub-xAPI extension.

So, to summarize:
- The specifics for different backends is implemented in separate Adapt extensions called Channel Handlers
- It is in the configuration of the channel handlers where you define the channels that you want to use with that 'type of backend'.
- TrackingHub just orchestrates the work of an arbitrary number of channel handlers, each of which can define an arbitrary number of channels.

The **only one exception** to this rule is a special channel handler called `browserChannelHandler`:
- This channel handler is a module within trackingHub (as opposed to an external extension), so it is always available (that is, you don't need to install any other extension).
- There can only be one channel of this type (as opposed to an arbitrary number, the normal case)
- It is configured in the configuration settings for trackingHub itself.

This channel handler and channel are 'embedded' in trackingHub itself, even if it means being different to all other channel handlers, because this provides several advantages:
- Just installing trackingHub you can see  the events that are tracked (on the console) and you can save the state to localStorage in the browser. 
- The browserChannelHandler implements a simple but convenient (and fairly detailed) state (or 'state representation', that is, an object that reflects the progress of the user through the course). This state representation is shared among channel handlers, so it is available to your custom channel handler.
- This channel handler is fairly complete, albeit simple, so it is a good reference to see how a channel handler should work.


## Settings Overview

There are three global settings for trackingHub, and then the specific configuration for the default channel _browserChannel_:

- `_isEnabled`: True or false (defaults to true). To enable/disable all trackingHub tracking globally in the course.
- `_courseID`: A _unique_ id for your course. In the  Authoring Tool, the format of this setting has been constrained to be URL, since it is a very convenient method of constructing a unique ID.
- `_identifyById`: For tracking, it is necessary to identify components uniquely, and that _identification_ should be mostly permanent. The `_id` attribute is unique, but -at least in the Authoring Tool- is not permanent (the AT generates new IDs every time you publish), so it's not such a good property to use. If `_identifyById` is set to `true`, trackingHub will be forced to use the `_id` property to identify components. If set to false (the default), it will use the `title` attribute. This has one **important consequence**: all components must have a title, and the title must be unique in the course. The Authoring Tool requires the title, but it does not check for uniqueness. If you use the Framework directly, the course will be built even if components are missing the `title`. So, if `_identifyById` is false, which it should, trackingHub will check the `title` attributes of all components, and alert you if any one is missing or there are duplicates.
- `_browserChannel`: An object with the configuration attributes for the special default channel called _browserChannel_.

The configuration settings for `_browserChannel` are:
- `_isEnabled`: True or false (defaults to true), used to enable/disable this channel. 
- `_tracksEvents`: True or false (defaults to true). To track events means listening for Adapt events, creating _messages_ (that somehow represent what has happened) and sending those messages to the endpoint of the channel. For this channel, the endpoint or destination is the console. So, setting this to true will console.log the events as they happen.
- `_tracksState`: True or false (defaults to true). Tracking state means updating the internal state representation implemented by this channel handler. Note that if you are only using this channel, and set `_trackState` to false, no state information will be saved to localStorage.
- `_isStateSource`: True or false (defaults to false).  _State_ is a representation of the progress of a user through the course. If this setting is `true`, the state information will be read through this channel. In the _browserChannel_ the state representation will be read from localStorage.  **Important**: only **one** channel should have this option set to _true_.
- `_isStateStore`: True or false (defaults to false). Set it to true if you want to save the state through this channel. State can be saved to more than one channel at the same time, but take into consideration that this will create more traffic. In the _browserChannel_, the state will be saved to localStorage.
- `_isLaunchManager`: True or false (defaults to false). If set to true, this channel will be responsible for performing the _launch sequence_, whose purpose is to obtain the user identity, and possibly other information needed for the channel to operate. In the case of the _browserChannel_, the launch sequence just sets up a hardcoded user identity. Its hardly useful. The most common case is that the _launch sequence_ is performed by some other channel handler. **Important**: Only one channel should be set to be the launch manager.
- `_ignoreEvents`: An array of strings which are the event names that we want this channel to ignore. 


## Further information

This document just includes the most basic, bare-bones information needed to get started with trackingHub. It is recommended to read the [Wiki](https://github.com/Acutilis/adapt-trackingHub/wiki), as it provides more in-depth explanations of some of the ideas implemented in trackingHub. 

