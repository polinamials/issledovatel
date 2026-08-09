---
title: "Mobstr Logbook Part 3: RTSP Streaming and Real-Time Object Detection"
date: 2026-08-08
draft: false
summary: Replacing custom RTP code with LIVE555 and running RF-DETR on the stream in real time.
tags: ["Mobstr"]
series: ["Mobstr Logbook"]
series_order: 3
---

By now, I have wrapped up developing all of Mobstr's major features. To be fair, there aren't too many of them, because Mobstr is meant to be a simple application. Its goal is to turn an Android phone into a network camera that can be dropped into a computer vision pipeline with as little friction as possible.

In [Part 2](https://issledova.tel/posts/mobstr_part2/), I said that I wanted to replace the direct RTP stream with an RTSP server and then close the loop by using the stream in an actual computer vision pipeline. I have now done both.

## Mobstr Updates

Previously, Mobstr sent RTP packets directly to a fixed IP address and port on the PC. The receiver had to be configured in advance, and I also needed a separate SDP file to describe the stream. The phone was essentially transmitting packets into the void and hoping that someone was listening.

Mobstr now starts its own [LIVE555](http://www.live555.com/liveMedia/) RTSP server. Instead of configuring the PC's address in the app, Mobstr displays a URL such as `rtsp://192.168.0.10:8554/live`. A receiver connects to the URL and subscribes to the stream.

This is a much better boundary for the application. LIVE555 handles the RTSP session, SDP generation, RTP packetization, RTCP, sockets, and client lifecycle. Writing my own RFC 6184 packetizer was fun and taught me a lot about H.264 streaming, but I do not want to maintain my own version of networking code that mature libraries have already spent years debugging.

### Adapting AMediaCodec to LIVE555

My main reference for this change was Michel Promonet's [v4l2rtspserver](https://github.com/mpromonet/v4l2rtspserver). It streams cameras exposed as Video4Linux device nodes through LIVE555. Mobstr now follows the same general architecture, except its video comes from Android's hardware encoder instead of `/dev/video0`.

The most important thing I had to implement was the adapter between the video producer and LIVE555. In v4l2rtspserver, [`V4L2DeviceSource`](https://github.com/mpromonet/v4l2rtspserver/blob/master/src/V4L2DeviceSource.cpp) derives from LIVE555's `FramedSource`. Captured frames are placed in a queue, an event wakes LIVE555's scheduler, and `deliverFrame()` copies the next frame into LIVE555's buffer. My [`MediaCodecH264Source`](https://github.com/polinamials/Mobstr/blob/2ced9cdc3016ed1a2b6ff25d16c73e61626c5bc5/app/src/main/cpp/src/media_codec_h264_source.cpp) uses the same pattern for the output of `AMediaCodec`.

The tricky part is that the two sides do not agree on what a "frame" is. `AMediaCodec` gives Mobstr an H.264 access unit, which represents one encoded picture but can contain several Network Abstraction Layer (NAL) units. LIVE555's discrete H.264 source expects one NAL unit at a time. The adapter therefore splits each access unit, preserves its presentation timestamp, and tells LIVE555 which NAL is the last one belonging to that picture. It also keeps track of the H.264 SPS and PPS configuration needed by a newly connected decoder.

The RTSP server is similar too. v4l2rtspserver places its source behind a `StreamReplicator`, then creates a discrete H.264 framer and an RTP sink for each client in its [`UnicastServerMediaSubsession`](https://github.com/mpromonet/v4l2rtspserver/blob/master/src/UnicastServerMediaSubsession.cpp). Mobstr does the same in its `Live555Server`.

Mobstr's server queue is capped at three access units. If the network or receiver can't keep up, the server drops old queued frames and waits for a keyframe instead of letting latency accumulate. When a new client connects, the server also asks `AMediaCodec` for a fresh keyframe and includes the SPS and PPS before it. This allows the client start from a recent, independently decodable image.

I also finally populated the diagnostics tab. It now reports the number of connected clients, encoded access units, RTP packets sent, send errors, and packet loss reported by the receiver through RTCP.

## Real-Time Object Detection With Mobstr and RF-DETR

Before getting deeper into the weeds of application design, I wanted to use Mobstr for the thing I originally built it for: streaming live video into a computer vision program.

I really like Roboflow's [RF-DETR](https://rfdetr.roboflow.com/latest/) object detection model. It is fast and accurate, which makes it a good fit for low-latency detection on a live stream. However, as I have mentioned in previous posts, my laptop's GPU is old and slow. Running the regular PyTorch model would leave much less room in the frame budget, so I exported RF-DETR Nano to ONNX and built a [TensorRT](https://docs.nvidia.com/deeplearning/tensorrt/latest/) engine.

You can find the complete example in the [`mobstr_pipeline_examples`](https://github.com/polinamials/mobstr_pipeline_examples) repository.

### Low-Latency Receiver With GStreamer

I receive and decode the RTSP stream with GStreamer, then pull BGR frames directly into Python through an `appsink`. The important part of the pipeline is this:

```python
pipeline = Gst.parse_launch(
    f'rtspsrc location="{STREAM_URL}" protocols=udp '
    "latency=50 drop-on-latency=true "
    "do-retransmission=false ! "
    "rtph264depay ! h264parse ! "
    "avdec_h264 max-threads=1 ! "
    "videoconvert ! video/x-raw,format=BGR ! "
    "appsink name=sink sync=false max-buffers=1 "
    "drop=true wait-on-eos=false"
)
```

I chose GStreamer because it gives me direct control over where buffering is allowed. The RTSP source uses UDP and a small 50 ms jitter buffer. [`drop-on-latency=true`](https://gstreamer.freedesktop.org/documentation/rtsp/rtspsrc.html) prevents that buffer from growing beyond its latency target. Then the [`appsink`](https://gstreamer.freedesktop.org/documentation/app/appsink.html) keeps at most one decoded frame and drops older frames when Python cannot pull them quickly enough. Setting `sync=false` also prevents the sink from waiting for the playback clock.

Initially, I tried using OpenCV's `VideoCapture` which uses FFmpeg under the hood, and it resulted in high latency and frequent block artifacts. I observed the same behaviour with FFmpeg's command line `ffplay` player, as I mentioned in [Part 2](https://issledova.tel/posts/mobstr_part2/). I'm still not sure of the exact reason why GStreamer performs better than FFmpeg-based receivers, but for now I recommend using GStreamer for best performance with Mosbtr.

> OpenCV `VideoCapture` can use the GStreamer backend instead of FFmpeg, however the default `opencv-python` package is not built with GStreamer support. If you're feeling adventurous, you can build [OpenCV from source with GStreamer](https://medium.com/@arfanmahmud47/build-opencv-4-from-source-with-gstreamer-ubuntu-zorin-peppermint-c2cff5393ef).

### Keeping Up With 30 FPS Framerate

The example loads the TensorRT engine once, allocates the host and GPU buffers once, and reuses them for every frame. The input copy, inference, and output copies run on a CUDA stream using `execute_async_v3`. After inference, the script converts RF-DETR's predictions into bounding boxes, annotates the frame with Supervision, and displays it with OpenCV.

On my laptop, the full processing section takes approximately 25 ms per frame, which is under the 33.3 ms inter-frame interval at 30 FPS, so it's fast enough for the detector to not get backed up.

{{< video
    src="rfdetr_detection.mp4"
    caption="RF-DETR detecting objects in a Mobstr live stream."
    loop=true
    muted=true
>}}

Of course, you do not need to install Mobstr to try the example. The script accepts an RTSP URL, so it can also receive a regular RTSP camera or a video served through something like [MediaMTX](https://github.com/bluenviron/mediamtx).

Writing this demo finally felt like closing the development loop on Mobstr. The phone is now a normal RTSP video source, and a computer vision application can subscribe to it and run real-time inference without any Mobstr-specific receiving code. I will keep adding examples to the `mobstr_pipeline_examples` repository as I build them.

## Next Steps

Mobstr is meant to be a simple tool for developers and hobbyists to quickly test computer vision algorithms. I am going to add polish to it and make an APK release soon, but I think it has all the features I want at this time. I may add more features later, but for now I will focus on developing more examples and will let Mobstr rest until I'm ready to come back to it with fresh ideas.