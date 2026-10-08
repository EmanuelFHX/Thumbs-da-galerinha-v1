const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SOURCE_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_IMAGE_DATA_LENGTH = 800_000
const COMPRESSION_ATTEMPTS = [
  { maxDimension: 1280, quality: 0.82 },
  { maxDimension: 1080, quality: 0.74 },
  { maxDimension: 900, quality: 0.66 },
  { maxDimension: 720, quality: 0.56 },
  { maxDimension: 560, quality: 0.46 },
  { maxDimension: 420, quality: 0.38 },
]

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(source)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error('Não foi possível abrir essa imagem.'))
    }
    image.src = source
  })
}

function canvasToDataUrl(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('Seu navegador não conseguiu preparar essa imagem.'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Não foi possível processar essa imagem.'))
      reader.readAsDataURL(blob)
    }, 'image/webp', quality)
  })
}

export async function prepareBaseImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file?.type)) {
    throw new Error('Escolha uma imagem PNG, JPG ou WebP.')
  }

  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error('A imagem pode ter no máximo 8 MB.')
  }

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  for (const { maxDimension, quality } of COMPRESSION_ATTEMPTS) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const imageData = await canvasToDataUrl(canvas, quality)
    if (imageData.length <= MAX_IMAGE_DATA_LENGTH) return imageData
  }

  throw new Error('Não conseguimos compactar essa imagem. Tente usar outra.')
}
