# adapt-trackingHub

A flexible Adapt extension that implements the basic mechanisms for multichannel tracking, including xAPI. It is extensible, to allow for different models of tracking.

This is only for the adapt framework (no compatibility with the authoring tool at this point).  This is an early version, not intended to be used in production yet.

Please note that this is neither endorsed nor supported by the official Adapt Project, it's just a 3rd party _contribution_.


## Installation

Since this extension is in such an early stage, it has not yet been registered (it cannot be installed on the command line using 'adapt install').

To use it, get it the code directly from GitHub, either downloading the zip file or cloning the repository.

To play around with it, the easiest thing is to create a course:

```
 adapt create course myTestCourse
 cd myTestCourse
 grunt build
 cd src/extensions
 git clone ?????????????????????
```

The configuration shown in the example.json file seems long and complex, but your typical config will likely be much shorter. Please **be sure** to read the sections Concepts and Related Projects below to understand how tracking with this extension works, and thus how use the configuration.

## Concepts

What I want with this extension is to implement detailed, multi-channel tracking for Adapt courses. Here is an explanation of what this means and what it entails, so it's easier to understand the gist of this extension.

### Multichannel Tracking
In the context of Adapt and this extension, I use the term _tracking_ in a fairly general sense, meaning _to record what's happening in the client (Adapt course), and relaying it to one or more destinations_. So, the idea is to be able to _log_ what the user is doing while she is interacting with the course. This type of tracking goes beyond the widely used practice of recording _completion_ and _pass/fail_ data. This is indeed close to the basic idea of xAPI (eXperience API, also known as TinCan API), recording _streams of activities_ etc.

Of course it's not always necessary to track that much detail about course usage, but sometimes -as I'll explain later- it might be required, or just convenient. I particularly want to have this option, that's why I wanted to have an extension like this.

Also, traditionally (at least in the context of LMSs and SCORM), the tracking data get sent to just one place: the LMS. With xAPI, we know that this is no longer the case: Learning Record Stores receive statements from Activity Providers. Nothing prevents Activity Providers to send data to more than one LRS at the same time. The only requirement to do so is that the Activity Provider is _enabled_ for it, that is, it is programmed to handle more than one LRS at the same time (_multi LRS_ tracking).

This is all fine, but an _LRS_ is an xAPI thing, it implements a particular API (actually, four APIs), and it expects information in a particular format (e.g., xAPI statements). I might want to track events as they happen in the course, and maybe I want to use xAPI and an LRS,  but maybe I don't! maybe I don't want to express this information in the form of a _xAPI statement_, or maybe I want to send that information to a _different_ system, not an LRS.

When you look at it like that, xAPI seems to be -in a way- a _particular case_ of something more general. This extension is an attempt to start implementng that _something more general_, and also xAPI, because it is actually becoming very important.


### The three basic concepts
Let's get a little closer to the organization of the code and how things are named in the context of the trackingHub extension.

In terms of the Adapt course, we just want to listen to certain Events, and when they happen, we want to express or represent what has happend in a _message_. The messages can be formatted, or _composed_ in many different ways. In the context of trackingHub, the **MessageComposer** is a piece of code whose responsibility is to receive information about an event, and express it in a _message_ (and return that message to the calling function). If I allow the trackingHub extension to make use of more than one MessageComposer at the same time, then I will enable my Adapt course to express my tracking data in various different _formats_ at the same time.

Once a _message_ exists, I want to deliver it. Delivering means that I want to send that message to a certain system (endpoint), over a particular protocol and using a particular API. In the case of xAPI, for example, the endpoint would be an LRS, the transport would be HTTP, and the API, would be xAPI (using PUT, POST, GET, etc. as defined in the standard). I also could send the message to a different endpoint, using a different REST API, over HTTP too. Or I might want to send the message through a WebSocket to a particular WebSocket server. Or I might just want to pass the message to a JavaScript function. The **TransportHandler** is a piece of code whose responsibility is to take a _message_ (something, most likely an objects, which contains informatino about an event) and _send_ it to and enpoint. The TransportHandlers implement the details of the API, communication, authorization, etc. If I allow the trackingHub extension to make use of more than one TransportHandler at the same time, then I will enable my Adapt course to send tracking information to different endpoints at the same time.

