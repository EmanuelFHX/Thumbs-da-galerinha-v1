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
import {
  clearEditorSession,
  loadEditorSession,
  saveEditorSession,
} from '../lib/editorSession.js'
import {
  setEditorMusicMuted,
  startEditorMusic,
  stopEditorMusic,
} from '../lib/audioSession.js'
import { EDIT_DURATION_SECONDS, formatRoundTime } from '../lib/roundSession.js'
import { PlayerAvatar } from './PlayerAvatar.jsx'
import './editor.css'

const DEFAULT_DOCUMENT_SIZE = { width: 960, height: 540 }
const MIN_DOCUMENT_WIDTH = 320
const MIN_DOCUMENT_HEIGHT = 180
const MAX_DOCUMENT_SIZE = 1920
const DEFAULT_COLOR = '#ff5c7a'
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_SUBMISSION_DATA_LENGTH = 850_000
const EDITOR_MUSIC_MUTED_KEY = 'thumbs-editor-music-muted-v2'
const SUBMISSION_CAPTURE_ATTEMPTS = [
  { pixelRatio: 1, quality: 0.82 },
  { pixelRatio: 0.85, quality: 0.72 },
  { pixelRatio: 0.7, quality: 0.62 },
  { pixelRatio: 0.55, quality: 0.5 },
  { pixelRatio: 0.4, quality: 0.42 },
  { pixelRatio: 0.25, quality: 0.35 },
]
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const BASE_IMAGE_ID = 'base-image'
const MIN_BASE_IMAGE_SCALE = 0.1
const MAX_BASE_IMAGE_SCALE = 3
const DEFAULT_BASE_IMAGE_PLACEMENT = { offsetX: 0, offsetY: 0, scale: 1 }
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
const DOCUMENT_PRESETS = [
  { id: 'landscape', label: 'YouTube', detail: '1280 × 720', width: 1280, height: 720 },
  { id: 'square', label: 'Quadrado', detail: '1080 × 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Retrato', detail: '1080 × 1350', width: 1080, height: 1350 },
  { id: 'story', label: 'Stories', detail: '1080 × 1920', width: 1080, height: 1920 },
]

function getInitialTool() {
  const requestedTool = new URLSearchParams(window.location.search).get('tool')
  return ['brush', 'eraser', 'eyedropper', 'stickers'].includes(requestedTool)
    ? requestedTool
    : 'select'
}

function getInitialSidePanel() {
  const requestedPanel = new URLSearchParams(window.location.search).get('panel')
  return ['document', 'layers'].includes(requestedPanel) ? requestedPanel : 'properties'
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function normalizeAreaRect(startX, startY, endX, endY, documentSize) {
  const x = clamp(Math.min(startX, endX), 0, documentSize.width)
  const y = clamp(Math.min(startY, endY), 0, documentSize.height)
  const right = clamp(Math.max(startX, endX), 0, documentSize.width)
  const bottom = clamp(Math.max(startY, endY), 0, documentSize.height)

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  }
}

function getPointBounds(points, documentSize) {
  const xValues = points.filter((_, index) => index % 2 === 0)
  const yValues = points.filter((_, index) => index % 2 === 1)
  if (xValues.length === 0 || yValues.length === 0) return null

  const x = clamp(Math.min(...xValues), 0, documentSize.width)
  const y = clamp(Math.min(...yValues), 0, documentSize.height)
  const right = clamp(Math.max(...xValues), 0, documentSize.width)
  const bottom = clamp(Math.max(...yValues), 0, documentSize.height)

  return { x, y, width: right - x, height: bottom - y }
}

function getSnappedPosition(node, documentSize) {
  const threshold = 10
  const bounds = node.getClientRect({ skipShadow: true })
  const nextPosition = { x: node.x(), y: node.y() }
  const horizontalCenter = bounds.x + bounds.width / 2
  const verticalCenter = bounds.y + bounds.height / 2

  if (Math.abs(bounds.x) <= threshold) nextPosition.x -= bounds.x
  if (Math.abs(bounds.x + bounds.width - documentSize.width) <= threshold) {
    nextPosition.x += documentSize.width - bounds.x - bounds.width
  }
  if (Math.abs(horizontalCenter - documentSize.width / 2) <= threshold) {
    nextPosition.x += documentSize.width / 2 - horizontalCenter
  }
  if (Math.abs(bounds.y) <= threshold) nextPosition.y -= bounds.y
  if (Math.abs(bounds.y + bounds.height - documentSize.height) <= threshold) {
    nextPosition.y += documentSize.height - bounds.y - bounds.height
  }
  if (Math.abs(verticalCenter - documentSize.height / 2) <= threshold) {
    nextPosition.y += documentSize.height / 2 - verticalCenter
  }

  return nextPosition
}

function getCropPatch(element, crop) {
  const displayMax = Math.max(element.width, element.height)
  const displayRatio = crop.width / crop.height
  return {
    cropX: crop.x,
    cropY: crop.y,
    cropWidth: crop.width,
    cropHeight: crop.height,
    width: Math.round(displayRatio >= 1 ? displayMax : displayMax * displayRatio),
    height: Math.round(displayRatio >= 1 ? displayMax / displayRatio : displayMax),
  }
}

function getBaseImageGeometry(image, documentSize, placement) {
  if (!image) return null

  const coverScale = Math.max(
    documentSize.width / image.naturalWidth,
    documentSize.height / image.naturalHeight,
  )
  const scale = coverScale * placement.scale
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const originX = (documentSize.width - width) / 2
  const originY = (documentSize.height - height) / 2

  return {
    height,
    originX,
    originY,
    width,
    x: originX + placement.offsetX,
    y: originY + placement.offsetY,
  }
}

