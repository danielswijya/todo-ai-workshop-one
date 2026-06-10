import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

import { FaCamera, FaCircleNotch, FaExpandArrowsAlt, FaImage, FaRedo, FaTrash } from 'react-icons/fa'

const LENS_OPTIONS = [0.6, 1, 2, 3]
const LONG_PRESS_MS = 650

function App() {
  const videoRef = useRef(null)
  const stageRef = useRef(null)
  const referenceImageRef = useRef(null)
  const referenceFileInputRef = useRef(null)
  const streamRef = useRef(null)
  const objectUrlRef = useRef(null)
  const longPressTimerRef = useRef(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [reference, setReference] = useState(null)
  const [overlayOpacity, setOverlayOpacity] = useState(46)
  const [overlay, setOverlay] = useState({
    x: 18,
    y: 18,
    width: 64,
    height: 54,
    aspectRatio: 1,
  })
  const [interaction, setInteraction] = useState(null)
  const [showDeleteControl, setShowDeleteControl] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hardwareZoom, setHardwareZoom] = useState(null)

  const releaseReferenceUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setHardwareZoom(null)
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return
    }

    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      streamRef.current = stream
      const [videoTrack] = stream.getVideoTracks()
      const capabilities = videoTrack?.getCapabilities?.()
      setHardwareZoom(capabilities?.zoom ? capabilities.zoom : null)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch {
      setCameraReady(false)
    }
  }, [stopCamera])

  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    return () => {
      releaseReferenceUrl()
    }
  }, [releaseReferenceUrl])

  const fitReferenceToStage = useCallback((naturalWidth, naturalHeight) => {
    const stageRect = stageRef.current?.getBoundingClientRect()

    if (!stageRect || !naturalWidth || !naturalHeight) {
      setOverlay({ x: 18, y: 18, width: 64, height: 54, aspectRatio: 1 })
      return
    }

    const stageAspect = stageRect.width / stageRect.height
    const referenceAspect = naturalWidth / naturalHeight
    let width = 66
    let height = (width * stageAspect) / referenceAspect

    if (height > 74) {
      height = 74
      width = (height * referenceAspect) / stageAspect
    }

    setOverlay({
      x: (100 - width) / 2,
      y: (100 - height) / 2,
      width,
      height,
      aspectRatio: referenceAspect,
    })
  }, [])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleReferenceFile = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    releaseReferenceUrl()

    const src = URL.createObjectURL(file)
    objectUrlRef.current = src
    setReference({
      src,
      title: file.name,
    })
    setShowDeleteControl(false)
    event.target.value = ''
  }

  const clampOverlay = useCallback((nextOverlay) => {
    const minWidth = 14
    const minHeight = 14
    const width = Math.min(Math.max(nextOverlay.width, minWidth), 100)
    const height = Math.min(Math.max(nextOverlay.height, minHeight), 100)
    const x = Math.min(Math.max(nextOverlay.x, 0), 100 - width)
    const y = Math.min(Math.max(nextOverlay.y, 0), 100 - height)

    return { ...nextOverlay, x, y, width, height }
  }, [])

  const clampAspectLockedOverlay = useCallback((nextOverlay, stageAspect) => {
    const minWidth = Math.max(14, (14 * nextOverlay.aspectRatio) / stageAspect)
    const maxWidth = Math.min(100, (100 * nextOverlay.aspectRatio) / stageAspect)
    const width = Math.min(Math.max(nextOverlay.width, minWidth), maxWidth)
    const height = (width * stageAspect) / nextOverlay.aspectRatio
    const x = Math.min(Math.max(nextOverlay.x, 0), 100 - width)
    const y = Math.min(Math.max(nextOverlay.y, 0), 100 - height)

    return { ...nextOverlay, x, y, width, height }
  }, [])

  const beginOverlayInteraction = (event, mode) => {
    if (!reference || !stageRef.current) return

    event.preventDefault()
    event.stopPropagation()
    clearLongPressTimer()

    if (mode === 'move') {
      longPressTimerRef.current = window.setTimeout(() => {
        setShowDeleteControl(true)
      }, LONG_PRESS_MS)
    }

    setInteraction({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startOverlay: overlay,
      stageRect: stageRef.current.getBoundingClientRect(),
    })
  }

  useEffect(() => {
    if (!interaction) return undefined

    const handlePointerMove = (event) => {
      const dx = ((event.clientX - interaction.startX) / interaction.stageRect.width) * 100
      const dy = ((event.clientY - interaction.startY) / interaction.stageRect.height) * 100
      const movedPixels = Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY)

      if (movedPixels > 8) {
        clearLongPressTimer()
      }

      if (interaction.mode === 'resize') {
        const startOverlay = interaction.startOverlay
        const stageAspect = interaction.stageRect.width / interaction.stageRect.height
        const widthDelta = dx
        const heightDeltaAsWidth = (dy * startOverlay.aspectRatio) / stageAspect
        const nextWidth =
          startOverlay.width + (Math.abs(widthDelta) > Math.abs(heightDeltaAsWidth) ? widthDelta : heightDeltaAsWidth)
        const nextHeight = (nextWidth * stageAspect) / startOverlay.aspectRatio

        setOverlay(
          clampAspectLockedOverlay(
            {
              ...startOverlay,
              width: nextWidth,
              height: nextHeight,
            },
            stageAspect,
          ),
        )
        return
      }

      setOverlay(
        clampOverlay({
          ...interaction.startOverlay,
          x: interaction.startOverlay.x + dx,
          y: interaction.startOverlay.y + dy,
        }),
      )
    }

    const handlePointerUp = () => {
      clearLongPressTimer()
      setInteraction(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [clampAspectLockedOverlay, clampOverlay, interaction])

  const drawVideoCover = (context, video, canvasWidth, canvasHeight, digitalZoom) => {
    const videoAspect = video.videoWidth / video.videoHeight
    const canvasAspect = canvasWidth / canvasHeight
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight
    let sourceX = 0
    let sourceY = 0

    if (videoAspect > canvasAspect) {
      sourceWidth = video.videoHeight * canvasAspect
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = video.videoWidth / canvasAspect
      sourceY = (video.videoHeight - sourceHeight) / 2
    }

    if (digitalZoom > 1) {
      const zoomedWidth = sourceWidth / digitalZoom
      const zoomedHeight = sourceHeight / digitalZoom
      sourceX += (sourceWidth - zoomedWidth) / 2
      sourceY += (sourceHeight - zoomedHeight) / 2
      sourceWidth = zoomedWidth
      sourceHeight = zoomedHeight
    }

    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvasWidth,
      canvasHeight,
    )
  }

  const shareOrDownload = async (blob) => {
    const file = new File([blob], `framelens-${Date.now()}.jpg`, { type: 'image/jpeg' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'FrameLens photo',
        text: 'Captured with FrameLens.',
      })
      return
    }

    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.name
    link.click()
    URL.revokeObjectURL(downloadUrl)
  }

  const getCameraTrack = () => streamRef.current?.getVideoTracks()[0]

  const applyZoom = async (nextZoom) => {
    setZoomLevel(nextZoom)

    const track = getCameraTrack()

    if (!track || !hardwareZoom) return

    const constrainedZoom = Math.min(Math.max(nextZoom, hardwareZoom.min), hardwareZoom.max)

    try {
      await track.applyConstraints({
        advanced: [{ zoom: constrainedZoom }],
      })
    } catch {
      // Some mobile browsers expose zoom capabilities but reject changes at runtime.
    }
  }

  const removeReference = () => {
    releaseReferenceUrl()
    setReference(null)
    setShowDeleteControl(false)
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    const stageRect = stageRef.current?.getBoundingClientRect()

    if (!video || !stageRect || !video.videoWidth || !video.videoHeight) {
      return
    }

    try {
      const outputWidth = 1280
      const outputHeight = Math.round(outputWidth * (stageRect.height / stageRect.width))
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas is unavailable')
      }

      drawVideoCover(context, video, outputWidth, outputHeight, hardwareZoom ? 1 : zoomLevel)

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => {
            if (nextBlob) {
              resolve(nextBlob)
              return
            }

            reject(new Error('Canvas export failed'))
          },
          'image/jpeg',
          0.92,
        )
      })

      await shareOrDownload(blob)
    } catch {
      // Keep the camera UI free of visible app text.
    }
  }

  return (
    <main className="camera-app">
      <section className="camera-stage" ref={stageRef} aria-label="Camera">
        <video
          ref={videoRef}
          className="camera-feed"
          autoPlay
          muted
          playsInline
          style={{ transform: `scale(${hardwareZoom ? 1 : Math.max(1, zoomLevel)})` }}
        />

        <div className="grid-lines" aria-hidden="true" />

        {!cameraReady && (
          <button className="camera-retry" type="button" onClick={startCamera} aria-label="Start camera">
            <FaCamera aria-hidden="true" />
          </button>
        )}

        <div className="top-controls">
          <button className="icon-button" type="button" onClick={startCamera} aria-label="Restart camera">
            <FaRedo aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => referenceFileInputRef.current?.click()}
            aria-label="Choose reference image"
          >
            <FaImage aria-hidden="true" />
          </button>
        </div>

        <input
          ref={referenceFileInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={handleReferenceFile}
        />

        {reference && (
          <div
            className={`reference-overlay ${interaction ? 'is-active' : ''}`}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              width: `${overlay.width}%`,
              height: `${overlay.height}%`,
              opacity: overlayOpacity / 100,
            }}
            onPointerDown={(event) => beginOverlayInteraction(event, 'move')}
            role="presentation"
          >
            <img
              ref={referenceImageRef}
              src={reference.src}
              alt=""
              crossOrigin="anonymous"
              draggable="false"
              onLoad={(event) => {
                fitReferenceToStage(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
              }}
            />
            <span className="move-hint">
              <FaExpandArrowsAlt aria-hidden="true" />
            </span>
            {showDeleteControl && (
              <button className="delete-reference" type="button" onClick={removeReference} aria-label="Delete reference image">
                <FaTrash aria-hidden="true" />
              </button>
            )}
            <button
              className="resize-handle"
              type="button"
              aria-label="Resize reference overlay"
              onPointerDown={(event) => beginOverlayInteraction(event, 'resize')}
            />
          </div>
        )}

        <div className="focus-reticle" aria-hidden="true">
          <span />
        </div>

        <div className="opacity-control">
          <input
            id="opacity-slider"
            type="range"
            min="5"
            max="90"
            value={overlayOpacity}
            onChange={(event) => setOverlayOpacity(Number(event.target.value))}
            aria-label="Reference opacity"
          />
        </div>

        <div className="bottom-controls">
          <button
            className="reference-thumb"
            type="button"
            onClick={() => referenceFileInputRef.current?.click()}
            aria-label="Choose reference image"
          >
            {reference ? <img src={reference.src} alt="" /> : <FaImage aria-hidden="true" />}
          </button>

          <div className="center-controls">
            <div className="lens-selector" aria-label="Camera zoom">
              {LENS_OPTIONS.map((lens) => (
                <button
                  className={zoomLevel === lens ? 'is-selected' : ''}
                  key={lens}
                  type="button"
                  onClick={() => applyZoom(lens)}
                  aria-label={`Set camera zoom to ${lens}x`}
                >
                  {lens === 1 ? '1x' : lens}
                </button>
              ))}
            </div>
            <button className="shutter-button" type="button" onClick={capturePhoto} aria-label="Capture photo" />
          </div>

          <button className="icon-button bottom-icon" type="button" onClick={startCamera} aria-label="Restart camera">
            <FaCircleNotch aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
