# v0.2.5
 - Do not listen to `visibilitychange`. Saving the state when visibility changes to hidden should be left to specific ChannelHandlers to do, it should not be forced from trackingHub.