Finally, I need a way to tell the trackingHub extension what MessageComposer to use with what TransportHandler. For example, if I want to use xAPI, I need a way to tell the trackingHub extension that my LRS endpoint needs to use messages composed according to xAPI (otherwise, the LRS will reject the information it receives). The artifact that lets me express the pairing of a MessageComposer and a TransporHandler is called a  **Channel**. If I allow the trackingHub extension to make use of more than one Channel at the same time, my Adapt course will be able to send messages formatted in any way to any destination, in any combination, at the same time. This is the type of detailed multi-channel tracking I want.

It might seem overkill, and certainly we won't need our courses to send data formatted in a million formats to a zillion endpoints, but the flexibility that this gives us as developers is pretty interesting. More information about this in the section Rationale.

The trackingHub extension reads all the information about channels from the configuration file.

### Message composers
The trackingHub extension bundles two messageComposers that are always available:
- string-messageComposer: simple composer that expresses the messages as simple strings. Most appropriate for simple logging, particularly, for logging to the console.
- xapi-messageComposer: expresses the messages as xAPI statements.

A message composer is fairly simple. It just needs a `compose` function (which is what the main trackingHub will call). This function acts like a main dispatcher: it takes information about an event, and depending on that, it calls one or other specific composing function, which builds the message, or part of the message, specifically for that event. Then the main `compose` function, just returns the message.

If trackingHub only used pre-defined messageComposers like this, it would be pretty limited, or we would need to expand this extension every time we wanted to incorporate a new messageComposer. This is not the case, because because other extensions can _add themselves_ as messageComposers to trackigHub, and therefore anybody can write _external_ messageComposers (extensions).

An example of such an _external_ messageComposer is adapt-simpleJSONMessageComposer, which expresses the messages as fairly simple JSON objects. The information they contain is pretty much the same as an xAPI statement, but much less verbose. It illustrates that you can create a composer that adds the exact information you need for your tracking purposes.

### Transport Handlers
The trackingHub extension bundles two tranportHandlers that are always available:
    - consoleLog-transportHandler: It is the simplest transport handler. It just calls console.log with the message it receives.
    - xapi-transportHandler: Implements communication with an LRS, using xAPI.

A transportHandler has a function called `deliver`, which just takes the message and the channel. With that, it has enough information to deliver the message.
The transport handler may also implement the saveState and loadState functions, if it wants to implement such functionality.

If you look at the xapi-transportHandler code, it looks deceptively short and simple. It's just because the heavy lifting is done by the underlying xAPI wrapper library, from ADL. In this simple version of the transportHandler, we're just calling the right functions.

