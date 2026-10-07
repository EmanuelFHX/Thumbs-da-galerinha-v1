import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import {
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva'
import './editor.css'

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 540
const DEFAULT_COLOR = '#ff5c7a'
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const STICKERS = [
  { name: 'Estrela', source: '/stickers/star.svg' },
  { name: 'Balão', source: '/stickers/speech.svg' },
  { name: 'Fogo', source: '/stickers/fire.svg' },
]
const BRUSH_PRESETS = [
  { id: 'pencil', label: 'Lápis', size: 4, opacity: 1, softness: 0 },
  { id: 'marker', label: 'Marcador', size: 16, opacity: 1, softness: 1 },
  { id: 'highlighter', label: 'Marca-texto', size: 30, opacity: 0.35, softness: 0 },
]
const FONT_OPTIONS = [
  { label: 'Doodle', value: 'Arial Rounded MT Bold, Trebuchet MS' },
  { label: 'Impacto', value: 'Impact, Haettenschweiler, Arial Narrow Bold' },
  { label: 'Limpa', value: 'Trebuchet MS, Arial' },
  { label: 'Editorial', value: 'Georgia, Times New Roman' },
  { label: 'Mono', value: 'Courier New, monospace' },
  { label: 'Quadrinhos', value: 'Comic Sans MS, Comic Sans, cursive' },
]
const TYPOGRAPHY_PRESETS = [
  {
    id: 'doodle',
    label: 'Doodle',
    styles: {
      fontFamily: FONT_OPTIONS[0].value,
      fontWeight: 'bold',
      italic: false,
      fill: '#ff5c7a',
      stroke: '#25232b',
      strokeWidth: 3,
      shadowEnabled: true,
      shadowColor: '#25232b',
      shadowBlur: 0,
      shadowOffsetX: 7,
      shadowOffsetY: 7,
      align: 'left',
    },
  },
  {
    id: 'meme',
    label: 'Meme',
    styles: {
      fontFamily: FONT_OPTIONS[1].value,
      fontWeight: 'normal',
      italic: false,
      fill: '#ffffff',
      stroke: '#111111',
      strokeWidth: 6,
      shadowEnabled: false,
      align: 'center',
      letterSpacing: 1,
    },
  },
  {
    id: 'pop',
    label: 'Pop',
    styles: {
      fontFamily: FONT_OPTIONS[2].value,
      fontWeight: 'bold',
      italic: true,
      fill: '#ffd447',
      stroke: '#25232b',
      strokeWidth: 4,
      shadowEnabled: true,
      shadowColor: '#ff5c7a',
      shadowBlur: 0,
      shadowOffsetX: 8,
      shadowOffsetY: 8,
      align: 'center',
    },
  },
]

function getInitialTool() {
  const requestedTool = new URLSearchParams(window.location.search).get('tool')
  return ['brush', 'eraser', 'eyedropper', 'stickers'].includes(requestedTool)
    ? requestedTool
    : 'select'
}

function getInitialSidePanel() {
  return new URLSearchParams(window.location.search).get('panel') === 'layers'
    ? 'layers'
    : 'properties'
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function getSnappedPosition(node) {
  const threshold = 10
  const bounds = node.getClientRect({ skipShadow: true })
  const nextPosition = { x: node.x(), y: node.y() }
  const horizontalCenter = bounds.x + bounds.width / 2
  const verticalCenter = bounds.y + bounds.height / 2

  if (Math.abs(bounds.x) <= threshold) nextPosition.x -= bounds.x
  if (Math.abs(bounds.x + bounds.width - CANVAS_WIDTH) <= threshold) {
    nextPosition.x += CANVAS_WIDTH - bounds.x - bounds.width
  }
  if (Math.abs(horizontalCenter - CANVAS_WIDTH / 2) <= threshold) {
    nextPosition.x += CANVAS_WIDTH / 2 - horizontalCenter
  }
  if (Math.abs(bounds.y) <= threshold) nextPosition.y -= bounds.y
  if (Math.abs(bounds.y + bounds.height - CANVAS_HEIGHT) <= threshold) {
    nextPosition.y += CANVAS_HEIGHT - bounds.y - bounds.height
  }
  if (Math.abs(verticalCenter - CANVAS_HEIGHT / 2) <= threshold) {
    nextPosition.y += CANVAS_HEIGHT / 2 - verticalCenter
  }

  return nextPosition
}

function useCanvasImage(source) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (!source) {
      return undefined
    }

    const nextImage = new window.Image()
    nextImage.src = source
    nextImage.onload = () => setImage(nextImage)

    return () => {
      nextImage.onload = null
    }
  }, [source])

  return image
}

