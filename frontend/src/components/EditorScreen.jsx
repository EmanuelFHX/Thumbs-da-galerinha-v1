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
const STICKERS = [
  { name: 'Estrela', source: '/stickers/star.svg' },
  { name: 'Balão', source: '/stickers/speech.svg' },
  { name: 'Fogo', source: '/stickers/fire.svg' },
]

function getInitialTool() {
  return new URLSearchParams(window.location.search).get('tool') === 'stickers'
    ? 'stickers'
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
      onChange({
        ...element,
        x: event.target.x(),
        y: event.target.y(),
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
    shape = (
      <Text
        {...sharedProps}
        text={element.text}
        fill={element.fill}
        fontFamily="Arial Rounded MT Bold, Trebuchet MS"
        fontSize={element.fontSize}
        fontStyle="bold"
        lineHeight={1.05}
        padding={6}
      />
    )
  }

  if (element.type === 'rect') {
    shape = (
      <Rect
        {...sharedProps}
        width={element.width}
        height={element.height}
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
  if (element.type === 'line') return `Traço ${index + 1}`
  if (element.type === 'circle') return 'Círculo'
  return 'Retângulo'
}

function EditorScreen({ onBack }) {
  const stageRef = useRef(null)
  const fileInputRef = useRef(null)
  const isDrawing = useRef(false)
  const drawingStart = useRef([])
  const baseImage = useCanvasImage('/sample-base.svg')

  const [tool, setTool] = useState(getInitialTool)
  const [sidePanel, setSidePanel] = useState(getInitialSidePanel)
  const [brushColor, setBrushColor] = useState('#ff5c7a')
  const [brushSize, setBrushSize] = useState(10)
  const [selectedId, setSelectedId] = useState(null)
  const [elements, setElements] = useState([])
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [status, setStatus] = useState('Escolha uma ferramenta e comece a criar.')

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
      fill: DEFAULT_COLOR,
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

  function addImage(source, width, height, message) {
    const maxWidth = 360
    const maxHeight = 260
    const scale = Math.min(maxWidth / width, maxHeight / height, 1)
    const nextWidth = Math.round(width * scale)
    const nextHeight = Math.round(height * scale)
    const nextElement = {
      id: createId('image'),
      type: 'image',
      source,
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
    addImage(sticker.source, 180, 180, `${sticker.name} adicionado ao canvas.`)
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

  function beginDrawing(event) {
    if (tool !== 'brush') {
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
      stroke: brushColor,
      strokeWidth: brushSize,
    }
    setElements([...elements, nextLine])
    setSelectedId(null)
  }

  function continueDrawing(event) {
    if (!isDrawing.current || tool !== 'brush') return
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
    setStatus('Traço adicionado.')
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
            <span aria-hidden="true">↖</span>
            Selecionar
          </ToolButton>
          <ToolButton onClick={addText} title="Adicionar texto">
            <span aria-hidden="true">T</span>
            Texto
          </ToolButton>
          <ToolButton
            active={tool === 'brush'}
            onClick={() => setTool('brush')}
            title="Desenhar à mão livre"
          >
            <span aria-hidden="true">✎</span>
            Pincel
          </ToolButton>
          <ToolButton onClick={() => addShape('rect')} title="Adicionar retângulo">
            <span aria-hidden="true">□</span>
            Retângulo
          </ToolButton>
          <ToolButton onClick={() => addShape('circle')} title="Adicionar círculo">
            <span aria-hidden="true">○</span>
            Círculo
          </ToolButton>
          <ToolButton onClick={() => fileInputRef.current?.click()} title="Importar imagem">
            <span aria-hidden="true">▧</span>
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
            <span aria-hidden="true">★</span>
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
            <div>
              <button type="button" onClick={undo} disabled={past.length === 0}>↶ Desfazer</button>
              <button type="button" onClick={redo} disabled={future.length === 0}>↷ Refazer</button>
            </div>
            <span>{CANVAS_WIDTH} × {CANVAS_HEIGHT}</span>
          </div>

          <div className={`canvas-frame${tool === 'brush' ? ' is-drawing' : ''}`}>
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
              <Layer>
                <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#dcefff" listening={false} />
                {baseImage && (
                  <KonvaImage
                    image={baseImage}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    listening={false}
                  />
                )}

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
                        tension={0.35}
                        lineCap="round"
                        lineJoin="round"
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

              {tool === 'brush' && (
                <div className="property-group">
                  <label htmlFor="brush-color">Cor do pincel</label>
                  <input
                    id="brush-color"
                    type="color"
                    value={brushColor}
                    onChange={(event) => setBrushColor(event.target.value)}
                  />
                  <label htmlFor="brush-size">Espessura: {brushSize}px</label>
                  <input
                    id="brush-size"
                    type="range"
                    min="3"
                    max="32"
                    value={brushSize}
                    onChange={(event) => setBrushSize(Number(event.target.value))}
                  />
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

              {tool !== 'brush' && tool !== 'stickers' && !selectedElement && (
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
                      <label htmlFor="font-size">Tamanho: {selectedElement.fontSize}px</label>
                      <input
                        id="font-size"
                        type="range"
                        min="20"
                        max="120"
                        value={selectedElement.fontSize}
                        onChange={(event) => updateSelected({ fontSize: Number(event.target.value) })}
                      />
                    </>
                  )}

                  {selectedElement.type !== 'image' && selectedElement.type !== 'line' && (
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

                  {selectedElement.type === 'line' && (
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

                  {selectedElement.type === 'image' && (
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