However, a more advanced version of the transportHandler should (will) have more responsibility. For example, as I explained somewhere else, things don't happen magically in xAPI. If you want an xAPI-enabled experience to _work offline_ and keep the tracking data until a connection is established again, then you have to program that. That kind of functionality belongs in the transportHandler: instead of delivering the message directly, it should check the connection, and keep a queue of messages locally (on localStorage for example) and try to deliver them when there's a connection, and remove them from the queue when delivery has been confirmed... etc. So, at this point, the xapi-transportHandler is fairly simple, but it _should_ incorporate more functionality to make it smarter (even if it uses the ADL xAPI wrapper). For starters, it should do the calls to the LRS asynchronously (at this early stage, it's just doing synchronous calls).

As with messageComposers, other extensions can _add themselves_ as transportHandlers to trackingHub, so we have the flexibility to write _external_ transport handlers without altering the core trackingHub code.

An example of such an _external_ transportHandler is adapt-simplePOSTTransportHandler, which implements a simple mechanism to send the messages to a server with a very simple API. It also implements saveState and loadState. Keep in mind that a transportHandler is always coupled with its serverside counterpart, so if you write a transporHandler, you might need to write the server too. Or not. In theory it should be possible to write a transportHandler to send messages to existing APIs (e.g. slack, evernote, a logging service like loggly or papertrailapp...). 

### Channels

As mentioned before, a **Channel** defines a pairing of a messageComposer and a transportHandler, so you can mix things. One caveat is that if the endpoint expects data in a certain _format_, then you should use the corresponding messageComposer. For example in xAPI, if the statements are not right, the LRS won't store them. But if your transportHandler and corresponding server side piece accepts anything, then you can basically do remote logging of messages in any formate. For example, the related adapt-simplePOSTTransportHandler and the related simplePOSTTransporServer will just take any json.

You can define more than one channel in the configuration file, as will be explained soon, and you can enable and disable channels independently. This allows trackingHub to send messages to various endpoints at the same time. For example, using just the bundled messageComposers and trasportHandlers, you can do xAPI tracking, sending xAPI statements to one or more LRSs (basing saving/loading progress data is also implemented). Or you can see simple logging on the console. Or, you can define a channel so that you can see your xAPI statementns on your console (using xapi-messageComposer and consoleLogTransportHandler).

## Configuration

The configuration for trackingHub only has three items at the top level:
    - `_isEnabled`: To enable/disable the whole extension.
    - `_courseID`: A (globally)  _unique_ id your your course.
    - `_channels`: An array with the configuration for each channel.

Each channel has its own configuration. The configuration items for each channel are:
    - `_name`: An arbitrary name for the channel.
    - `_isEnabled`: To enable/disable the channel.
    - `_msgComposerName`: Each messageComposer has a `_NAME` property to identify it. In this configuration option we indicate the name of the composer we want for this channel.
    - `_saveStateIsEnabled`: True or false, to indicate whether we want the state (progress) to be saved on this channel.
    - `_isStateSource`: True or false, to indicate that this channel is the one from which the course should load the saved state, if it exsists. **Important**: there should only be **one** channel with this property set to true.
    - `_transport`: An object with information about the transport. Note that the specific concept of _transport_ in the configuration basically allows us to _group_ things that are needed to _deliver_ the message: the transportHandler, the endpoint, and the authorization (only the name of the transportHandler is mandatory). This obviously allows us to use _several instances of the same type of tracking_ at the same time. For example, we can send xAPI statements to several different LRSs.
        - `_handlerName`: Each transportHandler has a `_NAME` property to identify it. In this configuration option, we indicate the name of the transportHandler we want to use for this channel.
        - `_endpoint`: The url of the endpoint (e.g. "http://10.0.3.22/data/xAPI/"). It may be empty, because a transport handler might not need one. For example, the consoleLogTransportHandler doesn't need one. Any transportHandler that just calls a JavaScript function in its `deliver` function won't need and endpoint (the _endpoint_ is the JavaScript function itself, and it's obviously _embedded_ in the transportHandler code).
            - `_auth`: Some endpoints might implement authentication. This `_auth` object in the configuration contains any information that the transport handler might need to perform this authentication. The bundled xapi-transportHandler uses Basic HTTP authentication, so the auth configuration for an endpoint that uses this transportHandler should indicate the username and the password. Note that each transportHandler might implement different authentication schemes, so what goes into the `_auth` section might be different for different transportHandlers.
                - `_username`: The username (for Basic Authorization, in xAPI)
                - `_password`: The password (for Basic Authorization, in xAPI)
    - `_ignoreMessages`:  

     "_ignoreEvents": An array with the events that we want to _ignore_ (not track) from the list of default track messages that are defined at the beginning of `adap-trackingHub.js`. With this, we can limit the vebosity of our tracking. On, keep detailed tracking on one backend, and just track more general events on another backend.

Hopefully, the example configuration file does'n look so scary now.

## User identification

One of the fundamental differences between xAPi-style tracking and traditional SCORM tracking is the role of the LMS. SCORM content _does depend_ on an LMS. In fact, it is the LMS the one who _launches_ the SCO, and it is the LMS's responsibility to provide the SCORM API. The content has the responsibility of _finding_ the API, and then using it according to the SCORM spec. This way, the content can make calls using the API to retrieve user identification information (the user has logged into the LMS, and therefore her identity is known, and can be passed on to the content). 

On the other hand, xAPI-enabled content _does not depend on an LMS_. Due to the very nature of xAPI, anything can be an Activity Provider, from a web course (e.g. Adapt), to a simulator of an industrial instrument panel (or even the instrument panel itself), and therefore anything can send xAPI statements to the LRS. But, still, the user of the activity **must** be identified (the Actor property of a statement is mandatory, and in many cases it will be an Agent -most likely a person-). So, in an xAPI scenario (or xAPI-like scenario, such as trackingHub) user identification **is not** part of the content, it cannot be embedded in the content, and therfore it must be resolved outside.

There are several mechanisms to allow LMSs (or other systems) to launch xAPI content providing the information it needs as launch parameters. See for examlpe the xAPI SCORM profile (https://github.com/adlnet/xAPI-SCORM-Profile/blob/master/xapi-scorm-profile.md#40-launching-and-initializing-activities), CMI-5 (https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#content_launch) and Rustici Software's launch mechanism (https://github.com/RusticiSoftware/launch/blob/master/lms_lrs.md).

As far as trackingHub is concerned, and regardless of the type of tracking it does (whether it's xAPI or other), it also needs to get the user information from somewhere. At this point, the trackingHub extension gets the user information from the URL parameters (query string). So, to test tracking with a specific user, launch your course with something like this:
`http://localhost:9001/?actor=%7B%22mbox%22%3A%22mailto%3Ajohn%40doeland.com%22%2C%22name%22%3A%22John%20Doe%22%2C%22objectType%22%3A%22Agent%22%7D`

If **no user** is specified in the URL parameters, trackingHub will set  **random user information**. An **important** consequence of this is that, to check out the state save/load capabilities (storing and restoring progress data), **you should use the same user (launch string)**. 

The trackingHub extension, at this point, takes advantage of the ADL xAPIWrapper, which automatically parses the query string for some known (or expected) parameters, and then initializes the corresponding data structures. 

In a real scenario, an Adapt Course will most likely be launched from either an LMS or another custom system (where somebody logs-in, and can access the courses he's authorized to launch). But this 'custom system' is conceptually (regarding the launch of content) an LMS, so the use of query string parameters might still be appropriate.

Still, there might be cases in which we would want to implement user identification differently (e.g. grabing an http header). In such case, the mechanism is outside the scope of trackingHub. You would have to write your specific extension to handle that. But trackingHub exposes a function called `setActor` (not implemented yet), so any external code can do its thing to identify the user, and then call setActor to tell trackingHub the identity of the user.


## More extensibility

We've seen how we can use a configuration option to limit the events that are tracked. However, in my opinion, it's important to be able to track arbitrary events. This way, custom extensions or components could somehow tell trackingHub "hey, I will be triggering these custom events, I want you to track them". Turns out this is fairly straightforward. The trackingHub extension exposes a function called 'addEventListener', through which anybody (an extension or component) can add _tracked events_ to trackingHub. But this is not enough. What happens when a tracked event is triggered? trackingHub **must** call a messageComposer, to compose the message for that event. In turn, the main `compose` function in the messageComposer must call a specific composing functions, that _knows_ how to represent the information for that specific event. Therefore, the custom extension or component who wants its customs events tracked, must **also** add a _custom composing function for each custom event it wants to track_ to each messageComposer. Sounds complicated but it's not. In essence, the custom extension or component (e.g., a hypothetical simulator) should say something like this:

```
trackingHub.addCustomEventListener(this,  'switch1ON');
trackingHub.addCustomEventListener(this,  'switch1OFF');
trackingHub.addCustomEventListener(this,  'presserKnobTurned');
.
.
.
xapi-MessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_switch1on)
xapi-MessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_switch1off)
xapi-MessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_pressureKnobTurned)
.
.
.
simpleJSONMessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_switch1on)
simpleJSONMessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_switch1off)
simpleJSONMessageComposer.addCustomComposingFunction(this, 'switch1ON', this.xapi_pressureKnobTurned)
```

And then it must implement those specific _message composing_ functions.

With this approach, we can plug custom/detailed tracking into the trackingHub general infrastructure. I did an example/test of this with a custom extension, and it works. In the near future I hope to release an example extension and an example component that does this.

That's it for tracking custom events.

I also would want custom components and extensions to be able to save custom _state_ information. Right now this is not implemented, but I presume that custom state saving will be somewhat analogous to custom event tracking.

The point of this is to enable future plugins (mainly components, but maybe also extensions) to be able to provide detailed tracking data, an to save and load arbitrarily complex state representations. Think of a component that implements a simulation. Or a component that allows a complex branching scenario, and we want to keep track not only of the final result, but of all the paths and retries that the learner takes.

## Related repositories

Other separate but related repositories are:

    - adapt-simpleJSONMessageComposer: An Adapt extension that implements a messageComposer.
    - adapt-simplePOSTTransportHandler: An Adapt extension that implements a transportHandler that uses a very simple REST API. This repo also includes a very simple server (written in Python) that implements that simplePOST API, for the above handler.

## Is this necessary?

Obviously, the basis of trackingHub is largely influenced by xAPI, and more generally, by the trend to track _what's happening_ (streams of activities) and not only _results_. xAPI is becoming very important, but it's not the only solution for this type of tracking. There's also IMS Caliper (I admit I'm not familiar with it).

But... from the increasing relevance of xAPI,  do we need to jump to  _detailed, multi-channel, multi-format_ tracking in Adapt? Well... again, the point is not to have a technical extravaganza that lets us send messages in different formats to different places at the same time _just because_ we can do it. There are certain situations (not immediately obvious) where all this functionality could be put to good use. Here are some examples.

    - In some situations, we might need to do xAPI tracking, but we need to do some server-side processing before sending the statements to the LRS. For example, if we need sign the statements. In this case, we can send tracking info in a compact form from the course to the server, and have a server side process that creates the statements and signs them before sending them to the LRS.
    - We might not be able to send statements directly from the course to the final LRS. for example, when the client's LRS is sitting behind a firewall, and they want to use a course that we host. We can send xAPI statements from the course to an intermediate LRS (that we host), and our client's LRS pulls the information from our intermediate LRS every night. They get their statements, and they don't need to set up permissions etc. for external content to access their internal LRS.
    - We just want to do simple analytics. We can send tracking info in some compact form to our server side process, so it can be aggregated and analyzed. We don't need to rely on xAPI for that.
    - Granularity is not clear. How much data should we track in our new course? Sometimes it's hard to know. With something like trackingHub, we can send a moderate amount of data to the LRS (so we don't overburden it with lots of details that we're not sure we're going to need) , but at the same time we send all the detailed data, in a compact form, to a simple server-side process that just stores it. If, later, it turns out that the xAPI statements are not detailed enough to answer the questions we need to answer (through data analisys), we could grab all the detailed data we saved and generate xAPI statements from it (or just analyze those data directly).
    - We want use events tracked in the course to perform some non-traditional action, such as posting a message to a Slack channel, to notify somebody that the learner finished the course, for examplei.

Hopefully, these scenarios provide a better insight of my thinking behind trackingHub.

## Work in Progress
This extension, as it is, v0.0.1, is functional but very rough. I've seen it tracking disparate sets of events to the console, an LRS, and three instances of simplePOSTTransporServer (each instance receiving messages in a different format). It's nice. But it is version 0.0.1. I already have a long list of fixes/improvements that I see need to be done. And I'm sure there are many other things that I don't see, so your comments and contributions are welcome.
