import { useEffect, useRef, useState } from 'react'
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

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

function useCanvasImage(source) {
  const [image, setImage] = useState(null)

  useEffect(() => {
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

  useEffect(() => {
    if (!isSelected || !transformerRef.current || !nodeRef.current) return
    transformerRef.current.nodes([nodeRef.current])
    transformerRef.current.getLayer().batchDraw()
  }, [isSelected])

  const sharedProps = {
    ref: nodeRef,
    x: element.x,
    y: element.y,
    rotation: element.rotation ?? 0,
    scaleX: element.scaleX ?? 1,
    scaleY: element.scaleY ?? 1,
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

function EditorScreen({ onBack }) {
  const stageRef = useRef(null)
  const isDrawing = useRef(false)
  const drawingStart = useRef([])
  const baseImage = useCanvasImage('/sample-base.svg')

  const [tool, setTool] = useState('select')
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
                  if (element.type === 'line') {
                    return (
                      <Line
                        key={element.id}
                        points={element.points}
                        stroke={element.stroke}
                        strokeWidth={element.strokeWidth}
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
                      isInteractive={tool === 'select'}
                      isSelected={selectedId === element.id}
                      onSelect={() => {
                        if (tool === 'select') setSelectedId(element.id)
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

        <aside className="properties-panel" aria-label="Propriedades">
          <div className="panel-tape" aria-hidden="true" />
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

          {tool !== 'brush' && !selectedElement && (
            <div className="empty-properties">
              <span aria-hidden="true">↖</span>
              <p>Selecione um texto ou forma no canvas para editar.</p>
            </div>
          )}

          {selectedElement && selectedElement.type !== 'line' && (
            <div className="property-group">
              {selectedElement.type === 'text' && (
                <>
                  <label htmlFor="element-text">Texto</label>
                  <textarea
                    id="element-text"
                    rows="4"
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

              <label htmlFor="element-color">Cor</label>
              <input
                id="element-color"
                type="color"
                value={selectedElement.fill}
                onChange={(event) => updateSelected({ fill: event.target.value })}
              />

              <button className="delete-button" type="button" onClick={deleteSelected}>
                Excluir elemento
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

export default EditorScreen
