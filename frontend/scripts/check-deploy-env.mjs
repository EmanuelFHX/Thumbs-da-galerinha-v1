const requiredFirebaseVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

if (process.env.VERCEL) {
  const missingVariables = requiredFirebaseVariables.filter((name) => !process.env[name]?.trim())

  if (missingVariables.length) {
    console.error('\nDeploy interrompido: configure estas variáveis na Vercel:\n')
    missingVariables.forEach((name) => console.error(`- ${name}`))
    console.error('\nUse os mesmos valores do frontend/.env.local.\n')
    process.exit(1)
  }

  console.log('Variáveis Firebase conferidas para o deploy.')
}