function normalizeBaseImagePlacement(image, documentSize, placement) {
  const normalized = {
    offsetX: Number(placement?.offsetX) || 0,
    offsetY: Number(placement?.offsetY) || 0,
    scale: clamp(Number(placement?.scale) || 1, MIN_BASE_IMAGE_SCALE, MAX_BASE_IMAGE_SCALE),
  }
  const geometry = getBaseImageGeometry(image, documentSize, normalized)
  if (!geometry) return normalized

  const horizontalLimit = Math.abs(geometry.width - documentSize.width) / 2
  const verticalLimit = Math.abs(geometry.height - documentSize.height) / 2
  return {
    ...normalized,
    offsetX: clamp(normalized.offsetX, -horizontalLimit, horizontalLimit),
    offsetY: clamp(normalized.offsetY, -verticalLimit, verticalLimit),
  }
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

function EditableNode({ documentSize, element, isInteractive, isSelected, onChange, onSelect }) {
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
      const snappedPosition = getSnappedPosition(event.target, documentSize)
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

  if (element.type === 'path') {
    shape = (
      <Line
        {...sharedProps}
        points={element.points}
        closed
        fill={element.fill}
        stroke={element.stroke ?? '#25232b'}
        strokeWidth={element.strokeWidth ?? 5}
        lineJoin="round"
        shadowColor="#25232b"
        shadowOffset={{ x: 7, y: 7 }}
        shadowOpacity={0.55}
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

function EditableBaseImage({ documentSize, image, isInteractive, isSelected, onChange, onSelect, placement }) {
  const geometry = getBaseImageGeometry(image, documentSize, placement)
  if (!geometry) return null

  return (
    <>
      <KonvaImage
        id={BASE_IMAGE_ID}
        image={image}
        x={geometry.x}
        y={geometry.y}
        width={geometry.width}
        height={geometry.height}
        draggable={isInteractive}
        listening={isInteractive}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(event) => onChange({
          ...placement,
          offsetX: event.target.x() - geometry.originX,
          offsetY: event.target.y() - geometry.originY,
        })}
      />
      {isSelected && (
        <Rect
          name="editor-selection-guide"
          x={geometry.x}
          y={geometry.y}
          width={geometry.width}
          height={geometry.height}
          stroke="#146db7"
          strokeWidth={4}
          dash={[14, 8]}
          listening={false}
        />
      )}
    </>
  )
}

function AreaSelectionOverlay({ selection }) {
  const previewImage = useCanvasImage(selection?.previewSource)
  if (!selection) return null

  if (selection.type === 'magic' && previewImage) {
    return (
      <>
        <KonvaImage
          name="editor-selection-guide"
          image={previewImage}
          x={0}
          y={0}
          listening={false}
        />
        <Rect
          name="editor-selection-guide"
          {...selection.bounds}
          stroke="#146db7"
          strokeWidth={3}
          dash={[10, 7]}
          listening={false}
        />
      </>
    )
  }

  if (selection.type === 'lasso') {
    return (
      <Line
        name="editor-selection-guide"
        points={selection.points}
        closed
        fill="rgba(255, 212, 71, 0.16)"
        stroke="#146db7"
        strokeWidth={3}
        dash={[10, 7]}
        lineJoin="round"
        listening={false}
      />
    )
  }

  return (
    <Rect
      name="editor-selection-guide"
      {...selection.bounds}
      fill={selection.type === 'crop' ? 'rgba(255, 92, 122, 0.16)' : 'rgba(255, 212, 71, 0.16)'}
      stroke={selection.type === 'crop' ? '#ff5c7a' : '#146db7'}
      strokeWidth={3}
      dash={[10, 7]}
      listening={false}
    />
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
  if (element.type === 'path') return 'Forma da caneta'
  return 'Retângulo'
}

function getSaveLabel(saveStatus, lastSavedAt) {
  if (saveStatus === 'loading') return 'Carregando rascunho…'
  if (saveStatus === 'saving') return 'Salvando…'
  if (saveStatus === 'error') return 'Falha ao salvar'
  if (saveStatus === 'empty') return 'Rascunho vazio'
  if (!lastSavedAt) return 'Rascunho automático'
  return `Salvo às ${new Date(lastSavedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function getInitialMusicMuted() {
  try {
    return window.sessionStorage.getItem(EDITOR_MUSIC_MUTED_KEY) === 'true'
  } catch {
    return false
  }
}

function EditorScreen({
  baseImageSource = '/sample-base.svg',
  onBack,
  onFinish,
  players = [],
  round,
  sessionKey,
  submittedPlayerIds = [],
}) {
  const stageRef = useRef(null)
  const canvasFrameRef = useRef(null)
  const fileInputRef = useRef(null)
  const isDrawing = useRef(false)
  const drawingStart = useRef([])
  const selectionStart = useRef(null)
  const isSpacePressed = useRef(false)
  const panStart = useRef(null)
  const shortcutActions = useRef(null)
  const hasUnsavedChanges = useRef(false)
  const hasFinishedRound = useRef(false)
  const finishRoundRef = useRef(null)
  const saveGeneration = useRef(0)
  const baseImage = useCanvasImage(baseImageSource)
  const submittedPlayers = new Set(submittedPlayerIds)

  const [tool, setTool] = useState(getInitialTool)
  const [sidePanel, setSidePanel] = useState(getInitialSidePanel)
  const [brushColor, setBrushColor] = useState('#ff5c7a')
  const [brushSize, setBrushSize] = useState(10)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [brushSoftness, setBrushSoftness] = useState(0)
  const [eraserSize, setEraserSize] = useState(34)
  const [selectedId, setSelectedId] = useState(null)
  const [elements, setElements] = useState([])
  const [baseImagePlacement, setBaseImagePlacement] = useState(DEFAULT_BASE_IMAGE_PLACEMENT)
  const [documentSize, setDocumentSize] = useState(DEFAULT_DOCUMENT_SIZE)
  const [documentDraft, setDocumentDraft] = useState(DEFAULT_DOCUMENT_SIZE)
  const [lockDocumentRatio, setLockDocumentRatio] = useState(true)
  const [scaleDocumentContent, setScaleDocumentContent] = useState(false)
  const [cropDraft, setCropDraft] = useState(null)
  const [areaSelection, setAreaSelection] = useState(null)
  const [penPoints, setPenPoints] = useState([])
  const [magicTolerance, setMagicTolerance] = useState(36)
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [status, setStatus] = useState('Escolha uma ferramenta e comece a criar.')
  const [zoom, setZoom] = useState(1)
  const [fitMode, setFitMode] = useState(true)
  const [spaceDown, setSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('loading')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(() => (
    round?.endsAt
      ? Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000))
      : EDIT_DURATION_SECONDS
  ))
  const [musicMuted, setMusicMuted] = useState(getInitialMusicMuted)
  const initialMusicMutedRef = useRef(musicMuted)

  const selectedElement = elements.find((element) => element.id === selectedId)
  const isBaseImageSelected = selectedId === BASE_IMAGE_ID
  const activeCropDraft = cropDraft?.elementId === selectedId ? cropDraft : null
  const renderedElements = activeCropDraft
    ? elements.map((element) => (
        element.id === activeCropDraft.elementId
          ? { ...element, ...getCropPatch(element, activeCropDraft) }
          : element
      ))
    : elements
  const normalizedBaseImagePlacement = normalizeBaseImagePlacement(
    baseImage,
    documentSize,
    baseImagePlacement,
  )
  const baseImageGeometry = getBaseImageGeometry(baseImage, documentSize, normalizedBaseImagePlacement)
  const baseHorizontalLimit = baseImageGeometry
    ? Math.round(Math.abs(baseImageGeometry.width - documentSize.width) / 2)
    : 0
  const baseVerticalLimit = baseImageGeometry
    ? Math.round(Math.abs(baseImageGeometry.height - documentSize.height) / 2)
    : 0
  const hasPersistableContent = elements.length > 0
    || documentSize.width !== DEFAULT_DOCUMENT_SIZE.width
    || documentSize.height !== DEFAULT_DOCUMENT_SIZE.height
    || baseImagePlacement.offsetX !== 0
    || baseImagePlacement.offsetY !== 0
    || baseImagePlacement.scale !== 1

  function commit(
    nextElements,
    message,
    nextDocumentSize = documentSize,
    nextBaseImagePlacement = baseImagePlacement,
  ) {
    setPast((current) => [...current, { baseImagePlacement, elements, documentSize }])
    setElements(nextElements)
    setBaseImagePlacement(nextBaseImagePlacement)
    setDocumentSize(nextDocumentSize)
    setDocumentDraft(nextDocumentSize)
    setFuture([])
    if (message) setStatus(message)
  }

  function updateBaseImagePlacement(nextPlacement, message = 'Foto principal reposicionada.') {
    const normalizedPlacement = normalizeBaseImagePlacement(baseImage, documentSize, nextPlacement)
    commit(elements, message, documentSize, normalizedPlacement)
  }

  function adjustBaseImageScale(delta) {
    const nextScale = clamp(
      Math.round((normalizedBaseImagePlacement.scale + delta) * 10) / 10,
      MIN_BASE_IMAGE_SCALE,
      MAX_BASE_IMAGE_SCALE,
    )

    updateBaseImagePlacement({
      ...normalizedBaseImagePlacement,
      scale: nextScale,
    }, delta < 0 ? 'Foto principal diminuída.' : 'Foto principal aumentada.')
  }

  function activateAreaTool(nextTool, message) {
    setTool(nextTool)
    setSelectedId(null)
    setCropDraft(null)
    setAreaSelection(null)
    setPenPoints([])
    setSidePanel('properties')
    setStatus(message)
  }

  function getCleanStageCanvas() {
    const stage = stageRef.current
    if (!stage) return null

    const transformers = stage.find('Transformer')
    const selectionGuides = stage.find('.editor-selection-guide')
    transformers.forEach((transformer) => transformer.visible(false))
    selectionGuides.forEach((guide) => guide.visible(false))
    stage.batchDraw()

    try {
      return stage.toCanvas({ pixelRatio: 1 })
    } finally {
      transformers.forEach((transformer) => transformer.visible(true))
      selectionGuides.forEach((guide) => guide.visible(true))
      stage.batchDraw()
    }
  }

  function selectMagicArea(point) {
    const canvas = getCleanStageCanvas()
    if (!canvas) return

    const context = canvas.getContext('2d', { willReadFrequently: true })
    let imageData
    try {
      imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    } catch {
      setStatus('A varinha não conseguiu ler essa imagem. Tente outra área.')
      return
    }

    const startX = clamp(Math.floor(point.x), 0, canvas.width - 1)
    const startY = clamp(Math.floor(point.y), 0, canvas.height - 1)
    const startIndex = startY * canvas.width + startX
    const targetOffset = startIndex * 4
    const target = imageData.data.slice(targetOffset, targetOffset + 4)
    const visited = new Uint8Array(canvas.width * canvas.height)
    const mask = new Uint8Array(canvas.width * canvas.height)
    const queue = new Int32Array(canvas.width * canvas.height)
    let queueStart = 0
    let queueEnd = 1
    queue[0] = startIndex
    visited[startIndex] = 1
    let minX = startX
    let maxX = startX
    let minY = startY
    let maxY = startY
    let selectedCount = 0

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart]
      queueStart += 1
      const offset = pixelIndex * 4
      const matches = Math.abs(imageData.data[offset] - target[0]) <= magicTolerance
        && Math.abs(imageData.data[offset + 1] - target[1]) <= magicTolerance
        && Math.abs(imageData.data[offset + 2] - target[2]) <= magicTolerance
        && Math.abs(imageData.data[offset + 3] - target[3]) <= magicTolerance
      if (!matches) continue

      mask[pixelIndex] = 1
      selectedCount += 1
      const x = pixelIndex % canvas.width
      const y = Math.floor(pixelIndex / canvas.width)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      const left = pixelIndex - 1
      const right = pixelIndex + 1
      const top = pixelIndex - canvas.width
      const bottom = pixelIndex + canvas.width
      if (x > 0 && !visited[left]) {
        visited[left] = 1
        queue[queueEnd] = left
        queueEnd += 1
      }
      if (x < canvas.width - 1 && !visited[right]) {
        visited[right] = 1
        queue[queueEnd] = right
        queueEnd += 1
      }
      if (y > 0 && !visited[top]) {
        visited[top] = 1
        queue[queueEnd] = top
        queueEnd += 1
      }
      if (y < canvas.height - 1 && !visited[bottom]) {
        visited[bottom] = 1
        queue[queueEnd] = bottom
        queueEnd += 1
      }
    }

    if (selectedCount === 0) {
      setStatus('Nenhuma área semelhante foi encontrada nesse ponto.')
      return
    }

    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = canvas.width
    previewCanvas.height = canvas.height
    const previewContext = previewCanvas.getContext('2d')
    const previewData = previewContext.createImageData(canvas.width, canvas.height)
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue
      const offset = index * 4
      previewData.data[offset] = 255
      previewData.data[offset + 1] = 212
      previewData.data[offset + 2] = 71
      previewData.data[offset + 3] = 92
    }
    previewContext.putImageData(previewData, 0, 0)

    setAreaSelection({
      type: 'magic',
      bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
      mask,
      previewSource: previewCanvas.toDataURL('image/png'),
    })
    setSidePanel('properties')
    setStatus(`${selectedCount.toLocaleString('pt-BR')} pixels semelhantes selecionados.`)
  }

  function copyAreaSelectionToLayer() {
    if (!areaSelection) return
    const sourceCanvas = getCleanStageCanvas()
    if (!sourceCanvas) return

    const bounds = {
      x: Math.max(0, Math.floor(areaSelection.bounds.x)),
      y: Math.max(0, Math.floor(areaSelection.bounds.y)),
      width: Math.max(1, Math.ceil(areaSelection.bounds.width)),
      height: Math.max(1, Math.ceil(areaSelection.bounds.height)),
    }
    const output = document.createElement('canvas')
    output.width = bounds.width
    output.height = bounds.height
    const outputContext = output.getContext('2d')

    if (areaSelection.type === 'magic') {
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
      const sourceData = sourceContext.getImageData(bounds.x, bounds.y, bounds.width, bounds.height)
      const extractedData = outputContext.createImageData(bounds.width, bounds.height)
      for (let y = 0; y < bounds.height; y += 1) {
        for (let x = 0; x < bounds.width; x += 1) {
          const sourceIndex = (bounds.y + y) * sourceCanvas.width + bounds.x + x
          if (!areaSelection.mask[sourceIndex]) continue
          const localOffset = (y * bounds.width + x) * 4
          extractedData.data[localOffset] = sourceData.data[localOffset]
          extractedData.data[localOffset + 1] = sourceData.data[localOffset + 1]
          extractedData.data[localOffset + 2] = sourceData.data[localOffset + 2]
          extractedData.data[localOffset + 3] = sourceData.data[localOffset + 3]
        }
      }
      outputContext.putImageData(extractedData, 0, 0)
    } else if (areaSelection.type === 'lasso') {
      outputContext.save()
      outputContext.translate(-bounds.x, -bounds.y)
      outputContext.beginPath()
      areaSelection.points.forEach((coordinate, index) => {
        if (index % 2 !== 0) return
        const x = coordinate
        const y = areaSelection.points[index + 1]
        if (index === 0) outputContext.moveTo(x, y)
        else outputContext.lineTo(x, y)
      })
      outputContext.closePath()
      outputContext.clip()
      outputContext.drawImage(sourceCanvas, 0, 0)
      outputContext.restore()
    } else {
      outputContext.drawImage(
        sourceCanvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height,
      )
    }

    const nextElement = {
      id: createId('image'),
      type: 'image',
      source: output.toDataURL('image/png'),
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      opacity: 1,
      rotation: 0,
      brightness: 1,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false,
    }
    commit([...elements, nextElement], 'Seleção copiada para uma nova camada.')
    setAreaSelection(null)
    setSelectedId(nextElement.id)
    setTool('select')
  }

  function applyDocumentCrop() {
    if (!areaSelection?.bounds) return
    const bounds = {
      x: Math.round(areaSelection.bounds.x),
      y: Math.round(areaSelection.bounds.y),
      width: Math.round(areaSelection.bounds.width),
      height: Math.round(areaSelection.bounds.height),
    }
    if (bounds.width < MIN_DOCUMENT_WIDTH || bounds.height < MIN_DOCUMENT_HEIGHT) {
      setStatus(`O corte precisa ter pelo menos ${MIN_DOCUMENT_WIDTH} × ${MIN_DOCUMENT_HEIGHT} px.`)
      return
    }

    const nextDocumentSize = { width: bounds.width, height: bounds.height }
    const nextElements = elements.map((element) => {
      if (element.type === 'line') {
        return {
          ...element,
          points: element.points.map((coordinate, index) => (
            coordinate - (index % 2 === 0 ? bounds.x : bounds.y)
          )),
        }
      }
      return {
        ...element,
        x: (element.x ?? 0) - bounds.x,
        y: (element.y ?? 0) - bounds.y,
      }
    })

    let nextBasePlacement = DEFAULT_BASE_IMAGE_PLACEMENT
    if (baseImage && baseImageGeometry) {
      const displayedScale = baseImageGeometry.width / baseImage.naturalWidth
      const nextCoverScale = Math.max(
        nextDocumentSize.width / baseImage.naturalWidth,
        nextDocumentSize.height / baseImage.naturalHeight,
      )
      const nextScale = clamp(
        displayedScale / nextCoverScale,
        MIN_BASE_IMAGE_SCALE,
        MAX_BASE_IMAGE_SCALE,
      )
      const nextGeometry = getBaseImageGeometry(baseImage, nextDocumentSize, {
        offsetX: 0,
        offsetY: 0,
        scale: nextScale,
      })
      nextBasePlacement = normalizeBaseImagePlacement(baseImage, nextDocumentSize, {
        scale: nextScale,
        offsetX: baseImageGeometry.x - bounds.x - nextGeometry.originX,
        offsetY: baseImageGeometry.y - bounds.y - nextGeometry.originY,
      })
    }

    commit(nextElements, `Documento cortado para ${bounds.width} × ${bounds.height}.`, nextDocumentSize, nextBasePlacement)
    setAreaSelection(null)
    setTool('select')
    setFitMode(true)
    setSelectedId(null)
  }

  function finishPenPath() {
    if (penPoints.length < 6) {
      setStatus('Adicione pelo menos 3 pontos para fechar a forma.')
      return
    }
    const bounds = getPointBounds(penPoints, documentSize)
    if (!bounds) return

    const nextElement = {
      id: createId('path'),
      type: 'path',
      x: bounds.x,
      y: bounds.y,
      points: penPoints.map((coordinate, index) => (
        coordinate - (index % 2 === 0 ? bounds.x : bounds.y)
      )),
      fill: brushColor,
      stroke: '#25232b',
      strokeWidth: 5,
      opacity: 1,
      rotation: 0,
    }
    commit([...elements, nextElement], 'Forma vetorial criada com a caneta.')
    setPenPoints([])
    setSelectedId(nextElement.id)
    setTool('select')
  }

  function handleBack() {
    if (hasUnsavedChanges.current && !window.confirm('Existem alterações que ainda não foram salvas. Deseja sair mesmo assim?')) {
      return
    }
    onBack()
  }

  function toggleMusic() {
    const nextMuted = !musicMuted
    setMusicMuted(nextMuted)
    setEditorMusicMuted(nextMuted).catch(() => setMusicMuted(true))
  }

  async function clearDraft() {
    if (hasPersistableContent && !window.confirm('Limpar todo o rascunho atual? Essa ação não pode ser desfeita.')) {
      return
    }

    hasUnsavedChanges.current = false
    saveGeneration.current += 1
    setElements([])
    setBaseImagePlacement(DEFAULT_BASE_IMAGE_PLACEMENT)
    setDocumentSize(DEFAULT_DOCUMENT_SIZE)
    setDocumentDraft(DEFAULT_DOCUMENT_SIZE)
    setSelectedId(null)
    setCropDraft(null)
    setAreaSelection(null)
    setPenPoints([])
    setPast([])
    setFuture([])
    setBrushColor('#ff5c7a')
    setBrushSize(10)
    setBrushOpacity(1)
    setBrushSoftness(0)
    setEraserSize(34)

    try {
      await clearEditorSession(sessionKey)
      setLastSavedAt(null)
      setSaveStatus('empty')
      setStatus('Rascunho limpo. O editor está pronto para uma nova criação.')
    } catch {
      setSaveStatus('error')
      setStatus('Não foi possível limpar o rascunho salvo no navegador.')
    }
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
    setAreaSelection(null)
    setPenPoints([])
    setSidePanel('properties')
  }

  function addShape(type) {
    const nextElement = type === 'circle'
      ? {
          id: createId('circle'),
          type: 'circle',
          x: documentSize.width / 2,
          y: documentSize.height / 2,
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
    setAreaSelection(null)
    setPenPoints([])
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
      x: Math.round((documentSize.width - nextWidth) / 2),
      y: Math.round((documentSize.height - nextHeight) / 2),
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
    setAreaSelection(null)
    setPenPoints([])
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

  function updateDocumentDraft(axis, rawValue) {
    const minimum = axis === 'width' ? MIN_DOCUMENT_WIDTH : MIN_DOCUMENT_HEIGHT
    const value = clamp(Number(rawValue) || minimum, minimum, MAX_DOCUMENT_SIZE)

    setDocumentDraft((current) => {
      if (!lockDocumentRatio) return { ...current, [axis]: value }
      const ratio = current.width / current.height
      if (axis === 'width') {
        return {
          width: value,
          height: clamp(Math.round(value / ratio), MIN_DOCUMENT_HEIGHT, MAX_DOCUMENT_SIZE),
        }
      }
      return {
        width: clamp(Math.round(value * ratio), MIN_DOCUMENT_WIDTH, MAX_DOCUMENT_SIZE),
        height: value,
      }
    })
  }

  function resizeDocument(nextSize = documentDraft) {
    const normalizedSize = {
      width: clamp(Math.round(nextSize.width), MIN_DOCUMENT_WIDTH, MAX_DOCUMENT_SIZE),
      height: clamp(Math.round(nextSize.height), MIN_DOCUMENT_HEIGHT, MAX_DOCUMENT_SIZE),
    }
    const scaleX = normalizedSize.width / documentSize.width
    const scaleY = normalizedSize.height / documentSize.height
    const nextElements = scaleDocumentContent
      ? elements.map((element) => {
          if (element.type === 'line') {
            return {
              ...element,
              points: element.points.map((point, index) => point * (index % 2 === 0 ? scaleX : scaleY)),
              strokeWidth: element.strokeWidth * ((scaleX + scaleY) / 2),
            }
          }
          return {
            ...element,
            x: element.x * scaleX,
            y: element.y * scaleY,
            scaleX: (element.scaleX ?? 1) * scaleX,
            scaleY: (element.scaleY ?? 1) * scaleY,
          }
        })
      : elements
    const nextBaseImagePlacement = normalizeBaseImagePlacement(baseImage, normalizedSize, {
      ...baseImagePlacement,
      offsetX: scaleDocumentContent ? baseImagePlacement.offsetX * scaleX : baseImagePlacement.offsetX,
      offsetY: scaleDocumentContent ? baseImagePlacement.offsetY * scaleY : baseImagePlacement.offsetY,
    })

    setCropDraft(null)
    setFitMode(true)
    commit(
      nextElements,
      `Documento redimensionado para ${normalizedSize.width} × ${normalizedSize.height}.`,
      normalizedSize,
      nextBaseImagePlacement,
    )
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
        (frame.clientWidth - 36) / documentSize.width,
        (frame.clientHeight - 36) / documentSize.height,
      ),
      MIN_ZOOM,
      1,
    )

    setFitMode(true)
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      frame.scrollLeft = Math.max(0, (documentSize.width * nextZoom - frame.clientWidth) / 2)
      frame.scrollTop = Math.max(0, (documentSize.height * nextZoom - frame.clientHeight) / 2)
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

  function nudgeSelected(deltaX, deltaY) {
    if (isBaseImageSelected) {
      updateBaseImagePlacement({
        ...baseImagePlacement,
        offsetX: baseImagePlacement.offsetX + deltaX,
        offsetY: baseImagePlacement.offsetY + deltaY,
      }, 'Foto principal movida com precisão.')
      return
    }

    if (!selectedElement || selectedElement.locked) return
    updateSelected({
      x: selectedElement.x + deltaX,
      y: selectedElement.y + deltaY,
    })
  }

  function alignSelected(alignment) {
    if (!selectedId) return
    const node = stageRef.current?.findOne(`#${selectedId}`)
    if (!node) return

    const bounds = node.getClientRect({ skipShadow: true })
    let deltaX = 0
    let deltaY = 0

    if (alignment === 'left') deltaX = -bounds.x
    if (alignment === 'center-x') deltaX = documentSize.width / 2 - bounds.x - bounds.width / 2
    if (alignment === 'right') deltaX = documentSize.width - bounds.x - bounds.width
    if (alignment === 'top') deltaY = -bounds.y
    if (alignment === 'center-y') deltaY = documentSize.height / 2 - bounds.y - bounds.height / 2
    if (alignment === 'bottom') deltaY = documentSize.height - bounds.y - bounds.height

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

    setCropDraft(null)
    updateSelected(getCropPatch(selectedElement, {
      x: (sourceWidth - cropWidth) / 2,
      y: (sourceHeight - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    }))
  }

  function beginManualCrop() {
    if (selectedElement?.type !== 'image' || selectedElement.kind === 'sticker') return
    setCropDraft({
      elementId: selectedElement.id,
      x: Math.round(selectedElement.cropX ?? 0),
      y: Math.round(selectedElement.cropY ?? 0),
      width: Math.round(selectedElement.cropWidth ?? selectedElement.sourceWidth),
      height: Math.round(selectedElement.cropHeight ?? selectedElement.sourceHeight),
    })
    setStatus('Ajuste o enquadramento e confirme o recorte livre.')
  }

  function updateCropDraft(patch) {
    if (!activeCropDraft || !selectedElement) return
    const next = { ...activeCropDraft, ...patch }
    next.width = clamp(next.width, 20, selectedElement.sourceWidth)
    next.height = clamp(next.height, 20, selectedElement.sourceHeight)
    next.x = clamp(next.x, 0, selectedElement.sourceWidth - next.width)
    next.y = clamp(next.y, 0, selectedElement.sourceHeight - next.height)
    setCropDraft(next)
  }

  function applyManualCrop() {
    if (!activeCropDraft || !selectedElement) return
    commit(
      elements.map((element) => (
        element.id === activeCropDraft.elementId
          ? { ...element, ...getCropPatch(element, activeCropDraft) }
          : element
      )),
      'Recorte livre aplicado.',
    )
    setCropDraft(null)
  }

  function cancelManualCrop() {
    setCropDraft(null)
    setStatus('Recorte livre cancelado.')
  }

  useEffect(() => {
    let cancelled = false

    loadEditorSession(sessionKey)
      .then((session) => {
        if (cancelled) return

        if (session?.schemaVersion === 1) {
          const restoredSize = {
            width: clamp(session.documentSize?.width ?? DEFAULT_DOCUMENT_SIZE.width, MIN_DOCUMENT_WIDTH, MAX_DOCUMENT_SIZE),
            height: clamp(session.documentSize?.height ?? DEFAULT_DOCUMENT_SIZE.height, MIN_DOCUMENT_HEIGHT, MAX_DOCUMENT_SIZE),
          }
          setElements(Array.isArray(session.elements) ? session.elements : [])
          setBaseImagePlacement({
            offsetX: Number(session.baseImagePlacement?.offsetX) || 0,
            offsetY: Number(session.baseImagePlacement?.offsetY) || 0,
            scale: clamp(
              Number(session.baseImagePlacement?.scale) || 1,
              MIN_BASE_IMAGE_SCALE,
              MAX_BASE_IMAGE_SCALE,
            ),
          })
          setDocumentSize(restoredSize)
          setDocumentDraft(restoredSize)
          setBrushColor(session.settings?.brushColor ?? '#ff5c7a')
          setBrushSize(session.settings?.brushSize ?? 10)
          setBrushOpacity(session.settings?.brushOpacity ?? 1)
          setBrushSoftness(session.settings?.brushSoftness ?? 0)
          setEraserSize(session.settings?.eraserSize ?? 34)
          setLastSavedAt(session.savedAt ?? null)
          setSaveStatus('saved')
          setStatus('Rascunho restaurado deste navegador.')
        } else {
          setSaveStatus('empty')
        }

        setSessionReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setSaveStatus('error')
        setSessionReady(true)
        setStatus('O editor abriu, mas o armazenamento automático não está disponível.')
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey])

  useEffect(() => {
    let retryArmed = false

    function detachRetry() {
      window.removeEventListener('pointerdown', retryMusic)
      window.removeEventListener('keydown', retryMusic)
      retryArmed = false
    }

    function retryMusic() {
      startEditorMusic().then(detachRetry).catch(() => {
        // Uma interação futura poderá tentar iniciar a música novamente.
      })
    }

    if (!initialMusicMutedRef.current) {
      startEditorMusic().catch(() => {
        retryArmed = true
        window.addEventListener('pointerdown', retryMusic, { passive: true })
        window.addEventListener('keydown', retryMusic)
      })
    }

    return () => {
      if (retryArmed) detachRetry()
      stopEditorMusic()
    }
  }, [])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(EDITOR_MUSIC_MUTED_KEY, String(musicMuted))
    } catch {
      // O controle continua funcionando mesmo sem persistência na sessão.
    }
  }, [musicMuted])

  useEffect(() => {
    if (!sessionReady || !hasPersistableContent) return undefined

    const generation = ++saveGeneration.current
    hasUnsavedChanges.current = true
    const timeout = window.setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const savedAt = await saveEditorSession({
          baseImagePlacement,
          documentSize,
          elements,
          settings: {
            brushColor,
            brushOpacity,
            brushSize,
            brushSoftness,
            eraserSize,
          },
        }, sessionKey)
        if (saveGeneration.current === generation) {
          hasUnsavedChanges.current = false
          setLastSavedAt(savedAt)
          setSaveStatus('saved')
        }
      } catch {
        if (saveGeneration.current === generation) {
          setSaveStatus('error')
        }
      }
    }, 700)

    return () => {
      window.clearTimeout(timeout)
      if (saveGeneration.current === generation) saveGeneration.current += 1
    }
  }, [
    brushColor,
    brushOpacity,
    brushSize,
    brushSoftness,
    baseImagePlacement,
    documentSize,
    elements,
    eraserSize,
    hasPersistableContent,
    sessionReady,
    sessionKey,
  ])

  useEffect(() => {
    if (!round?.endsAt) return undefined

    const updateTimer = () => {
      const nextSeconds = Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000))
      setRemainingSeconds(nextSeconds)

      if (nextSeconds === 0) finishRoundRef.current?.('timeout')
    }

    updateTimer()
    const interval = window.setInterval(updateTimer, 250)
    return () => window.clearInterval(interval)
  }, [round?.endsAt])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!hasUnsavedChanges.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const frame = canvasFrameRef.current
    if (!frame) return undefined

    function updateFitZoom() {
      if (!fitMode) return
      const nextZoom = clamp(
        Math.min(
          (frame.clientWidth - 36) / documentSize.width,
          (frame.clientHeight - 36) / documentSize.height,
        ),
        MIN_ZOOM,
        1,
      )
      setZoom(nextZoom)
    }

    const observer = new ResizeObserver(updateFitZoom)

    observer.observe(frame)
    updateFitZoom()
    return () => observer.disconnect()
  }, [documentSize.height, documentSize.width, fitMode])

  useEffect(() => {
    shortcutActions.current = {
      deleteSelected,
      duplicateSelected,
      fitCanvas,
      nudgeSelected,
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
      if (!hasModifier && event.key.toLowerCase() === 'v') {
        setTool('select')
        setCropDraft(null)
        setAreaSelection(null)
        setPenPoints([])
        setStatus('Ferramenta Mover selecionada. Arraste uma camada ou use as setas.')
      }
      if (!hasModifier && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const distance = event.shiftKey ? 10 : 1
        const horizontal = event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0
        const vertical = event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0
        actions.nudgeSelected(horizontal, vertical)
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
    setFuture([{ baseImagePlacement, elements, documentSize }, ...future])
    setElements(previous.elements)
    setBaseImagePlacement(previous.baseImagePlacement ?? DEFAULT_BASE_IMAGE_PLACEMENT)
    setDocumentSize(previous.documentSize)
    setDocumentDraft(previous.documentSize)
    setCropDraft(null)
    setSelectedId(null)
    setStatus('Ação desfeita.')
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast([...past, { baseImagePlacement, elements, documentSize }])
    setElements(next.elements)
    setBaseImagePlacement(next.baseImagePlacement ?? DEFAULT_BASE_IMAGE_PLACEMENT)
    setDocumentSize(next.documentSize)
    setDocumentDraft(next.documentSize)
    setCropDraft(null)
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
    const selectionGuides = stage.find('.editor-selection-guide')
    transformers.forEach((transformer) => transformer.visible(false))
    selectionGuides.forEach((guide) => guide.visible(false))
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
      selectionGuides.forEach((guide) => guide.visible(true))
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

    const point = event.target.getStage().getPointerPosition()

    if (tool === 'eyedropper') {
      sampleCanvasColor(event)
      return
    }

    if (tool === 'magic-wand') {
      event.evt.preventDefault()
      selectMagicArea(point)
      return
    }

    if (tool === 'pen') {
      event.evt.preventDefault()
      setPenPoints((current) => [...current, point.x, point.y])
      setStatus('Ponto adicionado. Continue clicando ou finalize a forma no painel.')
      return
    }

    if (tool === 'marquee' || tool === 'crop') {
      event.evt.preventDefault()
      isDrawing.current = true
      selectionStart.current = point
      setAreaSelection({
        type: tool,
        bounds: { x: point.x, y: point.y, width: 0, height: 0 },
      })
      return
    }

    if (tool === 'lasso') {
      event.evt.preventDefault()
      isDrawing.current = true
      setAreaSelection({
        type: 'lasso',
        points: [point.x, point.y],
        bounds: { x: point.x, y: point.y, width: 0, height: 0 },
      })
      return
    }

    if (tool !== 'brush' && tool !== 'eraser') {
      if (event.target === event.target.getStage()) setSelectedId(null)
      return
    }

    event.evt.preventDefault()
    isDrawing.current = true
    drawingStart.current = { baseImagePlacement, elements, documentSize }
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
    if (!isDrawing.current) return
    event.evt.preventDefault()
    const point = event.target.getStage().getPointerPosition()

    if ((tool === 'marquee' || tool === 'crop') && selectionStart.current) {
      setAreaSelection({
        type: tool,
        bounds: normalizeAreaRect(
          selectionStart.current.x,
          selectionStart.current.y,
          point.x,
          point.y,
          documentSize,
        ),
      })
      return
    }

    if (tool === 'lasso') {
      setAreaSelection((current) => {
        const points = [...(current?.points ?? []), point.x, point.y]
        return { type: 'lasso', points, bounds: getPointBounds(points, documentSize) }
      })
      return
    }

    if (tool !== 'brush' && tool !== 'eraser') return

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

    if (tool === 'marquee' || tool === 'crop') {
      selectionStart.current = null
      if (!areaSelection || areaSelection.bounds.width < 2 || areaSelection.bounds.height < 2) {
        setAreaSelection(null)
        setStatus('Arraste no canvas para marcar uma área.')
        return
      }
      setSidePanel('properties')
      setStatus(tool === 'crop' ? 'Área de corte pronta para aplicar.' : 'Área retangular selecionada.')
      return
    }

    if (tool === 'lasso') {
      if (!areaSelection || areaSelection.points.length < 6) {
        setAreaSelection(null)
        setStatus('Desenhe um contorno fechado maior para selecionar.')
        return
      }
      setSidePanel('properties')
      setStatus('Seleção livre pronta para copiar.')
      return
    }

    setPast((current) => [...current, drawingStart.current])
    setFuture([])
    setStatus(tool === 'eraser' ? 'Área apagada.' : 'Traço adicionado.')
  }

  function captureImage({ pixelRatio = 2, mimeType = 'image/png', quality = 1 } = {}) {
    const stage = stageRef.current
    if (!stage) return null

    const transformers = stage.find('Transformer')
    const selectionGuides = stage.find('.editor-selection-guide')
    transformers.forEach((transformer) => transformer.visible(false))
    selectionGuides.forEach((guide) => guide.visible(false))
    stage.batchDraw()

    const dataUrl = stage.toDataURL({ mimeType, pixelRatio, quality })

    transformers.forEach((transformer) => transformer.visible(true))
    selectionGuides.forEach((guide) => guide.visible(true))
    stage.batchDraw()
    return dataUrl
  }

  function exportImage() {
    const dataUrl = captureImage()
    if (!dataUrl) return

    const link = document.createElement('a')
    link.download = 'thumb-da-galerinha.png'
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
    setStatus('Imagem exportada em PNG.')
  }

  function captureSubmissionImage() {
    for (const attempt of SUBMISSION_CAPTURE_ATTEMPTS) {
      const dataUrl = captureImage({ ...attempt, mimeType: 'image/webp' })
      if (!dataUrl || dataUrl.length <= MAX_SUBMISSION_DATA_LENGTH) return dataUrl
    }

    setStatus('A thumb ficou grande demais para ser enviada. Remova uma imagem e tente novamente.')
    return null
  }

  function finishRound(reason = 'manual') {
    if (hasFinishedRound.current) return

    if (!onFinish) {
      exportImage()
      return
    }

    const imageDataUrl = captureSubmissionImage()
    if (!imageDataUrl) return

    hasFinishedRound.current = true
    onFinish({ imageDataUrl, reason })
  }

  finishRoundRef.current = finishRound

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <button className="back-button" type="button" onClick={handleBack}>← Menu</button>
        <div>
          <span className="round-label">
            {round ? `Rodada ${round.number}/${round.total}` : 'Rodada de teste'}
          </span>
          <strong>{round?.challenge ?? 'Transforme o passeio em uma aventura impossível'}</strong>
          <div className="session-status-row">
            <span className={`save-status is-${saveStatus}`} aria-live="polite">
              <i
                className={`bi ${saveStatus === 'error'
                  ? 'bi-exclamation-triangle-fill'
                  : saveStatus === 'saving'
                    ? 'bi-arrow-repeat'
                    : saveStatus === 'saved'
                      ? 'bi-cloud-check-fill'
                      : 'bi-cloud'}`}
                aria-hidden="true"
              />
              {getSaveLabel(saveStatus, lastSavedAt)}
            </span>
            <button
              className="clear-draft-button"
              type="button"
              onClick={clearDraft}
              disabled={saveStatus === 'loading' || !hasPersistableContent}
            >
              Limpar rascunho
            </button>
          </div>
        </div>
        {players.length > 0 && (
          <div
            className="editor-player-progress"
            role="status"
            aria-label={`${submittedPlayerIds.length} de ${players.length} jogadores enviaram a thumb`}
          >
            <div className="editor-player-stack" aria-hidden="true">
              {players.map((currentPlayer) => {
                const hasSubmitted = submittedPlayers.has(currentPlayer.id)

                return (
                  <span
                    className={`editor-player-token${hasSubmitted ? ' is-submitted' : ''}`}
                    title={`${currentPlayer.username}: ${hasSubmitted ? 'thumb enviada' : 'editando'}`}
                    key={currentPlayer.id}
                  >
                    <PlayerAvatar avatarId={currentPlayer.avatarId} />
                    {hasSubmitted && <i className="bi bi-check" />}
                  </span>
                )
              })}
            </div>
            <span>{submittedPlayerIds.length}/{players.length} enviados</span>
          </div>
        )}
        <button
          className={`music-toggle${musicMuted ? ' is-muted' : ''}`}
          type="button"
          onClick={toggleMusic}
          aria-pressed={musicMuted}
          title={musicMuted ? 'Ativar música' : 'Silenciar música'}
        >
          <i className={`bi ${musicMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}`} aria-hidden="true" />
          Música
        </button>
        <div
          className={`timer${remainingSeconds <= 30 ? ' is-urgent' : ''}`}
          aria-label={`${remainingSeconds} segundos restantes`}
        >
          {formatRoundTime(remainingSeconds)}
        </div>
        <button className="finish-button" type="button" onClick={() => finishRound('manual')}>
          {onFinish ? 'Finalizar thumb' : 'Exportar PNG'}
        </button>
      </header>

      <div className="editor-workspace">
        <aside className="tool-rail" aria-label="Ferramentas do editor">
          <ToolButton
            active={tool === 'select'}
            onClick={() => {
              setTool('select')
              setCropDraft(null)
              setAreaSelection(null)
              setPenPoints([])
              setStatus('Ferramenta Mover selecionada. Arraste uma camada ou use as setas.')
            }}
            title="Mover camadas (V)"
          >
            <i className="bi bi-arrows-move" aria-hidden="true" />
            Mover
          </ToolButton>
          <ToolButton
            active={tool === 'marquee'}
            onClick={() => activateAreaTool('marquee', 'Arraste para criar uma seleção retangular.')}
            title="Seleção retangular"
          >
            <i className="bi bi-bounding-box" aria-hidden="true" />
            Seleção
          </ToolButton>
          <ToolButton
            active={tool === 'lasso'}
            onClick={() => activateAreaTool('lasso', 'Desenhe livremente ao redor da área desejada.')}
            title="Laço de seleção livre"
          >
            <i className="bi bi-bezier2" aria-hidden="true" />
            Laço
          </ToolButton>
          <ToolButton
            active={tool === 'magic-wand'}
            onClick={() => activateAreaTool('magic-wand', 'Clique em uma cor para selecionar pixels semelhantes conectados.')}
            title="Varinha mágica"
          >
            <i className="bi bi-magic" aria-hidden="true" />
            Varinha
          </ToolButton>
          <ToolButton
            active={tool === 'pen'}
            onClick={() => activateAreaTool('pen', 'Clique para adicionar os pontos da forma vetorial.')}
            title="Caneta vetorial"
          >
            <i className="bi bi-pen-fill" aria-hidden="true" />
            Caneta
          </ToolButton>
          <ToolButton
            active={tool === 'crop'}
            onClick={() => activateAreaTool('crop', 'Arraste a área que deve permanecer no documento.')}
            title="Cortar documento"
          >
            <i className="bi bi-crop" aria-hidden="true" />
            Corte
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
              setAreaSelection(null)
              setPenPoints([])
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
              setAreaSelection(null)
              setPenPoints([])
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
              setAreaSelection(null)
              setPenPoints([])
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
              setAreaSelection(null)
              setPenPoints([])
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
            <button
              className="canvas-dimensions"
              type="button"
              onClick={() => setSidePanel('document')}
              title="Abrir configurações do documento"
            >
              {documentSize.width} × {documentSize.height}
            </button>
          </div>

          <div
            ref={canvasFrameRef}
            className={`canvas-frame${tool === 'brush' || tool === 'eraser' ? ' is-drawing' : ''}${['marquee', 'lasso', 'pen', 'crop'].includes(tool) ? ' is-selecting' : ''}${tool === 'eyedropper' || tool === 'magic-wand' ? ' is-eyedropper' : ''}${spaceDown ? ' is-pan-ready' : ''}${isPanning ? ' is-panning' : ''}`}
            onWheel={handleCanvasWheel}
            onPointerDown={startPan}
            onPointerMove={continuePan}
            onPointerUp={finishPan}
            onPointerCancel={finishPan}
          >
            <div
              className="stage-scaler"
              style={{
                width: documentSize.width * zoom,
                height: documentSize.height * zoom,
              }}
            >
              <div
                className="stage-transform"
                style={{
                  width: documentSize.width,
                  height: documentSize.height,
                  transform: `scale(${zoom})`,
                }}
              >
                <Stage
                  ref={stageRef}
                  width={documentSize.width}
                  height={documentSize.height}
                  onMouseDown={beginDrawing}
                  onMouseMove={continueDrawing}
                  onMouseUp={finishDrawing}
                  onMouseLeave={finishDrawing}
                  onTouchStart={beginDrawing}
                  onTouchMove={continueDrawing}
                  onTouchEnd={finishDrawing}
                >
                  <Layer>
                    <Rect width={documentSize.width} height={documentSize.height} fill="#dcefff" listening={false} />
                    {baseImage && (
                      <EditableBaseImage
                        image={baseImage}
                        documentSize={documentSize}
                        placement={normalizedBaseImagePlacement}
                        isInteractive={!activeCropDraft && tool === 'select'}
                        isSelected={isBaseImageSelected && tool === 'select'}
                        onSelect={() => {
                          if (tool !== 'select') return
                          setCropDraft(null)
                          setSelectedId(BASE_IMAGE_ID)
                          setSidePanel('properties')
                          setStatus('Foto principal selecionada. Arraste para reposicionar.')
                        }}
                        onChange={(nextPlacement) => updateBaseImagePlacement(nextPlacement)}
                      />
                    )}
                  </Layer>

                  <Layer>
                    {renderedElements.map((element) => {
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
                          documentSize={documentSize}
                          element={element}
                          isInteractive={!activeCropDraft && tool === 'select' && !element.locked}
                          isSelected={selectedId === element.id && !element.locked}
                          onSelect={() => {
                            if (tool === 'select') {
                              setCropDraft(null)
                              setSelectedId(element.id)
                              setSidePanel('properties')
                            }
                          }}
                          onChange={updateElement}
                        />
                      )
                    })}
                  </Layer>
                  <Layer listening={false}>
                    <AreaSelectionOverlay selection={areaSelection} />
                    {penPoints.length > 0 && (
                      <>
                        <Line
                          name="editor-selection-guide"
                          points={penPoints}
                          stroke="#146db7"
                          strokeWidth={4}
                          dash={[10, 7]}
                          lineJoin="round"
                          listening={false}
                        />
                        {penPoints.reduce((points, coordinate, index) => {
                          if (index % 2 !== 0) return points
                          points.push(
                            <Circle
                              key={`${coordinate}-${penPoints[index + 1]}-${index}`}
                              name="editor-selection-guide"
                              x={coordinate}
                              y={penPoints[index + 1]}
                              radius={6}
                              fill="#fff7e8"
                              stroke="#25232b"
                              strokeWidth={2}
                              listening={false}
                            />,
                          )
                          return points
                        }, [])}
                      </>
                    )}
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
              aria-selected={sidePanel === 'document'}
              className={sidePanel === 'document' ? 'is-active' : ''}
              onClick={() => setSidePanel('document')}
            >
              Documento
            </button>
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

          {sidePanel === 'document' ? (
            <div className="document-panel" role="tabpanel">
              <h2>Documento</h2>
              <p className="panel-description">Escolha um formato ou defina um tamanho personalizado.</p>

              <div className="document-presets" aria-label="Formatos do documento">
                {DOCUMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setDocumentDraft({ width: preset.width, height: preset.height })
                      resizeDocument({ width: preset.width, height: preset.height })
                    }}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.detail}</span>
                  </button>
                ))}
              </div>

              <div className="document-size-grid">
                <label htmlFor="document-width">
                  Largura
                  <input
                    id="document-width"
                    type="number"
                    min={MIN_DOCUMENT_WIDTH}
                    max={MAX_DOCUMENT_SIZE}
                    value={documentDraft.width}
                    onChange={(event) => updateDocumentDraft('width', event.target.value)}
                  />
                </label>
                <button
                  className="swap-document-size"
                  type="button"
                  onClick={() => setDocumentDraft({
                    width: documentDraft.height,
                    height: documentDraft.width,
                  })}
                  aria-label="Trocar largura e altura"
                  title="Trocar orientação"
                >
                  <i className="bi bi-arrow-left-right" aria-hidden="true" />
                </button>
                <label htmlFor="document-height">
                  Altura
                  <input
                    id="document-height"
                    type="number"
                    min={MIN_DOCUMENT_HEIGHT}
                    max={MAX_DOCUMENT_SIZE}
                    value={documentDraft.height}
                    onChange={(event) => updateDocumentDraft('height', event.target.value)}
                  />
                </label>
              </div>

              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={lockDocumentRatio}
                  onChange={(event) => setLockDocumentRatio(event.target.checked)}
                />
                Manter proporção
              </label>
              <label className="checkbox-control">
                <input
                  type="checkbox"
                  checked={scaleDocumentContent}
                  onChange={(event) => setScaleDocumentContent(event.target.checked)}
                />
                Redimensionar conteúdo junto
              </label>

              <div className="document-summary">
                <span>Atual</span>
                <strong>{documentSize.width} × {documentSize.height}px</strong>
              </div>
              <button className="apply-document-size" type="button" onClick={() => resizeDocument()}>
                Aplicar tamanho
              </button>
            </div>
          ) : sidePanel === 'layers' ? (
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
                          setCropDraft(null)
                          setAreaSelection(null)
                          setPenPoints([])
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
                <div className={`layer-item is-background${isBaseImageSelected ? ' is-selected' : ''}`}>
                  <button
                    className="layer-select"
                    type="button"
                    onClick={() => {
                      setCropDraft(null)
                      setAreaSelection(null)
                      setPenPoints([])
                      setSelectedId(BASE_IMAGE_ID)
                      setTool('select')
                      setSidePanel('properties')
                      setStatus('Foto principal selecionada. Arraste para reposicionar.')
                    }}
                  >
                    <span className="layer-kind" aria-hidden="true">▧</span>
                    <span>Foto principal</span>
                  </button>
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
                    title="Use a ferramenta Mover"
                    disabled
                  >
                    ↔
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

              {['marquee', 'lasso', 'magic-wand', 'crop'].includes(tool) && (
                <div className="property-group selection-tool-panel">
                  <div className="selection-tool-heading">
                    <span><i className={`bi ${tool === 'marquee' ? 'bi-bounding-box' : tool === 'lasso' ? 'bi-bezier2' : tool === 'magic-wand' ? 'bi-magic' : 'bi-crop'}`} aria-hidden="true" /></span>
                    <div>
                      <strong>{tool === 'marquee' ? 'Seleção retangular' : tool === 'lasso' ? 'Laço livre' : tool === 'magic-wand' ? 'Varinha mágica' : 'Cortar documento'}</strong>
                      <small>{tool === 'magic-wand' ? 'Clique numa cor conectada' : 'Arraste diretamente no canvas'}</small>
                    </div>
                  </div>

                  {tool === 'magic-wand' && (
                    <>
                      <label htmlFor="magic-tolerance">Tolerância: {magicTolerance}</label>
                      <input
                        id="magic-tolerance"
                        type="range"
                        min="0"
                        max="100"
                        value={magicTolerance}
                        onChange={(event) => setMagicTolerance(Number(event.target.value))}
                      />
                      <p className="selection-tool-note">Valores maiores incluem mais tons parecidos.</p>
                    </>
                  )}

                  {areaSelection?.bounds ? (
                    <>
                      <div className="selection-size-card" aria-live="polite">
                        <span>Área marcada</span>
                        <strong>{Math.round(areaSelection.bounds.width)} × {Math.round(areaSelection.bounds.height)} px</strong>
                      </div>
                      <div className="selection-actions">
                        {tool === 'crop' ? (
                          <button type="button" className="is-primary" onClick={applyDocumentCrop}>
                            <i className="bi bi-check-lg" aria-hidden="true" /> Aplicar corte
                          </button>
                        ) : (
                          <button type="button" className="is-primary" onClick={copyAreaSelectionToLayer}>
                            <i className="bi bi-layers-fill" aria-hidden="true" /> Copiar para camada
                          </button>
                        )}
                        <button type="button" onClick={() => {
                          setAreaSelection(null)
                          setStatus('Seleção cancelada.')
                        }}>
                          <i className="bi bi-x-lg" aria-hidden="true" /> Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="selection-empty-state">
                      {tool === 'magic-wand' ? 'Clique na região que deseja selecionar.' : 'Clique e arraste para marcar a área.'}
                    </p>
                  )}
                </div>
              )}

              {tool === 'pen' && (
                <div className="property-group selection-tool-panel">
                  <div className="selection-tool-heading">
                    <span><i className="bi bi-pen-fill" aria-hidden="true" /></span>
                    <div>
                      <strong>Caneta vetorial</strong>
                      <small>Clique para criar os pontos</small>
                    </div>
                  </div>
                  <label htmlFor="pen-fill-color">Cor da forma</label>
                  <input
                    id="pen-fill-color"
                    type="color"
                    value={brushColor}
                    onChange={(event) => setBrushColor(event.target.value)}
                  />
                  <div className="selection-size-card">
                    <span>Pontos adicionados</span>
                    <strong>{penPoints.length / 2}</strong>
                  </div>
                  <div className="selection-actions">
                    <button
                      type="button"
                      className="is-primary"
                      disabled={penPoints.length < 6}
                      onClick={finishPenPath}
                    >
                      <i className="bi bi-check-lg" aria-hidden="true" /> Fechar forma
                    </button>
                    <button
                      type="button"
                      disabled={penPoints.length === 0}
                      onClick={() => setPenPoints((current) => current.slice(0, -2))}
                    >
                      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Último ponto
                    </button>
                    <button type="button" onClick={() => {
                      setPenPoints([])
                      setStatus('Traçado da caneta cancelado.')
                    }}>
                      <i className="bi bi-x-lg" aria-hidden="true" /> Cancelar
                    </button>
                  </div>
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

              {!['brush', 'eraser', 'eyedropper', 'stickers', 'marquee', 'lasso', 'magic-wand', 'pen', 'crop'].includes(tool) && !selectedElement && !isBaseImageSelected && (
                <div className="empty-properties">
                  <span aria-hidden="true">↖</span>
                  <p>Selecione um elemento ou abra a aba de camadas.</p>
                </div>
              )}

              {isBaseImageSelected && (
                <div className="property-group base-image-properties">
                  <div className="base-image-property-heading">
                    <span><i className="bi bi-arrows-move" aria-hidden="true" /></span>
                    <div>
                      <strong>Foto principal</strong>
                      <small>Arraste diretamente no canvas</small>
                    </div>
                  </div>

                  <label htmlFor="base-image-scale">Tamanho da foto</label>
                  <div className="base-image-scale-controls" aria-label="Ajustar tamanho da foto principal">
                    <button
                      type="button"
                      onClick={() => adjustBaseImageScale(-0.1)}
                      disabled={normalizedBaseImagePlacement.scale <= MIN_BASE_IMAGE_SCALE}
                      aria-label="Diminuir foto em 10%"
                      title="Diminuir foto em 10%"
                    >
                      <i className="bi bi-dash-lg" aria-hidden="true" />
                      <span>Diminuir</span>
                    </button>
                    <output htmlFor="base-image-scale" aria-live="polite">
                      {Math.round(normalizedBaseImagePlacement.scale * 100)}%
                    </output>
                    <button
                      type="button"
                      onClick={() => adjustBaseImageScale(0.1)}
                      disabled={normalizedBaseImagePlacement.scale >= MAX_BASE_IMAGE_SCALE}
                      aria-label="Aumentar foto em 10%"
                      title="Aumentar foto em 10%"
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      <span>Aumentar</span>
                    </button>
                  </div>
                  <input
                    id="base-image-scale"
                    type="range"
                    min={MIN_BASE_IMAGE_SCALE}
                    max={MAX_BASE_IMAGE_SCALE}
                    step="0.01"
                    value={normalizedBaseImagePlacement.scale}
                    onChange={(event) => updateBaseImagePlacement({
                      ...normalizedBaseImagePlacement,
                      scale: Number(event.target.value),
                    }, 'Zoom da foto principal atualizado.')}
                  />

                  <div className="position-input-grid">
                    <label htmlFor="base-image-x">
                      Horizontal
                      <input
                        id="base-image-x"
                        type="number"
                        min={-baseHorizontalLimit}
                        max={baseHorizontalLimit}
                        value={Math.round(normalizedBaseImagePlacement.offsetX)}
                        onChange={(event) => updateBaseImagePlacement({
                          ...normalizedBaseImagePlacement,
                          offsetX: Number(event.target.value),
                        })}
                      />
                    </label>
                    <label htmlFor="base-image-y">
                      Vertical
                      <input
                        id="base-image-y"
                        type="number"
                        min={-baseVerticalLimit}
                        max={baseVerticalLimit}
                        value={Math.round(normalizedBaseImagePlacement.offsetY)}
                        onChange={(event) => updateBaseImagePlacement({
                          ...normalizedBaseImagePlacement,
                          offsetY: Number(event.target.value),
                        })}
                      />
                    </label>
                  </div>

                  <p className="move-shortcut-note">
                    <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> move 1 px · <kbd>Shift</kbd> move 10 px
                  </p>

                  <div className="base-image-actions">
                    <button
                      type="button"
                      onClick={() => updateBaseImagePlacement({
                        ...normalizedBaseImagePlacement,
                        offsetX: 0,
                        offsetY: 0,
                      }, 'Foto principal centralizada.')}
                    >
                      <i className="bi bi-bullseye" aria-hidden="true" /> Centralizar
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBaseImagePlacement(
                        DEFAULT_BASE_IMAGE_PLACEMENT,
                        'Posição da foto principal restaurada.',
                      )}
                    >
                      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Restaurar
                    </button>
                  </div>
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

                  {selectedElement.type !== 'line' && (
                    <fieldset className="position-controls">
                      <legend>Posição precisa</legend>
                      <div className="position-input-grid">
                        <label htmlFor="element-position-x">
                          X
                          <input
                            id="element-position-x"
                            type="number"
                            value={Math.round(selectedElement.x)}
                            onChange={(event) => updateSelected({ x: Number(event.target.value) })}
                          />
                        </label>
                        <label htmlFor="element-position-y">
                          Y
                          <input
                            id="element-position-y"
                            type="number"
                            value={Math.round(selectedElement.y)}
                            onChange={(event) => updateSelected({ y: Number(event.target.value) })}
                          />
                        </label>
                        <label htmlFor="element-rotation">
                          Rotação
                          <input
                            id="element-rotation"
                            type="number"
                            min="-180"
                            max="180"
                            value={Math.round(selectedElement.rotation ?? 0)}
                            onChange={(event) => updateSelected({ rotation: Number(event.target.value) })}
                          />
                        </label>
                      </div>
                      <p className="move-shortcut-note">
                        Use as setas para mover 1 px ou <kbd>Shift</kbd> para 10 px.
                      </p>
                    </fieldset>
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
                          <legend>Recorte</legend>
                          <button type="button" onClick={() => applyCropRatio(null)}>Original</button>
                          <button type="button" onClick={() => applyCropRatio(1)}>1:1</button>
                          <button type="button" onClick={() => applyCropRatio(4 / 5)}>4:5</button>
                          <button type="button" onClick={() => applyCropRatio(16 / 9)}>16:9</button>
                          <button
                            className={`manual-crop-trigger${activeCropDraft ? ' is-active' : ''}`}
                            type="button"
                            onClick={beginManualCrop}
                          >
                            <i className="bi bi-crop" aria-hidden="true" /> Recorte livre
                          </button>

                          {activeCropDraft && (
                            <div className="manual-crop-editor">
                              <p>Área da imagem original</p>

                              <label htmlFor="crop-x">Posição X: {Math.round(activeCropDraft.x)}px</label>
                              <input
                                id="crop-x"
                                type="range"
                                min="0"
                                max={Math.max(0, selectedElement.sourceWidth - activeCropDraft.width)}
                                value={activeCropDraft.x}
                                onChange={(event) => updateCropDraft({ x: Number(event.target.value) })}
                              />

                              <label htmlFor="crop-y">Posição Y: {Math.round(activeCropDraft.y)}px</label>
                              <input
                                id="crop-y"
                                type="range"
                                min="0"
                                max={Math.max(0, selectedElement.sourceHeight - activeCropDraft.height)}
                                value={activeCropDraft.y}
                                onChange={(event) => updateCropDraft({ y: Number(event.target.value) })}
                              />

                              <label htmlFor="crop-width">Largura: {Math.round(activeCropDraft.width)}px</label>
                              <input
                                id="crop-width"
                                type="range"
                                min="20"
                                max={selectedElement.sourceWidth - activeCropDraft.x}
                                value={activeCropDraft.width}
                                onChange={(event) => updateCropDraft({ width: Number(event.target.value) })}
                              />

                              <label htmlFor="crop-height">Altura: {Math.round(activeCropDraft.height)}px</label>
                              <input
                                id="crop-height"
                                type="range"
                                min="20"
                                max={selectedElement.sourceHeight - activeCropDraft.y}
                                value={activeCropDraft.height}
                                onChange={(event) => updateCropDraft({ height: Number(event.target.value) })}
                              />

                              <div className="manual-crop-actions">
                                <button type="button" onClick={cancelManualCrop}>Cancelar</button>
                                <button type="button" onClick={applyManualCrop}>Aplicar</button>
                              </div>
                            </div>
                          )}
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
