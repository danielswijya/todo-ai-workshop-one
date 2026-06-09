import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

import {
  FaArrowsAlt,
  FaCamera,
  FaDownload,
  FaImage,
  FaLink,
  FaRedo,
  FaShareAlt,
} from 'react-icons/fa'

function App() {
  const videoRef = useRef(null)
  const stageRef = useRef(null)
  const referenceImageRef = useRef(null)
  const referenceFileInputRef = useRef(null)
  const streamRef = useRef(null)
  const objectUrlRef = useRef(null)

  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [reference, setReference] = useState(null)
  const [referenceStatus, setReferenceStatus] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [overlayOpacity, setOverlayOpacity] = useState(46)
  const [overlay, setOverlay] = useState({
    x: 18,
    y: 18,
    width: 64,
    height: 54,
  })
  const [interaction, setInteraction] = useState(null)
  const [captureStatus, setCaptureStatus] = useState('')

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
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support live camera access.')
      return
    }

    try {
      setCameraError('')
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

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (error) {
      setCameraReady(false)
      setCameraError(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow camera access in your browser settings and try again.'
          : 'Could not start the camera. Try refreshing or checking that another app is not using it.',
      )
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
      setOverlay({ x: 18, y: 18, width: 64, height: 54 })
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
    })
  }, [])

  const handleReferenceFile = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    releaseReferenceUrl()

    const src = URL.createObjectURL(file)
    objectUrlRef.current = src
    setReference({
      src,
      title: file.name,
      source: 'Your photo library',
    })
    setReferenceStatus('Reference loaded. Drag it around the preview and tune the opacity.')
    event.target.value = ''
  }

  const handleReferenceUrlSubmit = (event) => {
    event.preventDefault()

    const url = referenceUrl.trim()

    if (!url) return

    try {
      const parsedUrl = new URL(url)

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol')
      }

      releaseReferenceUrl()
      setReference({
        src: parsedUrl.href,
        title: parsedUrl.hostname.replace(/^www\./, ''),
        source: 'Image URL reference',
      })
      setReferenceUrl('')
      setReferenceStatus(
        'URL reference loaded. If a Pinterest page does not appear, save the pin image and upload it from your library.',
      )
    } catch {
      setReferenceStatus('Paste a valid direct image URL, or save the image and upload it from your photo library.')
    }
  }

  const clampOverlay = useCallback((nextOverlay) => {
    const minWidth = 14
    const minHeight = 14
    const width = Math.min(Math.max(nextOverlay.width, minWidth), 100)
    const height = Math.min(Math.max(nextOverlay.height, minHeight), 100)
    const x = Math.min(Math.max(nextOverlay.x, 0), 100 - width)
    const y = Math.min(Math.max(nextOverlay.y, 0), 100 - height)

    return { x, y, width, height }
  }, [])

  const beginOverlayInteraction = (event, mode) => {
    if (!reference || !stageRef.current) return

    event.preventDefault()
    event.stopPropagation()

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

      if (interaction.mode === 'resize') {
        setOverlay(
          clampOverlay({
            ...interaction.startOverlay,
            width: interaction.startOverlay.width + dx,
            height: interaction.startOverlay.height + dy,
          }),
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

    const handlePointerUp = () => setInteraction(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [clampOverlay, interaction])

  const drawVideoCover = (context, video, canvasWidth, canvasHeight) => {
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
        text: 'Captured with a reference overlay.',
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

  const capturePhoto = async () => {
    const video = videoRef.current
    const stageRect = stageRef.current?.getBoundingClientRect()

    if (!video || !stageRect || !video.videoWidth || !video.videoHeight) {
      setCaptureStatus('Start the camera before capturing a photo.')
      return
    }

    try {
      setCaptureStatus('Preparing your photo...')

      const outputWidth = 1280
      const outputHeight = Math.round(outputWidth * (stageRect.height / stageRect.width))
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight

      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas is unavailable')
      }

      drawVideoCover(context, video, outputWidth, outputHeight)

      if (reference && referenceImageRef.current?.complete) {
        context.save()
        context.globalAlpha = overlayOpacity / 100
        context.drawImage(
          referenceImageRef.current,
          (overlay.x / 100) * outputWidth,
          (overlay.y / 100) * outputHeight,
          (overlay.width / 100) * outputWidth,
          (overlay.height / 100) * outputHeight,
        )
        context.restore()
      }

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
      setCaptureStatus('Photo captured. Check your share sheet or downloads.')
    } catch {
      setCaptureStatus(
        'Could not save this shot. If you used a Pinterest URL, save that image locally and import it from your library.',
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">FrameLens</p>
        <h1>Practice better photos with a reference in your camera.</h1>
        <p className="hero-copy">
          Pick a pose, framing idea, or Pinterest-inspired reference, float it over the live camera,
          adjust the opacity, then capture and save the shot to your phone.
        </p>

        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            onClick={() => referenceFileInputRef.current?.click()}
          >
            <FaImage aria-hidden="true" />
            Choose reference
          </button>
          <button className="secondary-action" type="button" onClick={startCamera}>
            <FaRedo aria-hidden="true" />
            Restart camera
          </button>
        </div>

        <form className="url-import" onSubmit={handleReferenceUrlSubmit}>
          <label htmlFor="reference-url">Pinterest or image URL</label>
          <div className="url-input-row">
            <FaLink aria-hidden="true" />
            <input
              id="reference-url"
              type="url"
              inputMode="url"
              placeholder="Paste a direct image URL"
              value={referenceUrl}
              onChange={(event) => setReferenceUrl(event.target.value)}
            />
            <button type="submit">Use</button>
          </div>
        </form>

        <input
          ref={referenceFileInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={handleReferenceFile}
        />
      </section>

      <section className="camera-panel" aria-label="Camera preview">
        <div className="camera-stage" ref={stageRef}>
          <video ref={videoRef} className="camera-feed" autoPlay muted playsInline />

          {!cameraReady && (
            <div className="camera-placeholder">
              <FaCamera aria-hidden="true" />
              <p>{cameraError || 'Starting your camera...'}</p>
              {cameraError && (
                <button type="button" onClick={startCamera}>
                  Try camera again
                </button>
              )}
            </div>
          )}

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
                alt={`${reference.title} reference overlay`}
                crossOrigin="anonymous"
                draggable="false"
                onLoad={(event) => {
                  fitReferenceToStage(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
                }}
                onError={() => {
                  setReferenceStatus(
                    'That image URL could not be loaded. Save the image and import it from your library instead.',
                  )
                }}
              />
              <span className="move-hint">
                <FaArrowsAlt aria-hidden="true" />
              </span>
              <button
                className="resize-handle"
                type="button"
                aria-label="Resize reference overlay"
                onPointerDown={(event) => beginOverlayInteraction(event, 'resize')}
              />
            </div>
          )}

          <div className="opacity-card">
            <label htmlFor="opacity-slider">Reference opacity</label>
            <div className="slider-row">
              <input
                id="opacity-slider"
                type="range"
                min="5"
                max="90"
                value={overlayOpacity}
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
              />
              <span>{overlayOpacity}%</span>
            </div>
          </div>
        </div>

        <div className="camera-controls">
          <div>
            <p className="reference-title">{reference ? reference.title : 'No reference selected'}</p>
            {reference?.source && <p className="reference-source">{reference.source}</p>}
            <p className="reference-status">
              {referenceStatus ||
                'Choose an image from your library, or paste a direct Pinterest/image URL to begin.'}
            </p>
          </div>
          <button className="capture-button" type="button" onClick={capturePhoto}>
            <FaCamera aria-hidden="true" />
            Capture photo
          </button>
          <button className="save-button" type="button" onClick={capturePhoto}>
            <FaShareAlt aria-hidden="true" />
            <FaDownload aria-hidden="true" />
            Save
          </button>
        </div>

        {captureStatus && <p className="capture-status">{captureStatus}</p>}
      </section>
    </main>
  )
}

export default App