function EditableNode({ element, isInteractive, isSelected, onChange, onSelect }) {
  const nodeRef = useRef(null)
  const transformerRef = useRef(null)
  const elementImage = useCanvasImage(element.type === 'image' ? element.source : null)

  useEffect(() => {
    if (!isSelected || !transformerRef.current || !nodeRef.current) return
    transformerRef.current.nodes([nodeRef.current])
    transformerRef.current.getLayer().batchDraw()
  }, [elementImage, isSelected])

  useEffect(() => {
    if (element.type !== 'image' || !elementImage || !nodeRef.current) return
    nodeRef.current.clearCache()
    nodeRef.current.cache({ pixelRatio: 1 })
    nodeRef.current.getLayer()?.batchDraw()
  }, [
    element.blur,
    element.brightness,
    element.contrast,
    element.grayscale,
    element.saturation,
    element.type,
    elementImage,
  ])

  const sharedProps = {
    ref: nodeRef,
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation ?? 0,
    scaleX: element.scaleX ?? 1,
    scaleY: element.scaleY ?? 1,
    opacity: element.opacity ?? 1,
    draggable: isInteractive,
    listening: isInteractive,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event) => {
      const snappedPosition = getSnappedPosition(event.target)
      event.target.position(snappedPosition)
      onChange({
        ...element,
        x: snappedPosition.x,
        y: snappedPosition.y,
      })
    },
    onTransformEnd: () => {
      const node = nodeRef.current
      onChange({
        ...element,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      })
    },
  }

  let shape = null

  if (element.type === 'text') {
    const fontStyle = [
      element.fontWeight === 'normal' ? null : 'bold',
      element.italic ? 'italic' : null,
    ].filter(Boolean).join(' ') || 'normal'

    shape = (
      <Text
        {...sharedProps}
        text={element.text}
        fill={element.fill}
        width={element.width ?? 460}
        fontFamily={element.fontFamily ?? FONT_OPTIONS[0].value}
        fontSize={element.fontSize}
        fontStyle={fontStyle}
        textDecoration={element.underline ? 'underline' : ''}
        align={element.align ?? 'left'}
        letterSpacing={element.letterSpacing ?? 0}
        lineHeight={element.lineHeight ?? 1.05}
        stroke={element.strokeWidth > 0 ? element.stroke : undefined}
        strokeWidth={element.strokeWidth ?? 0}
        shadowColor={element.shadowColor ?? '#25232b'}
        shadowBlur={element.shadowEnabled ? (element.shadowBlur ?? 0) : 0}
        shadowOffsetX={element.shadowEnabled ? (element.shadowOffsetX ?? 7) : 0}
        shadowOffsetY={element.shadowEnabled ? (element.shadowOffsetY ?? 7) : 0}
        shadowOpacity={element.shadowEnabled ? 0.85 : 0}
        padding={10}
      />
    )
  }

  if (element.type === 'rect') {
    shape = (
      <Rect
        {...sharedProps}
        width={element.width}
        height={element.height}
        cropX={element.cropX ?? 0}
        cropY={element.cropY ?? 0}
        cropWidth={element.cropWidth ?? element.sourceWidth}
        cropHeight={element.cropHeight ?? element.sourceHeight}
        fill={element.fill}
        stroke="#25232b"
        strokeWidth={5}
        cornerRadius={8}
        shadowColor="#25232b"
        shadowOffset={{ x: 8, y: 8 }}
        shadowOpacity={1}
      />
    )
  }

  if (element.type === 'circle') {
    shape = (
      <Circle
        {...sharedProps}
        radius={element.radius}
        fill={element.fill}
        stroke="#25232b"
        strokeWidth={5}
        shadowColor="#25232b"
        shadowOffset={{ x: 8, y: 8 }}
        shadowOpacity={1}
      />
    )
  }

  if (element.type === 'image' && elementImage) {
    const imageFilters = [
      Konva.Filters.Brightness,
      Konva.Filters.Contrast,
      Konva.Filters.HSL,
      Konva.Filters.Blur,
    ]
    if (element.grayscale) imageFilters.push(Konva.Filters.Grayscale)

    shape = (
      <KonvaImage
        {...sharedProps}
        image={elementImage}
        width={element.width}
        height={element.height}
        filters={imageFilters}
        brightness={element.brightness ?? 1}
        contrast={element.contrast ?? 0}
        saturation={element.saturation ?? 0}
        blurRadius={element.blur ?? 0}
        shadowColor="#25232b"
        shadowOffset={{ x: 7, y: 7 }}
        shadowOpacity={0.48}
      />
    )
  }

  return (
    <>
      {shape}
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateAnchorOffset={28}
          borderStroke="#146db7"
          anchorFill="#fff7e8"
          anchorStroke="#25232b"
          anchorStrokeWidth={2}
          anchorSize={11}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 24 || Math.abs(newBox.height) < 24) {
              return oldBox
            }
            return newBox
          }}
        />
      )}
    </>
  )
}

function ToolButton({ active = false, children, onClick, title }) {
  return (
    <button
      className={`tool-button${active ? ' is-active' : ''}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
    >
      {children}
    </button>
  )
}

function getLayerLabel(element, index) {
  if (element.type === 'text') return element.text || 'Texto vazio'
  if (element.type === 'image') return element.source.startsWith('/stickers/') ? 'Sticker' : 'Imagem'
  if (element.type === 'line') {
    return element.mode === 'eraser' ? `Borracha ${index + 1}` : `Traço ${index + 1}`
  }
  if (element.type === 'circle') return 'Círculo'
  return 'Retângulo'
}

function EditorScreen({ onBack }) {
  const stageRef = useRef(null)
  const canvasFrameRef = useRef(null)
  const fileInputRef = useRef(null)
  const isDrawing = useRef(false)
  const drawingStart = useRef([])
  const isSpacePressed = useRef(false)
  const panStart = useRef(null)
  const shortcutActions = useRef(null)
  const baseImage = useCanvasImage('/sample-base.svg')

  const [tool, setTool] = useState(getInitialTool)
  const [sidePanel, setSidePanel] = useState(getInitialSidePanel)
  const [brushColor, setBrushColor] = useState('#ff5c7a')
  const [brushSize, setBrushSize] = useState(10)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [brushSoftness, setBrushSoftness] = useState(0)
  const [eraserSize, setEraserSize] = useState(34)
  const [selectedId, setSelectedId] = useState(null)
  const [elements, setElements] = useState([])
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [status, setStatus] = useState('Escolha uma ferramenta e comece a criar.')
  const [zoom, setZoom] = useState(1)
  const [fitMode, setFitMode] = useState(true)
  const [spaceDown, setSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const selectedElement = elements.find((element) => element.id === selectedId)

  function commit(nextElements, message) {
    setPast((current) => [...current, elements])
    setElements(nextElements)
    setFuture([])
    if (message) setStatus(message)
  }

  function addText() {
    const nextElement = {
      id: createId('text'),
      type: 'text',
      x: 250,
      y: 210,
      text: 'Seu texto',
      fontSize: 64,
      width: 460,
      fontFamily: FONT_OPTIONS[0].value,
      fontWeight: 'bold',
      italic: false,
      underline: false,
      align: 'left',
      letterSpacing: 0,
      lineHeight: 1.05,
      fill: DEFAULT_COLOR,
      stroke: '#25232b',
      strokeWidth: 3,
      shadowEnabled: true,
      shadowColor: '#25232b',
      shadowBlur: 0,
      shadowOffsetX: 7,
      shadowOffsetY: 7,
      rotation: -2,
    }
    commit([...elements, nextElement], 'Texto adicionado. Arraste ou redimensione pelas alças.')
    setSelectedId(nextElement.id)
    setTool('select')
    setSidePanel('properties')
  }

  function addShape(type) {
    const nextElement = type === 'circle'
      ? {
          id: createId('circle'),
          type: 'circle',
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          radius: 74,
          fill: '#ffd447',
        }
      : {
          id: createId('rect'),
          type: 'rect',
          x: 350,
          y: 190,
          width: 260,
          height: 150,
          fill: '#49a8ff',
          rotation: -2,
        }

    commit([...elements, nextElement], 'Forma adicionada ao canvas.')
    setSelectedId(nextElement.id)
    setTool('select')
    setSidePanel('properties')
  }

  function addImage(source, width, height, message, options = {}) {
    const maxWidth = 360
    const maxHeight = 260
    const scale = Math.min(maxWidth / width, maxHeight / height, 1)
    const nextWidth = Math.round(width * scale)
    const nextHeight = Math.round(height * scale)
    const nextElement = {
      id: createId('image'),
      type: 'image',
      kind: options.kind ?? 'photo',
      source,
      sourceWidth: width,
      sourceHeight: height,
      cropX: 0,
      cropY: 0,
      cropWidth: width,
      cropHeight: height,
      x: Math.round((CANVAS_WIDTH - nextWidth) / 2),
      y: Math.round((CANVAS_HEIGHT - nextHeight) / 2),
      width: nextWidth,
      height: nextHeight,
      brightness: 1,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false,
    }

    commit([...elements, nextElement], message)
    setSelectedId(nextElement.id)
    setTool('select')
    setSidePanel('properties')
  }

  function addSticker(sticker) {
    addImage(
      sticker.source,
      180,
      180,
      `${sticker.name} adicionado ao canvas.`,
      { kind: 'sticker' },
    )
  }

  function handleImageUpload(event) {
    const [file] = event.target.files
    event.target.value = ''

    if (!file) return

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!supportedTypes.includes(file.type)) {
      setStatus('Use uma imagem PNG, JPEG ou WebP.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setStatus('A imagem deve ter no máximo 8 MB.')
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setStatus('Não foi possível ler essa imagem.')
    reader.onload = () => {
      const image = new window.Image()
      image.onerror = () => setStatus('O arquivo não pôde ser aberto como imagem.')
      image.onload = () => {
        addImage(reader.result, image.naturalWidth, image.naturalHeight, 'Imagem adicionada ao canvas.')
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  function updateElement(updatedElement) {
    commit(
      elements.map((element) => (
        element.id === updatedElement.id ? updatedElement : element
      )),
      'Elemento atualizado.',
    )
  }

  function updateSelected(patch) {
    if (!selectedElement) return
    updateElement({ ...selectedElement, ...patch })
  }

  function deleteSelected() {
    if (!selectedId) return
    commit(
      elements.filter((element) => element.id !== selectedId),
      'Elemento excluído.',
    )
    setSelectedId(null)
  }

  function moveSelected(direction) {
    const currentIndex = elements.findIndex((element) => element.id === selectedId)
    const nextIndex = currentIndex + direction

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= elements.length) return

    const reordered = [...elements]
    const [movedElement] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, movedElement)
    commit(reordered, direction > 0 ? 'Elemento movido para frente.' : 'Elemento movido para trás.')
  }

  function duplicateSelected() {
    if (!selectedElement) return
    const duplicate = {
      ...selectedElement,
      id: createId(selectedElement.type),
      x: selectedElement.x + 24,
      y: selectedElement.y + 24,
      locked: false,
      visible: true,
    }
    commit([...elements, duplicate], 'Elemento duplicado.')
    setSelectedId(duplicate.id)
  }

  function toggleLayerVisibility(element) {
    updateElement({ ...element, visible: element.visible === false })
    if (element.id === selectedId && element.visible !== false) setSelectedId(null)
  }

  function toggleLayerLock(element) {
    updateElement({ ...element, locked: !element.locked })
  }

  function resetImageAdjustments() {
    updateSelected({
      brightness: 1,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false,
    })
  }

  function setZoomLevel(nextZoom) {
    const frame = canvasFrameRef.current
    const previousZoom = zoom
    const normalizedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)

    setFitMode(false)
    setZoom(normalizedZoom)

    if (!frame) return
    const centerX = frame.scrollLeft + frame.clientWidth / 2
    const centerY = frame.scrollTop + frame.clientHeight / 2
    const ratio = normalizedZoom / previousZoom

    requestAnimationFrame(() => {
      frame.scrollLeft = centerX * ratio - frame.clientWidth / 2
      frame.scrollTop = centerY * ratio - frame.clientHeight / 2
    })
  }

  function fitCanvas() {
    const frame = canvasFrameRef.current
    if (!frame) return

    const nextZoom = clamp(
      Math.min(
        (frame.clientWidth - 36) / CANVAS_WIDTH,
        (frame.clientHeight - 36) / CANVAS_HEIGHT,
      ),
      MIN_ZOOM,
      1,
    )

    setFitMode(true)
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      frame.scrollLeft = Math.max(0, (CANVAS_WIDTH * nextZoom - frame.clientWidth) / 2)
      frame.scrollTop = Math.max(0, (CANVAS_HEIGHT * nextZoom - frame.clientHeight) / 2)
    })
  }

  function handleCanvasWheel(event) {
    event.preventDefault()
    setZoomLevel(zoom + (event.deltaY > 0 ? -0.1 : 0.1))
  }

  function startPan(event) {
    if (!isSpacePressed.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    }
    setIsPanning(true)
  }

  function continuePan(event) {
    if (!isPanning || !panStart.current) return
    const frame = event.currentTarget
    frame.scrollLeft = panStart.current.scrollLeft - (event.clientX - panStart.current.x)
    frame.scrollTop = panStart.current.scrollTop - (event.clientY - panStart.current.y)
  }

  function finishPan(event) {
    if (!isPanning) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    panStart.current = null
    setIsPanning(false)
  }

  function alignSelected(alignment) {
    if (!selectedId) return
    const node = stageRef.current?.findOne(`#${selectedId}`)
    if (!node) return

    const bounds = node.getClientRect({ skipShadow: true })
    let deltaX = 0
    let deltaY = 0

    if (alignment === 'left') deltaX = -bounds.x
    if (alignment === 'center-x') deltaX = CANVAS_WIDTH / 2 - bounds.x - bounds.width / 2
    if (alignment === 'right') deltaX = CANVAS_WIDTH - bounds.x - bounds.width
    if (alignment === 'top') deltaY = -bounds.y
    if (alignment === 'center-y') deltaY = CANVAS_HEIGHT / 2 - bounds.y - bounds.height / 2
    if (alignment === 'bottom') deltaY = CANVAS_HEIGHT - bounds.y - bounds.height

    updateSelected({
      x: selectedElement.x + deltaX,
      y: selectedElement.y + deltaY,
    })
  }

  function flipSelected(axis) {
    if (!selectedId || selectedElement?.type === 'line') return
    const node = stageRef.current?.findOne(`#${selectedId}`)
    if (!node) return

    const before = node.getClientRect({ skipShadow: true })
    const originalScaleX = node.scaleX()
    const originalScaleY = node.scaleY()

    if (axis === 'x') node.scaleX(-originalScaleX)
    if (axis === 'y') node.scaleY(-originalScaleY)
    const after = node.getClientRect({ skipShadow: true })
    node.scale({ x: originalScaleX, y: originalScaleY })

    updateSelected({
      x: selectedElement.x + before.x + before.width / 2 - after.x - after.width / 2,
      y: selectedElement.y + before.y + before.height / 2 - after.y - after.height / 2,
      scaleX: axis === 'x' ? -(selectedElement.scaleX ?? 1) : (selectedElement.scaleX ?? 1),
      scaleY: axis === 'y' ? -(selectedElement.scaleY ?? 1) : (selectedElement.scaleY ?? 1),
    })
  }

  function applyCropRatio(ratio) {
    if (selectedElement?.type !== 'image' || selectedElement.kind === 'sticker') return

    const sourceWidth = selectedElement.sourceWidth
    const sourceHeight = selectedElement.sourceHeight
    let cropWidth = sourceWidth
    let cropHeight = sourceHeight

    if (ratio && sourceWidth / sourceHeight > ratio) cropWidth = sourceHeight * ratio
    if (ratio && sourceWidth / sourceHeight < ratio) cropHeight = sourceWidth / ratio

    const displayMax = Math.max(selectedElement.width, selectedElement.height)
    const displayRatio = cropWidth / cropHeight
    const displayWidth = displayRatio >= 1 ? displayMax : displayMax * displayRatio
    const displayHeight = displayRatio >= 1 ? displayMax / displayRatio : displayMax

    updateSelected({
      cropX: (sourceWidth - cropWidth) / 2,
      cropY: (sourceHeight - cropHeight) / 2,
      cropWidth,
      cropHeight,
      width: Math.round(displayWidth),
      height: Math.round(displayHeight),
    })
  }

  useEffect(() => {
    const frame = canvasFrameRef.current
    if (!frame) return undefined

    const observer = new ResizeObserver(() => {
      if (!fitMode) return
      const nextZoom = clamp(
        Math.min(
          (frame.clientWidth - 36) / CANVAS_WIDTH,
          (frame.clientHeight - 36) / CANVAS_HEIGHT,
        ),
        MIN_ZOOM,
        1,
      )
      setZoom(nextZoom)
    })

    observer.observe(frame)
    if (fitMode) fitCanvas()
    return () => observer.disconnect()
  }, [fitMode])

  useEffect(() => {
    shortcutActions.current = {
      deleteSelected,
      duplicateSelected,
      fitCanvas,
      redo,
      selectedId,
      setZoomLevel,
      undo,
      zoom,
    }
  })

  useEffect(() => {
    function isTypingTarget(target) {
      return target instanceof HTMLElement
        && (target.matches('input, textarea, select') || target.isContentEditable)
    }

    function handleKeyDown(event) {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault()
        isSpacePressed.current = true
        setSpaceDown(true)
        return
      }

      if (isTypingTarget(event.target)) return
      const hasModifier = event.ctrlKey || event.metaKey
      const actions = shortcutActions.current
      if (!actions) return

      if (!hasModifier && event.key.toLowerCase() === 'b') {
        setTool('brush')
        setSelectedId(null)
        setSidePanel('properties')
        setStatus('Pincel selecionado.')
      }
      if (!hasModifier && event.key.toLowerCase() === 'e') {
        setTool('eraser')
        setSelectedId(null)
        setSidePanel('properties')
        setStatus('Borracha selecionada.')
      }
      if (!hasModifier && event.key.toLowerCase() === 'i') {
        setTool('eyedropper')
        setSelectedId(null)
        setSidePanel('properties')
        setStatus('Clique em uma cor do canvas para capturá-la.')
      }

      if (hasModifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) actions.redo()
        else actions.undo()
      }
      if (hasModifier && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        actions.duplicateSelected()
      }
      if (hasModifier && event.key === '0') {
        event.preventDefault()
        actions.fitCanvas()
      }
      if (hasModifier && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        actions.setZoomLevel(actions.zoom + 0.1)
      }
      if (hasModifier && event.key === '-') {
        event.preventDefault()
        actions.setZoomLevel(actions.zoom - 0.1)
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && actions.selectedId) {
        event.preventDefault()
        actions.deleteSelected()
      }
    }

    function handleKeyUp(event) {
      if (event.code !== 'Space') return
      isSpacePressed.current = false
      setSpaceDown(false)
      setIsPanning(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  function undo() {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture([elements, ...future])
    setElements(previous)
    setSelectedId(null)
    setStatus('Ação desfeita.')
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast([...past, elements])
    setElements(next)
    setSelectedId(null)
    setStatus('Ação refeita.')
  }

  function applyBrushPreset(preset) {
    setBrushSize(preset.size)
    setBrushOpacity(preset.opacity)
    setBrushSoftness(preset.softness)
    setStatus(`Pincel ${preset.label.toLowerCase()} selecionado.`)
  }

  function applyTypographyPreset(preset) {
    if (!selectedElement || selectedElement.type !== 'text') return
    commit(
      elements.map((element) => (
        element.id === selectedElement.id ? { ...element, ...preset.styles } : element
      )),
      `Estilo ${preset.label} aplicado ao texto.`,
    )
  }

  function sampleCanvasColor(event) {
    const stage = stageRef.current
    const point = event.target.getStage().getPointerPosition()
    const transformers = stage.find('Transformer')
    transformers.forEach((transformer) => transformer.visible(false))
    stage.batchDraw()

    let pixel
    try {
      const sample = stage.toCanvas({
        x: Math.floor(point.x),
        y: Math.floor(point.y),
        width: 1,
        height: 1,
        pixelRatio: 1,
      })
      pixel = sample.getContext('2d').getImageData(0, 0, 1, 1).data
    } catch {
      setStatus('Não foi possível capturar essa cor. Tente outro ponto do canvas.')
      return
    } finally {
      transformers.forEach((transformer) => transformer.visible(true))
      stage.batchDraw()
    }

    const [red, green, blue, alpha] = pixel

    if (alpha === 0) {
      setStatus('Essa área é transparente. Escolha outra cor no canvas.')
      return
    }

    const color = `#${[red, green, blue]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`
    setBrushColor(color)
    setTool('brush')
    setSidePanel('properties')
    setStatus(`Cor ${color.toUpperCase()} capturada pelo conta-gotas.`)
  }

  function beginDrawing(event) {
    if (isSpacePressed.current) return

    if (tool === 'eyedropper') {
      sampleCanvasColor(event)
      return
    }

    if (tool !== 'brush' && tool !== 'eraser') {
      if (event.target === event.target.getStage()) setSelectedId(null)
      return
    }

    event.evt.preventDefault()
    isDrawing.current = true
    drawingStart.current = elements
    const point = event.target.getStage().getPointerPosition()
    const nextLine = {
      id: createId('line'),
      type: 'line',
      points: [point.x, point.y, point.x, point.y],
      mode: tool,
      stroke: tool === 'eraser' ? '#000000' : brushColor,
      strokeWidth: tool === 'eraser' ? eraserSize : brushSize,
      opacity: tool === 'eraser' ? 1 : brushOpacity,
      softness: tool === 'eraser' ? 0 : brushSoftness,
    }
    setElements([...elements, nextLine])
    setSelectedId(null)
  }

  function continueDrawing(event) {
    if (!isDrawing.current || (tool !== 'brush' && tool !== 'eraser')) return
    event.evt.preventDefault()
    const point = event.target.getStage().getPointerPosition()

    setElements((current) => {
      const next = [...current]
      const lastLine = next[next.length - 1]
      next[next.length - 1] = {
        ...lastLine,
        points: [...lastLine.points, point.x, point.y],
      }
      return next
    })
  }

  function finishDrawing() {
    if (!isDrawing.current) return
    isDrawing.current = false
    setPast((current) => [...current, drawingStart.current])
    setFuture([])
    setStatus(tool === 'eraser' ? 'Área apagada.' : 'Traço adicionado.')
  }

  function exportImage() {
    const stage = stageRef.current
    const transformers = stage.find('Transformer')
    transformers.forEach((transformer) => transformer.visible(false))
    stage.batchDraw()

    const dataUrl = stage.toDataURL({ pixelRatio: 2 })

    transformers.forEach((transformer) => transformer.visible(true))
    stage.batchDraw()
    const link = document.createElement('a')
    link.download = 'thumb-da-galerinha.png'
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
    setStatus('Imagem exportada em PNG.')
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <button className="back-button" type="button" onClick={onBack}>← Menu</button>
        <div>
          <span className="round-label">Rodada de teste</span>
          <strong>Transforme o passeio em uma aventura impossível</strong>
        </div>
        <div className="timer" aria-label="Quatro minutos restantes">04:00</div>
        <button className="finish-button" type="button" onClick={exportImage}>
          Exportar PNG
        </button>
      </header>

      <div className="editor-workspace">
        <aside className="tool-rail" aria-label="Ferramentas do editor">
          <ToolButton
            active={tool === 'select'}
            onClick={() => setTool('select')}
            title="Selecionar e mover"
          >
            <i className="bi bi-cursor-fill" aria-hidden="true" />
            Selecionar
          </ToolButton>
          <ToolButton onClick={addText} title="Adicionar texto">
            <i className="bi bi-fonts" aria-hidden="true" />
            Texto
          </ToolButton>
          <ToolButton
            active={tool === 'brush'}
            onClick={() => {
              setTool('brush')
              setSelectedId(null)
              setSidePanel('properties')
            }}
            title="Desenhar à mão livre"
          >
            <i className="bi bi-brush-fill" aria-hidden="true" />
            Pincel
          </ToolButton>
          <ToolButton
            active={tool === 'eraser'}
            onClick={() => {
              setTool('eraser')
              setSelectedId(null)
              setSidePanel('properties')
            }}
            title="Apagar conteúdo desenhado"
          >
            <i className="bi bi-eraser-fill" aria-hidden="true" />
            Borracha
          </ToolButton>
          <ToolButton
            active={tool === 'eyedropper'}
            onClick={() => {
              setTool('eyedropper')
              setSelectedId(null)
              setSidePanel('properties')
              setStatus('Clique em uma cor do canvas para capturá-la.')
            }}
            title="Capturar cor do canvas"
          >
            <i className="bi bi-eyedropper" aria-hidden="true" />
            Conta-gotas
          </ToolButton>
          <ToolButton onClick={() => addShape('rect')} title="Adicionar retângulo">
            <i className="bi bi-square" aria-hidden="true" />
            Retângulo
          </ToolButton>
          <ToolButton onClick={() => addShape('circle')} title="Adicionar círculo">
            <i className="bi bi-circle" aria-hidden="true" />
            Círculo
          </ToolButton>
          <ToolButton onClick={() => fileInputRef.current?.click()} title="Importar imagem">
            <i className="bi bi-image" aria-hidden="true" />
            Imagem
          </ToolButton>
          <ToolButton
            active={tool === 'stickers'}
            onClick={() => {
              setTool('stickers')
              setSelectedId(null)
            }}
            title="Abrir stickers"
          >
            <i className="bi bi-star-fill" aria-hidden="true" />
            Stickers
          </ToolButton>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageUpload}
            tabIndex={-1}
          />
        </aside>

        <section className="canvas-column" aria-label="Área de edição">
          <div className="history-bar">
            <div className="history-actions">
              <button type="button" onClick={undo} disabled={past.length === 0}>↶ Desfazer</button>
              <button type="button" onClick={redo} disabled={future.length === 0}>↷ Refazer</button>
            </div>
            <div className="zoom-controls" aria-label="Controles de zoom">
              <button type="button" onClick={() => setZoomLevel(zoom - 0.1)} aria-label="Diminuir zoom">−</button>
              <button
                type="button"
                className={fitMode ? 'is-fit' : ''}
                onClick={fitCanvas}
                title="Ajustar à tela (Ctrl+0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => setZoomLevel(zoom + 0.1)} aria-label="Aumentar zoom">+</button>
            </div>
            <span className="canvas-dimensions">{CANVAS_WIDTH} × {CANVAS_HEIGHT}</span>
          </div>

          <div
            ref={canvasFrameRef}
            className={`canvas-frame${tool === 'brush' || tool === 'eraser' ? ' is-drawing' : ''}${tool === 'eyedropper' ? ' is-eyedropper' : ''}${spaceDown ? ' is-pan-ready' : ''}${isPanning ? ' is-panning' : ''}`}
            onWheel={handleCanvasWheel}
            onPointerDown={startPan}
            onPointerMove={continuePan}
            onPointerUp={finishPan}
            onPointerCancel={finishPan}
          >
            <div
              className="stage-scaler"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom,
              }}
            >
              <div
                className="stage-transform"
                style={{ transform: `scale(${zoom})` }}
              >
                <Stage
                  ref={stageRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  onMouseDown={beginDrawing}
                  onMouseMove={continueDrawing}
                  onMouseUp={finishDrawing}
                  onMouseLeave={finishDrawing}
                  onTouchStart={beginDrawing}
                  onTouchMove={continueDrawing}
                  onTouchEnd={finishDrawing}
                >
                  <Layer listening={false}>
                    <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#dcefff" listening={false} />
                    {baseImage && (
                      <KonvaImage
                        image={baseImage}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        listening={false}
                      />
                    )}
                  </Layer>

                  <Layer>
                    {elements.map((element) => {
                      if (element.visible === false) return null

                      if (element.type === 'line') {
                        return (
                          <Line
                            key={element.id}
                            points={element.points}
                            stroke={element.stroke}
                            strokeWidth={element.strokeWidth}
                            opacity={element.opacity ?? 1}
                            shadowColor={element.stroke}
                            shadowBlur={element.softness ?? 0}
                            shadowOpacity={element.mode === 'eraser' ? 0 : (element.opacity ?? 1) * 0.65}
                            tension={0.35}
                            lineCap="round"
                            lineJoin="round"
                            globalCompositeOperation={element.mode === 'eraser' ? 'destination-out' : 'source-over'}
                            listening={false}
                          />
                        )
                      }

                      return (
                        <EditableNode
                          key={element.id}
                          element={element}
                          isInteractive={tool === 'select' && !element.locked}
                          isSelected={selectedId === element.id && !element.locked}
                          onSelect={() => {
                            if (tool === 'select') {
                              setSelectedId(element.id)
                              setSidePanel('properties')
                            }
                          }}
                          onChange={updateElement}
                        />
                      )
                    })}
                  </Layer>
                </Stage>
              </div>
            </div>
          </div>

          <p className="editor-status" aria-live="polite">{status}</p>
        </section>

        <aside className="properties-panel" aria-label="Painel lateral do editor">
          <div className="panel-tape" aria-hidden="true" />
          <div className="panel-tabs" role="tablist" aria-label="Painéis do editor">
            <button
              type="button"
              role="tab"
              aria-selected={sidePanel === 'properties'}
              className={sidePanel === 'properties' ? 'is-active' : ''}
              onClick={() => setSidePanel('properties')}
            >
              Ajustes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePanel === 'layers'}
              className={sidePanel === 'layers' ? 'is-active' : ''}
              onClick={() => setSidePanel('layers')}
            >
              Camadas <span>{elements.length + 1}</span>
            </button>
          </div>

          {sidePanel === 'layers' ? (
            <div className="layers-panel" role="tabpanel">
              <div className="layer-list">
                {[...elements].reverse().map((element, reversedIndex) => {
                  const originalIndex = elements.length - reversedIndex - 1
                  const isCurrent = element.id === selectedId
                  return (
                    <div
                      key={element.id}
                      className={`layer-item${isCurrent ? ' is-selected' : ''}${element.visible === false ? ' is-hidden' : ''}`}
                    >
                      <button
                        className="layer-select"
                        type="button"
                        onClick={() => {
                          if (element.visible === false) return
                          setSelectedId(element.id)
                          setTool('select')
                          setSidePanel('properties')
                        }}
                      >
                        <span className="layer-kind" aria-hidden="true">
                          {element.type === 'text' ? 'T' : element.type === 'line' ? '✎' : '▧'}
                        </span>
                        <span>{getLayerLabel(element, originalIndex)}</span>
                      </button>
                      <button
                        className="layer-action"
                        type="button"
                        onClick={() => toggleLayerVisibility(element)}
                        aria-label={element.visible === false ? 'Mostrar camada' : 'Ocultar camada'}
                        title={element.visible === false ? 'Mostrar' : 'Ocultar'}
                      >
                        {element.visible === false ? '○' : '●'}
                      </button>
                      <button
                        className="layer-action"
                        type="button"
                        onClick={() => toggleLayerLock(element)}
                        aria-label={element.locked ? 'Desbloquear camada' : 'Bloquear camada'}
                        title={element.locked ? 'Desbloquear' : 'Bloquear'}
                      >
                        {element.locked ? '◆' : '◇'}
                      </button>
                    </div>
                  )
                })}
                <div className="layer-item is-background">
                  <div className="layer-select">
                    <span className="layer-kind" aria-hidden="true">▧</span>
                    <span>Imagem-base</span>
                  </div>
                  <button
                    className="layer-action"
                    type="button"
                    aria-label="A camada base está visível"
                    title="Visível"
                    disabled
                  >
                    ●
                  </button>
                  <button
                    className="layer-action"
                    type="button"
                    aria-label="A camada base está bloqueada"
                    title="Bloqueada"
                    disabled
                  >
                    ◆
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div role="tabpanel">
              <h2>Propriedades</h2>

              {(tool === 'brush' || tool === 'eraser') && (
                <div className="property-group">
                  <h3>{tool === 'eraser' ? 'Borracha' : 'Pincel'}</h3>

                  {tool === 'brush' && (
                    <>
                      <div className="brush-presets" aria-label="Predefinições do pincel">
                        {BRUSH_PRESETS.map((preset) => (
                          <button key={preset.id} type="button" onClick={() => applyBrushPreset(preset)}>
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <label htmlFor="brush-color">Cor do pincel</label>
                      <input
                        id="brush-color"
                        type="color"
                        value={brushColor}
                        onChange={(event) => setBrushColor(event.target.value)}
                      />

                      <label htmlFor="brush-opacity">Opacidade: {Math.round(brushOpacity * 100)}%</label>
                      <input
                        id="brush-opacity"
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={brushOpacity}
                        onChange={(event) => setBrushOpacity(Number(event.target.value))}
                      />

                      <label htmlFor="brush-softness">Suavidade: {brushSoftness}px</label>
                      <input
                        id="brush-softness"
                        type="range"
                        min="0"
                        max="18"
                        value={brushSoftness}
                        onChange={(event) => setBrushSoftness(Number(event.target.value))}
                      />
                    </>
                  )}

                  <label htmlFor="tool-size">
                    Espessura: {tool === 'eraser' ? eraserSize : brushSize}px
                  </label>
                  <input
                    id="tool-size"
                    type="range"
                    min={tool === 'eraser' ? 8 : 1}
                    max={tool === 'eraser' ? 100 : 64}
                    value={tool === 'eraser' ? eraserSize : brushSize}
                    onChange={(event) => {
                      const size = Number(event.target.value)
                      if (tool === 'eraser') setEraserSize(size)
                      else setBrushSize(size)
                    }}
                  />
                </div>
              )}

              {tool === 'eyedropper' && (
                <div className="tool-hint">
                  <span aria-hidden="true">◒</span>
                  <h3>Conta-gotas</h3>
                  <p>Clique em qualquer ponto do canvas para usar aquela cor no pincel.</p>
                  <strong style={{ color: brushColor }}>{brushColor.toUpperCase()}</strong>
                </div>
              )}

              {tool === 'stickers' && (
                <div className="sticker-picker">
                  <p>Escolha um sticker</p>
                  <div className="sticker-grid">
                    {STICKERS.map((sticker) => (
                      <button
                        key={sticker.source}
                        type="button"
                        onClick={() => addSticker(sticker)}
                        aria-label={`Adicionar sticker ${sticker.name}`}
                      >
                        <img src={sticker.source} alt="" />
                        <span>{sticker.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!['brush', 'eraser', 'eyedropper', 'stickers'].includes(tool) && !selectedElement && (
                <div className="empty-properties">
                  <span aria-hidden="true">↖</span>
                  <p>Selecione um elemento ou abra a aba de camadas.</p>
                </div>
              )}

              {selectedElement && (
                <div className="property-group">
                  {selectedElement.locked && (
                    <p className="locked-note">Camada bloqueada. Desbloqueie-a na aba Camadas para mover.</p>
                  )}

                  {selectedElement.type === 'text' && (
                    <>
                      <label htmlFor="element-text">Texto</label>
                      <textarea
                        id="element-text"
                        rows="3"
                        value={selectedElement.text}
                        onChange={(event) => updateSelected({ text: event.target.value })}
                      />

                      <div className="typography-presets" aria-label="Estilos rápidos de texto">
                        {TYPOGRAPHY_PRESETS.map((preset) => (
                          <button key={preset.id} type="button" onClick={() => applyTypographyPreset(preset)}>
                            <span aria-hidden="true">Aa</span>
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <label htmlFor="font-family">Fonte</label>
                      <select
                        id="font-family"
                        value={selectedElement.fontFamily ?? FONT_OPTIONS[0].value}
                        onChange={(event) => updateSelected({ fontFamily: event.target.value })}
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font.label} value={font.value}>{font.label}</option>
                        ))}
                      </select>

                      <div className="text-style-grid" aria-label="Estilo da fonte">
                        <button
                          className={selectedElement.fontWeight !== 'normal' ? 'is-active' : ''}
                          type="button"
                          onClick={() => updateSelected({
                            fontWeight: selectedElement.fontWeight === 'normal' ? 'bold' : 'normal',
                          })}
                          title="Negrito"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          className={selectedElement.italic ? 'is-active' : ''}
                          type="button"
                          onClick={() => updateSelected({ italic: !selectedElement.italic })}
                          title="Itálico"
                        >
                          <em>I</em>
                        </button>
                        <button
                          className={selectedElement.underline ? 'is-active' : ''}
                          type="button"
                          onClick={() => updateSelected({ underline: !selectedElement.underline })}
                          title="Sublinhado"
                        >
                          <u>U</u>
                        </button>
                      </div>

                      <div className="text-alignment" aria-label="Alinhamento do texto">
                        {[
                          ['left', 'Esquerda', '≡'],
                          ['center', 'Centro', '≣'],
                          ['right', 'Direita', '≡'],
                        ].map(([value, label, icon]) => (
                          <button
                            key={value}
                            className={(selectedElement.align ?? 'left') === value ? 'is-active' : ''}
                            type="button"
                            onClick={() => updateSelected({ align: value })}
                            title={`Alinhar à ${label.toLowerCase()}`}
                          >
                            <span className={`align-icon align-${value}`} aria-hidden="true">{icon}</span>
                            <span className="visually-hidden">{label}</span>
                          </button>
                        ))}
                      </div>

                      <label htmlFor="font-size">Tamanho: {selectedElement.fontSize}px</label>
                      <input
                        id="font-size"
                        type="range"
                        min="20"
                        max="120"
                        value={selectedElement.fontSize}
                        onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })}
                      />

                      <label htmlFor="text-width">Largura: {selectedElement.width ?? 460}px</label>
                      <input
                        id="text-width"
                        type="range"
                        min="160"
                        max="820"
                        value={selectedElement.width ?? 460}
                        onChange={(event) => updateSelected({ width: Number(event.target.value) })}
                      />

                      <label htmlFor="letter-spacing">
                        Espaçamento: {selectedElement.letterSpacing ?? 0}px
                      </label>
                      <input
                        id="letter-spacing"
                        type="range"
                        min="-4"
                        max="24"
                        value={selectedElement.letterSpacing ?? 0}
                        onChange={(event) => updateSelected({ letterSpacing: Number(event.target.value) })}
                      />

                      <label htmlFor="line-height">
                        Entrelinhas: {(selectedElement.lineHeight ?? 1.05).toFixed(2)}
                      </label>
                      <input
                        id="line-height"
                        type="range"
                        min="0.8"
                        max="2"
                        step="0.05"
                        value={selectedElement.lineHeight ?? 1.05}
                        onChange={(event) => updateSelected({ lineHeight: Number(event.target.value) })}
                      />

                      <div className="color-pair">
                        <label htmlFor="text-color">
                          Cor
                          <input
                            id="text-color"
                            type="color"
                            value={selectedElement.fill}
                            onChange={(event) => updateSelected({ fill: event.target.value })}
                          />
                        </label>
                        <label htmlFor="text-stroke-color">
                          Contorno
                          <input
                            id="text-stroke-color"
                            type="color"
                            value={selectedElement.stroke ?? '#25232b'}
                            onChange={(event) => updateSelected({ stroke: event.target.value })}
                          />
                        </label>
                      </div>

                      <label htmlFor="text-stroke-width">
                        Espessura do contorno: {selectedElement.strokeWidth ?? 0}px
                      </label>
                      <input
                        id="text-stroke-width"
                        type="range"
                        min="0"
                        max="12"
                        value={selectedElement.strokeWidth ?? 0}
                        onChange={(event) => updateSelected({ strokeWidth: Number(event.target.value) })}
                      />

                      <label className="checkbox-control">
                        <input
                          type="checkbox"
                          checked={selectedElement.shadowEnabled ?? false}
                          onChange={(event) => updateSelected({ shadowEnabled: event.target.checked })}
                        />
                        Sombra do texto
                      </label>

                      {selectedElement.shadowEnabled && (
                        <div className="shadow-controls">
                          <label htmlFor="text-shadow-color">
                            Cor da sombra
                            <input
                              id="text-shadow-color"
                              type="color"
                              value={selectedElement.shadowColor ?? '#25232b'}
                              onChange={(event) => updateSelected({ shadowColor: event.target.value })}
                            />
                          </label>
                          <label htmlFor="text-shadow-blur">
                            Desfoque: {selectedElement.shadowBlur ?? 0}px
                          </label>
                          <input
                            id="text-shadow-blur"
                            type="range"
                            min="0"
                            max="24"
                            value={selectedElement.shadowBlur ?? 0}
                            onChange={(event) => updateSelected({ shadowBlur: Number(event.target.value) })}
                          />
                          <label htmlFor="text-shadow-distance">
                            Distância: {selectedElement.shadowOffsetX ?? 7}px
                          </label>
                          <input
                            id="text-shadow-distance"
                            type="range"
                            min="-20"
                            max="24"
                            value={selectedElement.shadowOffsetX ?? 7}
                            onChange={(event) => {
                              const distance = Number(event.target.value)
                              updateSelected({ shadowOffsetX: distance, shadowOffsetY: distance })
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {selectedElement.type !== 'image' && selectedElement.type !== 'line' && selectedElement.type !== 'text' && (
                    <>
                      <label htmlFor="element-color">Cor</label>
                      <input
                        id="element-color"
                        type="color"
                        value={selectedElement.fill}
                        onChange={(event) => updateSelected({ fill: event.target.value })}
                      />
                    </>
                  )}

                  {selectedElement.type === 'line' && selectedElement.mode !== 'eraser' && (
                    <>
                      <label htmlFor="line-color">Cor do traço</label>
                      <input
                        id="line-color"
                        type="color"
                        value={selectedElement.stroke}
                        onChange={(event) => updateSelected({ stroke: event.target.value })}
                      />
                    </>
                  )}

                  <label htmlFor="element-opacity">
                    Opacidade: {Math.round((selectedElement.opacity ?? 1) * 100)}%
                  </label>
                  <input
                    id="element-opacity"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={selectedElement.opacity ?? 1}
                    onChange={(event) => updateSelected({ opacity: Number(event.target.value) })}
                  />

                  {selectedElement.type !== 'line' && (
                    <fieldset className="transform-controls">
                      <legend>Transformar e alinhar</legend>
                      <div className="alignment-grid" aria-label="Alinhamento no canvas">
                        <button type="button" onClick={() => alignSelected('left')} title="Alinhar à esquerda">⇤</button>
                        <button type="button" onClick={() => alignSelected('center-x')} title="Centralizar horizontalmente">↔</button>
                        <button type="button" onClick={() => alignSelected('right')} title="Alinhar à direita">⇥</button>
                        <button type="button" onClick={() => alignSelected('top')} title="Alinhar ao topo">↥</button>
                        <button type="button" onClick={() => alignSelected('center-y')} title="Centralizar verticalmente">↕</button>
                        <button type="button" onClick={() => alignSelected('bottom')} title="Alinhar à base">↧</button>
                      </div>
                      <div className="flip-buttons">
                        <button type="button" onClick={() => flipSelected('x')}>Virar horizontal</button>
                        <button type="button" onClick={() => flipSelected('y')}>Virar vertical</button>
                      </div>
                    </fieldset>
                  )}

                  {selectedElement.type === 'image' && (
                    <>
                      <fieldset className="image-adjustments">
                        <legend>Ajustes da imagem</legend>

                        <label htmlFor="image-brightness">
                          Brilho: {Math.round((selectedElement.brightness ?? 1) * 100)}%
                        </label>
                        <input
                          id="image-brightness"
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={selectedElement.brightness ?? 1}
                          onChange={(event) => updateSelected({ brightness: Number(event.target.value) })}
                        />

                        <label htmlFor="image-contrast">Contraste: {selectedElement.contrast ?? 0}</label>
                        <input
                          id="image-contrast"
                          type="range"
                          min="-100"
                          max="100"
                          value={selectedElement.contrast ?? 0}
                          onChange={(event) => updateSelected({ contrast: Number(event.target.value) })}
                        />

                        <label htmlFor="image-saturation">
                          Saturação: {Math.round((selectedElement.saturation ?? 0) * 100)}
                        </label>
                        <input
                          id="image-saturation"
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={selectedElement.saturation ?? 0}
                          onChange={(event) => updateSelected({ saturation: Number(event.target.value) })}
                        />

                        <label htmlFor="image-blur">Desfoque: {selectedElement.blur ?? 0}px</label>
                        <input
                          id="image-blur"
                          type="range"
                          min="0"
                          max="24"
                          value={selectedElement.blur ?? 0}
                          onChange={(event) => updateSelected({ blur: Number(event.target.value) })}
                        />

                        <label className="checkbox-control">
                          <input
                            type="checkbox"
                            checked={selectedElement.grayscale ?? false}
                            onChange={(event) => updateSelected({ grayscale: event.target.checked })}
                          />
                          Preto e branco
                        </label>
                        <button className="reset-adjustments" type="button" onClick={resetImageAdjustments}>
                          Restaurar ajustes
                        </button>
                      </fieldset>

                      {selectedElement.kind !== 'sticker' && (
                        <fieldset className="crop-controls">
                          <legend>Recorte central</legend>
                          <button type="button" onClick={() => applyCropRatio(null)}>Original</button>
                          <button type="button" onClick={() => applyCropRatio(1)}>1:1</button>
                          <button type="button" onClick={() => applyCropRatio(4 / 5)}>4:5</button>
                          <button type="button" onClick={() => applyCropRatio(16 / 9)}>16:9</button>
                        </fieldset>
                      )}
                    </>
                  )}

                  <div className="layer-buttons" aria-label="Ordem da camada">
                    <button
                      type="button"
                      onClick={() => moveSelected(-1)}
                      disabled={elements.findIndex((element) => element.id === selectedId) <= 0}
                    >
                      ↓ Para trás
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelected(1)}
                      disabled={elements.findIndex((element) => element.id === selectedId) === elements.length - 1}
                    >
                      ↑ Para frente
                    </button>
                  </div>

                  <button className="duplicate-button" type="button" onClick={duplicateSelected}>
                    Duplicar elemento
                  </button>
                  <button className="delete-button" type="button" onClick={deleteSelected}>
                    Excluir elemento
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

export default EditorScreen
